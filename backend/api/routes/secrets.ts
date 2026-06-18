import { zValidator } from '@hono/zod-validator';
import { count, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { auth } from '../auth';
import { compare, hash } from '../lib/password';
import { db, secrets } from '../../db';
import { buildPaginationMeta } from '../lib/route-utils';
import { resolveSettings } from '../lib/settings';
import { handleNotFound } from '../lib/utils';
import { sendWebhook } from '../lib/webhook';
import { apiKeyOrAuthMiddleware } from '../middlewares/auth';
import { ipRestriction } from '../middlewares/ip-restriction';
import {
    createSecretsSchema,
    getSecretSchema,
    processSecretsQueryParams,
    secretsIdParamSchema,
    secretsQuerySchema,
} from '../validations/secrets';


const app = new Hono<{
    Variables: {
        user: typeof auth.$Infer.Session.user | null;
    };
}>()
    .get('/', apiKeyOrAuthMiddleware, zValidator('query', secretsQuerySchema), async (c) => {
        try {
            const user = c.get('user');
            if (!user) {
                return c.json({ error: 'Unauthorized' }, 401);
            }

            const validatedQuery = c.req.valid('query');
            const options = processSecretsQueryParams(validatedQuery);

            const [items, totalResult] = await Promise.all([
                db
                    .select({
                        id: secrets.id,
                        createdAt: secrets.createdAt,
                        expiresAt: secrets.expiresAt,
                        views: secrets.views,
                        password: secrets.password,
                        ipRange: secrets.ipRange,
                        isBurnable: secrets.isBurnable,
                    })
                    .from(secrets)
                    .where(eq(secrets.userId, user.id))
                    .orderBy(sql`${secrets.createdAt} DESC`)
                    .offset(options.skip)
                    .limit(options.take),
                db.select({ value: count() }).from(secrets).where(eq(secrets.userId, user.id)),
            ]);
            const total = Number(totalResult[0].value);

            const formattedItems = items.map((item) => ({
                id: item.id,
                createdAt: item.createdAt,
                expiresAt: item.expiresAt,
                views: item.views,
                isPasswordProtected: !!item.password,
                ipRange: item.ipRange,
                isBurnable: item.isBurnable,
                fileCount: 0, // file relationship not tracked in schema
            }));

            return c.json({
                data: formattedItems,
                meta: buildPaginationMeta(total, options.skip, options.take),
            });
        } catch (error) {
            console.error('Failed to retrieve secrets:', error);
            return c.json(
                {
                    error: 'Failed to retrieve secrets',
                },
                500
            );
        }
    })
    .post(
        '/:id',
        zValidator('param', secretsIdParamSchema),
        zValidator('json', getSecretSchema),
        ipRestriction,
        async (c) => {
            try {
                const { id } = c.req.valid('param');
                const data = c.req.valid('json');

                // Atomically retrieve secret and consume view in a single transaction
                const result = await db.transaction(async (tx) => {
                    const item = await tx.query.secrets.findFirst({
                        where: eq(secrets.id, id),
                    });

                    if (!item) {
                        return { error: 'Secret not found', status: 404 as const };
                    }

                    // Check if secret has no views remaining (already consumed)
                    if (item.views !== null && item.views <= 0) {
                        return { error: 'Secret not found', status: 404 as const };
                    }

                    // Verify password if required
                    if (item.password) {
                        const isValidPassword = await compare(data.password!, item.password);
                        if (!isValidPassword) {
                            return { error: 'Invalid password', status: 401 as const };
                        }
                    }

                    // Consume the view atomically with retrieval (null = unlimited views)
                    const newViews = item.views !== null ? item.views - 1 : null;

                    if (newViews !== null) {
                        await tx.update(secrets).set({ views: newViews }).where(eq(secrets.id, id));
                    }

                    const burned = item.isBurnable && newViews !== null && newViews <= 0;

                    if (burned) {
                        sendWebhook('secret.burned', {
                            secretId: id,
                            hasPassword: !!item.password,
                            hasIpRestriction: !!item.ipRange,
                        });
                    } else {
                        sendWebhook('secret.viewed', {
                            secretId: id,
                            hasPassword: !!item.password,
                            hasIpRestriction: !!item.ipRange,
                            viewsRemaining: newViews ?? undefined,
                        });
                    }

                    // Fetch associated files separately (no relation in schema)
                    const associatedFiles: { id: string; filename: string }[] = [];

                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { password: _password, ...itemWithoutPassword } = item;
                    return {
                        ...itemWithoutPassword,
                        files: associatedFiles,
                        views: newViews,
                        burned,
                    };
                });

                if ('error' in result) {
                    return c.json({ error: result.error }, result.status);
                }

                return c.json(result);
            } catch (error) {
                console.error(`Failed to retrieve item ${c.req.param('id')}:`, error);
                return c.json(
                    {
                        error: 'Failed to retrieve item',
                    },
                    500
                );
            }
        }
    )
    .get('/:id/check', zValidator('param', secretsIdParamSchema), ipRestriction, async (c) => {
        try {
            const { id } = c.req.valid('param');

            const item = await db.query.secrets.findFirst({
                where: eq(secrets.id, id),
                columns: {
                    id: true,
                    views: true,
                    title: true,
                    password: true,
                },
            });

            if (!item) {
                return c.json({ error: 'Secret not found' }, 404);
            }

            // Check if secret has no views remaining (already consumed)
            if (item.views !== null && item.views <= 0) {
                return c.json({ error: 'Secret not found' }, 404);
            }

            return c.json({
                views: item.views,
                title: item.title,
                isPasswordProtected: !!item.password,
            });
        } catch (error) {
            console.error(`Failed to check secret ${c.req.param('id')}:`, error);
            return c.json(
                {
                    error: 'Failed to check secret',
                },
                500
            );
        }
    })
    .post('/', zValidator('json', createSecretsSchema), async (c) => {
        try {
            const user = c.get('user');

            // Check if only registered users can create secrets
            const settings = await resolveSettings();
            if (settings?.requireRegisteredUser && !user) {
                return c.json({ error: 'Only registered users can create secrets' }, 401);
            }

            const validatedData = c.req.valid('json');

            // Enforce dynamic maxSecretSize from instance settings (in KB)
            const maxSizeKB = settings?.maxSecretSize ?? 1024;
            const maxSizeBytes = maxSizeKB * 1024;
            if (validatedData.secret.length > maxSizeBytes) {
                return c.json({ error: `Secret exceeds maximum size of ${maxSizeKB} KB` }, 413);
            }

            const { expiresAt, password, fileIds, salt, title, ...rest } = validatedData;

            const secretStr = typeof rest.secret === 'string'
                ? rest.secret
                : Buffer.from(rest.secret as Uint8Array).toString('base64');
            const titleStr = title
                ? (typeof title === 'string' ? title : Buffer.from(title as Uint8Array).toString('base64'))
                : null;

            const [item] = await db.insert(secrets).values({
                ...rest,
                secret: secretStr,
                title: titleStr,
                salt,
                password: password ? await hash(password) : null,
                expiresAt: new Date(Date.now() + expiresAt * 1000),
                ...(user ? { userId: user.id } : {}),
            }).returning();

            return c.json({ id: item.id }, 201);
        } catch (error: unknown) {
            console.error('Failed to create secrets:', error);

            // PostgreSQL unique violation
            if (error && typeof error === 'object' && 'code' in error && (error as { code: unknown }).code === '23505') {
                return c.json(
                    {
                        error: 'Could not create secrets',
                    },
                    409
                );
            }

            return c.json(
                {
                    error: 'Failed to create secret',
                },
                500
            );
        }
    })
    .delete('/:id', zValidator('param', secretsIdParamSchema), async (c) => {
        try {
            const { id } = c.req.valid('param');
            const reqUser = c.get('user');

            // Use transaction to prevent race conditions
            const result = await db.transaction(async (tx) => {
                // Get secret info before deleting for webhook and authorization
                const secretData = await tx.query.secrets.findFirst({
                    where: eq(secrets.id, id),
                    columns: { id: true, password: true, ipRange: true, userId: true, isBurnable: true },
                });

                if (!secretData) {
                    return { error: 'Secret not found', status: 404 as const };
                }

                // Check authorization: only creator can manually delete
                if (secretData.userId) {
                    const isCreator = reqUser && reqUser.id === secretData.userId;
                    if (!isCreator) {
                        return { error: 'Unauthorized to delete this secret', status: 403 as const };
                    }
                } else {
                    // Anonymous secrets cannot be manually deleted via API
                    return { error: 'Anonymous secrets cannot be manually deleted', status: 403 as const };
                }

                await tx.delete(secrets).where(eq(secrets.id, id));

                return { data: secretData };
            });

            if (result && 'error' in result) {
                return c.json({ error: result.error }, result.status);
            }

            // Send webhook for manually burned secret
            if (result && 'data' in result) {
                const secret = result.data;
                sendWebhook('secret.burned', {
                    secretId: id,
                    hasPassword: !!secret.password,
                    hasIpRestriction: !!secret.ipRange,
                });
            }

            return c.json({
                success: true,
                message: 'Secret deleted successfully',
            });
        } catch (error) {
            console.error(`Failed to delete secret ${c.req.param('id')}:`, error);
            return handleNotFound(error as Error & { code?: string }, c);
        }
    });

export default app;
