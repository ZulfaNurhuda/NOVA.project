import { zValidator } from '@hono/zod-validator';
import { createHash, randomBytes } from 'crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, count, desc } from 'drizzle-orm';
import { db, apiKeys } from '../../db';
import { auth } from '../auth';
import { handleNotFound } from '../lib/utils';
import { sendWebhook } from '../lib/webhook';
import { authMiddleware } from '../middlewares/auth';
import { idParamSchema } from '../validations/shared';

const createApiKeySchema = z.object({
    name: z.string().min(1).max(100),
    expiresInDays: z.number().int().min(1).max(365).optional(),
});

function hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): string {
    const prefix = 'nova';
    const key = randomBytes(24).toString('base64url');
    return `${prefix}_${key}`;
}

const app = new Hono<{
    Variables: {
        user: typeof auth.$Infer.Session.user | null;
    };
}>()
    .use(authMiddleware)
    .get('/', async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        try {
            const userApiKeys = await db
                .select({
                    id: apiKeys.id,
                    name: apiKeys.name,
                    keyPrefix: apiKeys.keyPrefix,
                    lastUsedAt: apiKeys.lastUsedAt,
                    expiresAt: apiKeys.expiresAt,
                    createdAt: apiKeys.createdAt,
                })
                .from(apiKeys)
                .where(eq(apiKeys.userId, user.id))
                .orderBy(desc(apiKeys.createdAt));

            return c.json(userApiKeys);
        } catch (error) {
            console.error('Failed to list API keys:', error);
            return c.json({ error: 'Failed to list API keys' }, 500);
        }
    })
    .post('/', zValidator('json', createApiKeySchema), async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const { name, expiresInDays } = c.req.valid('json');

        try {
            // Check API key limit (max 5 per user)
            const [{ value: existingCount }] = await db
                .select({ value: count() })
                .from(apiKeys)
                .where(eq(apiKeys.userId, user.id));

            if (existingCount >= 5) {
                return c.json({ error: 'Maximum API key limit reached (5)' }, 400);
            }

            const rawKey = generateApiKey();
            const keyHash = hashApiKey(rawKey);
            const keyPrefix = rawKey.substring(0, 16);

            const expiresAt = expiresInDays
                ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
                : null;

            const [newApiKey] = await db
                .insert(apiKeys)
                .values({
                    name,
                    keyHash,
                    keyPrefix,
                    userId: user.id,
                    expiresAt,
                })
                .returning({
                    id: apiKeys.id,
                    name: apiKeys.name,
                    keyPrefix: apiKeys.keyPrefix,
                    expiresAt: apiKeys.expiresAt,
                    createdAt: apiKeys.createdAt,
                });

            // Send webhook for API key creation
            sendWebhook('apikey.created', {
                apiKeyId: newApiKey.id,
                name: newApiKey.name,
                expiresAt: newApiKey.expiresAt?.toISOString() || null,
                userId: user.id,
            });

            // Return the raw key only once - it cannot be retrieved again
            return c.json(
                {
                    ...newApiKey,
                    key: rawKey,
                },
                201
            );
        } catch (error) {
            console.error('Failed to create API key:', error);
            return c.json({ error: 'Failed to create API key' }, 500);
        }
    })
    .delete('/:id', zValidator('param', idParamSchema), async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const { id } = c.req.valid('param');

        try {
            // Ensure the API key belongs to the user
            const apiKey = await db.query.apiKeys.findFirst({
                where: and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)),
            });

            if (!apiKey) {
                return c.json({ error: 'API key not found' }, 404);
            }

            await db.delete(apiKeys).where(eq(apiKeys.id, id));

            return c.json({ success: true });
        } catch (error) {
            console.error('Failed to delete API key:', error);
            return handleNotFound(error as Error & { code?: string }, c);
        }
    });

export default app;
