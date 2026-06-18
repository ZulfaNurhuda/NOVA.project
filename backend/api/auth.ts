import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, users, sessions, accounts, verifications, twoFactor as twoFactorTable, inviteCodes } from '../db';
import { count, eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { admin, twoFactor, username } from 'better-auth/plugins';
import nodemailer from 'nodemailer';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { randomBytes } from 'crypto';
import config, { type SocialProviderConfig } from './config';
import redis from './lib/redis';
import { validatePassword } from './validations/password';

// Generate a unique username from email
const generateUsernameFromEmail = (email: string): string => {
    const localPart = email.split('@')[0] || 'user';
    // Sanitize: only keep alphanumeric characters and underscores
    const sanitized = localPart.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    // Add random suffix to ensure uniqueness (cryptographically secure)
    const randomSuffix = randomBytes(4).toString('hex').substring(0, 6);
    return `${sanitized}_${randomSuffix}`;
};

// Build better-auth social providers configuration dynamically
const buildBetterAuthSocialProviders = () => {
    const providers = config.getSocialProviders();
    const betterAuthProviders: Record<string, any> = {};

    for (const [provider, providerConfig] of Object.entries(providers)) {
        const typedConfig = providerConfig as SocialProviderConfig;
        betterAuthProviders[provider] = {
            clientId: typedConfig.clientId,
            clientSecret: typedConfig.clientSecret,
            ...(typedConfig.tenantId && { tenantId: typedConfig.tenantId }),
            ...(typedConfig.issuer && { issuer: typedConfig.issuer }),
            mapProfileToUser: (profile: any) => ({
                username: generateUsernameFromEmail(profile.email || profile.name || 'user'),
            }),
        };
    }

    return betterAuthProviders;
};

// Email sending utility
const sendMail = async (to: string, subject: string, html: string) => {
    const host = config.get<string>('smtp.host');
    if (!host) {
        console.warn('SMTP host not configured. Skipping email to:', to);
        return;
    }
    const transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('smtp.port') || 587,
        secure: config.get<number>('smtp.port') === 465,
        auth: {
            user: config.get<string>('smtp.user'),
            pass: config.get<string>('smtp.password'),
        },
    });
    
    const instanceName = config.get<string>('general.instanceName') || 'NOVA Development';
    const fromEmail = config.get<string>('smtp.fromEmail');
    const fromFormatted = `"${instanceName}" <${fromEmail}>`;

    await transporter.sendMail({
        from: fromFormatted,
        to,
        subject,
        html,
    });
};

// Build better-auth plugins array
const buildPlugins = () => {
    const plugins: any[] = [
        username(), 
        admin(), 
        twoFactor()
    ];

    const genericProviders = config.getGenericOAuthProviders();
    if (genericProviders.length > 0) {
        plugins.push(
            genericOAuth({
                config: genericProviders.map((provider) => ({
                    ...provider,
                    // Map profile to include username
                    mapProfileToUser: (profile: any): any => ({
                        username: generateUsernameFromEmail(
                            profile.email || profile.name || 'user'
                        ),
                    }),
                })) as any,
            })
        );
    }

    return plugins;
};

