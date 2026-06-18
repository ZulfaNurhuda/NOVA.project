import dlv from 'dlv';

const isProduction = process.env.NODE_ENV === 'production';

// Helper to parse boolean from env, returns undefined if not set
const parseBoolean = (value: string | undefined): boolean | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return value.toLowerCase() === 'true';
};

// Helper to parse integer from env, returns undefined if not set
const parseInteger = (value: string | undefined): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
};

// Social provider configuration type
export interface SocialProviderConfig {
    clientId: string;
    clientSecret: string;
    tenantId?: string; // For Microsoft/Azure AD
    issuer?: string; // For self-hosted instances (e.g., GitLab)
}

// Generic OAuth provider configuration type (for better-auth genericOAuth plugin)
export interface GenericOAuthProviderConfig {
    providerId: string;
    discoveryUrl?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
    pkce?: boolean;
}

// Build social providers config dynamically from env vars
const buildSocialProviders = () => {
    const providers: Record<string, SocialProviderConfig> = {};

    // GitHub
    if (process.env.NOVA_AUTH_GITHUB_ID && process.env.NOVA_AUTH_GITHUB_SECRET) {
        providers.github = {
            clientId: process.env.NOVA_AUTH_GITHUB_ID,
            clientSecret: process.env.NOVA_AUTH_GITHUB_SECRET,
        };
    }

    // Google
    if (process.env.NOVA_AUTH_GOOGLE_ID && process.env.NOVA_AUTH_GOOGLE_SECRET) {
        providers.google = {
            clientId: process.env.NOVA_AUTH_GOOGLE_ID,
            clientSecret: process.env.NOVA_AUTH_GOOGLE_SECRET,
        };
    }

    // Microsoft (Azure AD)
    if (process.env.NOVA_AUTH_MICROSOFT_ID && process.env.NOVA_AUTH_MICROSOFT_SECRET) {
        providers.microsoft = {
            clientId: process.env.NOVA_AUTH_MICROSOFT_ID,
            clientSecret: process.env.NOVA_AUTH_MICROSOFT_SECRET,
            tenantId: process.env.NOVA_AUTH_MICROSOFT_TENANT_ID,
        };
    }

    // Discord
    if (process.env.NOVA_AUTH_DISCORD_ID && process.env.NOVA_AUTH_DISCORD_SECRET) {
        providers.discord = {
            clientId: process.env.NOVA_AUTH_DISCORD_ID,
            clientSecret: process.env.NOVA_AUTH_DISCORD_SECRET,
        };
    }

    // GitLab
    if (process.env.NOVA_AUTH_GITLAB_ID && process.env.NOVA_AUTH_GITLAB_SECRET) {
        providers.gitlab = {
            clientId: process.env.NOVA_AUTH_GITLAB_ID,
            clientSecret: process.env.NOVA_AUTH_GITLAB_SECRET,
            issuer: process.env.NOVA_AUTH_GITLAB_ISSUER,
        };
    }

    // Apple
    if (process.env.NOVA_AUTH_APPLE_ID && process.env.NOVA_AUTH_APPLE_SECRET) {
        providers.apple = {
            clientId: process.env.NOVA_AUTH_APPLE_ID,
            clientSecret: process.env.NOVA_AUTH_APPLE_SECRET,
        };
    }

    // Twitter/X
    if (process.env.NOVA_AUTH_TWITTER_ID && process.env.NOVA_AUTH_TWITTER_SECRET) {
        providers.twitter = {
            clientId: process.env.NOVA_AUTH_TWITTER_ID,
            clientSecret: process.env.NOVA_AUTH_TWITTER_SECRET,
        };
    }

    return providers;
};

// Build generic OAuth providers from JSON env var
const buildGenericOAuthProviders = (): GenericOAuthProviderConfig[] => {
    const genericOAuthEnv = process.env.NOVA_AUTH_GENERIC_OAUTH;

    if (!genericOAuthEnv) {
        return [];
    }

    try {
        const parsed = JSON.parse(genericOAuthEnv);
        if (!Array.isArray(parsed)) {
            console.error('NOVA_AUTH_GENERIC_OAUTH must be a JSON array');
            return [];
        }

        // Validate each provider config
        return parsed.filter((provider: any) => {
            if (!provider.providerId || !provider.clientId || !provider.clientSecret) {
                console.error(
                    `Invalid generic OAuth provider config: missing required fields (providerId, clientId, or clientSecret)`
                );
                return false;
            }

            // Must have either discoveryUrl OR all three URLs (authorization, token, userInfo)
            const hasDiscoveryUrl = !!provider.discoveryUrl;
            const hasManualUrls = !!(
                provider.authorizationUrl &&
                provider.tokenUrl &&
                provider.userInfoUrl
            );

            if (!hasDiscoveryUrl && !hasManualUrls) {
                console.error(
                    `Invalid generic OAuth provider config for "${provider.providerId}": must provide either discoveryUrl OR all of (authorizationUrl, tokenUrl, userInfoUrl)`
                );
                return false;
            }

            return true;
        }) as GenericOAuthProviderConfig[];
    } catch (error) {
        console.error('Failed to parse NOVA_AUTH_GENERIC_OAUTH:', error);
        return [];
    }
};

const socialProviders = buildSocialProviders();
const genericOAuthProviders = buildGenericOAuthProviders();

// Managed mode: all settings are controlled via environment variables
const isManaged = parseBoolean(process.env.NOVA_MANAGED) ?? false;

// Managed mode settings (only used when NOVA_MANAGED=true)
const managedSettings = isManaged
    ? {
          // General settings
          instanceName: process.env.NOVA_INSTANCE_NAME ?? '',
          instanceDescription: process.env.NOVA_INSTANCE_DESCRIPTION ?? '',
          instanceLogo: process.env.NOVA_INSTANCE_LOGO ?? '',
          allowRegistration: parseBoolean(process.env.NOVA_ALLOW_REGISTRATION) ?? true,
          requireEmailVerification:
              parseBoolean(process.env.NOVA_REQUIRE_EMAIL_VERIFICATION) ?? false,
          defaultSecretExpiration:
              parseInteger(process.env.NOVA_DEFAULT_SECRET_EXPIRATION) ?? 72,
          maxSecretSize: parseInteger(process.env.NOVA_MAX_SECRET_SIZE) ?? 1024,
          importantMessage: process.env.NOVA_IMPORTANT_MESSAGE ?? '',

          // Security settings
          allowPasswordProtection:
              parseBoolean(process.env.NOVA_ALLOW_PASSWORD_PROTECTION) ?? true,
          allowIpRestriction: parseBoolean(process.env.NOVA_ALLOW_IP_RESTRICTION) ?? true,
          enableRateLimiting: parseBoolean(process.env.NOVA_ENABLE_RATE_LIMITING) ?? true,
          rateLimitRequests: parseInteger(process.env.NOVA_RATE_LIMIT_REQUESTS) ?? 100,
          rateLimitWindow: parseInteger(process.env.NOVA_RATE_LIMIT_WINDOW) ?? 60,

          // Organization settings
          requireInviteCode: parseBoolean(process.env.NOVA_REQUIRE_INVITE_CODE) ?? false,
          allowedEmailDomains: process.env.NOVA_ALLOWED_EMAIL_DOMAINS ?? '',
          requireRegisteredUser:
              parseBoolean(process.env.NOVA_REQUIRE_REGISTERED_USER) ?? false,
          disableEmailPasswordSignup:
              parseBoolean(process.env.NOVA_DISABLE_EMAIL_PASSWORD_SIGNUP) ?? false,

          // Webhook settings
          webhookEnabled: parseBoolean(process.env.NOVA_WEBHOOK_ENABLED) ?? false,
          webhookUrl: process.env.NOVA_WEBHOOK_URL ?? '',
          webhookSecret: process.env.NOVA_WEBHOOK_SECRET ?? '',
          webhookOnView: parseBoolean(process.env.NOVA_WEBHOOK_ON_VIEW) ?? true,
          webhookOnBurn: parseBoolean(process.env.NOVA_WEBHOOK_ON_BURN) ?? true,

          // Metrics settings
          metricsEnabled: parseBoolean(process.env.NOVA_METRICS_ENABLED) ?? false,
          metricsSecret: process.env.NOVA_METRICS_SECRET ?? '',

          // File upload settings
          allowFileUploads: parseBoolean(process.env.NOVA_ALLOW_FILE_UPLOADS) ?? true,
      }
    : null;

const config = {
    server: {
        port: Number(process.env.NOVA_PORT) || 3001,
    },
    trustedOrigins: [
        ...(!isProduction ? ['http://localhost:5173'] : []),
        process.env.NOVA_TRUSTED_ORIGIN || '',
    ].filter(Boolean),
    general: {
        instanceName: process.env.NOVA_INSTANCE_NAME,
        instanceDescription: process.env.NOVA_INSTANCE_DESCRIPTION,
        instanceLogo: process.env.NOVA_INSTANCE_LOGO,
        allowRegistration: parseBoolean(process.env.NOVA_ALLOW_REGISTRATION),
    },
    security: {
        allowPasswordProtection: parseBoolean(process.env.NOVA_ALLOW_PASSWORD_PROTECTION),
        allowIpRestriction: parseBoolean(process.env.NOVA_ALLOW_IP_RESTRICTION),
    },
    analytics: {
        enabled: parseBoolean(process.env.NOVA_ANALYTICS_ENABLED) ?? true,
        hmacSecret:
            process.env.NOVA_ANALYTICS_HMAC_SECRET || 'default-analytics-secret-change-me',
    },
    smtp: {
        host: process.env.NOVA_SMTP_HOST || '',
        port: parseInteger(process.env.NOVA_SMTP_PORT) || 587,
        user: process.env.NOVA_SMTP_USER || '',
        password: process.env.NOVA_SMTP_PASSWORD || '',
        fromEmail: process.env.NOVA_SMTP_FROM_EMAIL || process.env.NOVA_SMTP_USER || 'noreply@nova',
    },
    socialProviders,
};

if (!process.env.NOVA_ANALYTICS_HMAC_SECRET && config.analytics.enabled) {
    console.warn(
        'WARNING: NOVA_ANALYTICS_HMAC_SECRET is not set. Analytics visitor IDs are generated ' +
            'with a default secret, making them predictable. Set a random secret for production use.'
    );
}

/**
 * A type-safe utility to get a value from the configuration.
 * Its return type is inferred from the type of the default value.
 * @param path The dot-notation path to the config value (e.g., 'server.port').
 * @param defaultValue A default value to return if the path is not found.
 * @returns The found configuration value or the default value.
 */
function get<T>(path: string, defaultValue?: T): T {
    return dlv(config, path, defaultValue) as T;
}

// Export the get function and social providers helper
export default {
    get,
    getSocialProviders: () => config.socialProviders,
    getGenericOAuthProviders: () => genericOAuthProviders,
    isManaged: () => isManaged,
    getManagedSettings: () => managedSettings,
};