export const auth = betterAuth({
    appName: 'NOVA',
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
            user:         users,
            session:      sessions,
            account:      accounts,
            verification: verifications,
            twoFactor:    twoFactorTable,
        },
    }),
    secondaryStorage: redis ? (() => {
        const r = redis;
        return {
            get: async (key: string) => r.get(key),
            set: async (key: string, value: string, ttl?: number) => {
                if (ttl) {
                    await r.set(key, value, 'EX', ttl);
                } else {
                    await r.set(key, value);
                }
            },
            delete: async (key: string) => { await r.del(key); },
        };
    })() : undefined,
    emailAndPassword: {
        enabled: true,
        // Set to 1 so better-auth doesn't reject weak current passwords during password change.
        // Password strength for new passwords is enforced by our Zod schema (updatePasswordSchema)
        // and for sign-up by the before hook below.
        minPasswordLength: 1,
        sendResetPassword: async ({ user, url }, _request) => {
            await sendMail(
                user.email,
                'Reset your NOVA password',
                `Hello ${user.name || 'User'},<br><br>You requested to reset your password. Click the following link to choose a new password:<br><a href="${url}">${url}</a><br><br>If you did not request this, please ignore this email.`
            );
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url }, _request) => {
            await sendMail(
                user.email,
                'Verify your email address for NOVA',
                `Hello ${user.name || 'User'},<br><br>Please click the following link to verify your email address:<br><a href="${url}">${url}</a><br><br>If you did not request this, please ignore this email.`
            );
        },
    },
    socialProviders: buildBetterAuthSocialProviders(),
    databaseHooks: {
        user: {
            create: {
                before: async (user, ctx) => {
                    const [{ value: userCount }] = await db.select({ value: count() }).from(users);

                    // Bypass all constraints for the first user (setup process)
                    if (userCount === 0) {
                        return { data: user };
                    }

                    const settings = await db.query.instanceSettings.findFirst({
                        columns: { allowRegistration: true, requireInviteCode: true },
                    });

                    const isRegistrationAllowed = settings ? settings.allowRegistration : true;

                    if (!isRegistrationAllowed) {
                        throw new APIError('FORBIDDEN', {
                            message: 'Registration is currently disabled by the administrator.',
                        });
                    }

                    if (settings?.requireInviteCode) {
                        let inviteCode: string | null | undefined = null;

                        // Handle native Headers or simple objects
                        if (ctx?.headers && typeof (ctx.headers as any).get === 'function') {
                            inviteCode = (ctx.headers as any).get('x-invite-code');
                        } else if (ctx?.headers && typeof ctx.headers === 'object') {
                            inviteCode = (ctx.headers as unknown as Record<string, string>)['x-invite-code'];
                        }

                        if (!inviteCode) {
                            throw new APIError('FORBIDDEN', {
                                message: 'An invite code is required to register. Social sign-ups are disabled for new users when invite codes are required.',
                            });
                        }

                        const invite = await db.query.inviteCodes.findFirst({
                            where: eq(inviteCodes.code, inviteCode),
                        });
                        if (!invite || !invite.isActive) {
                            throw new APIError('BAD_REQUEST', {
                                message: 'Invalid or already used invite code.',
                            });
                        }
                    }

                    return { data: user };
                },
            },
        },
    },
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: [
                'gitlab',
                'github',
                'google',
                'microsoft',
                'discord',
                'apple',
                'twitter',
                // Add all generic OAuth provider IDs as trusted
                ...config.getGenericOAuthProviders().map((p) => p.providerId),
            ],
        },
    },
    plugins: buildPlugins(),
    trustedOrigins: config.get('trustedOrigins'),
    hooks: {
        before: async (context) => {
            // Only apply validation to email/password sign-up
            if ((context as any).path !== '/sign-up/email') {
                return;
            }

            const body = (context as any).body as { email?: string; password?: string } | undefined;
            const email = body?.email;
            const password = body?.password;

            if (!email) {
                return;
            }

            // Validate password strength for sign-up
            if (password) {
                const passwordError = validatePassword(password);
                if (passwordError) {
                    throw new APIError('BAD_REQUEST', { message: passwordError });
                }
            }

            // Get instance settings
            const settings = await db.query.instanceSettings.findFirst({
                columns: { allowedEmailDomains: true, disableEmailPasswordSignup: true },
            });

            // Check if email/password signup is disabled
            if (settings?.disableEmailPasswordSignup) {
                throw new APIError('FORBIDDEN', {
                    message: 'Email/password registration is disabled. Please use social login.',
                });
            }

            const allowedDomains = settings?.allowedEmailDomains?.trim();

            // If no domains configured, allow all
            if (!allowedDomains) {
                return;
            }

            // Parse comma-separated domains
            const domains = allowedDomains
                .split(',')
                .map((d) => d.trim().toLowerCase())
                .filter((d) => d.length > 0);

            if (domains.length === 0) {
                return;
            }

            // Extract domain from email
            const emailDomain = email.split('@')[1]?.toLowerCase();

            if (!emailDomain || !domains.includes(emailDomain)) {
                throw new APIError('FORBIDDEN', {
                    message: 'Email domain not allowed',
                });
            }
        },
    },
});

// Export enabled social providers for frontend consumption
export const getEnabledSocialProviders = (): string[] => {
    const standardProviders = Object.keys(config.getSocialProviders());
    const genericProviders = config.getGenericOAuthProviders().map((p) => p.providerId);
    return [...standardProviders, ...genericProviders];
};
