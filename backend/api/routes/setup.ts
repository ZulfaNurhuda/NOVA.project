import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { eq, count } from 'drizzle-orm';
import { db, users, instanceSettings } from '../../db';
import { auth } from '../auth';
import { passwordSchema } from '../validations/password';

const setupSchema = z.object({
    email: z.string().email(),
    password: passwordSchema,
    username: z.string().min(3).max(32),
    name: z.string().min(1).max(100),
});

const app = new Hono()
    // Check if setup is needed (no users exist)
    .get('/status', async (c) => {
        try {
            const [{ value: userCount }] = await db.select({ value: count() }).from(users);
            return c.json({
                needsSetup: userCount === 0,
            });
        } catch (error) {
            console.error('Failed to check setup status:', error);
            return c.json({ error: 'Failed to check setup status' }, 500);
        }
    })
    // Complete initial setup - create first admin user
    .post('/complete', zValidator('json', setupSchema), async (c) => {
        try {
            // Check if any users already exist
            const [{ value: userCount }] = await db.select({ value: count() }).from(users);
            if (userCount > 0) {
                return c.json({ error: 'Setup already completed' }, 403);
            }

            const { email, password, username, name } = c.req.valid('json');

            // Create the admin user using better-auth
            // Cast body to any because the username plugin extends the type at runtime
            const result = await auth.api.signUpEmail({
                body: {
                    email,
                    password,
                    name,
                    username,
                } as any,
            });

            if (!result.user) {
                return c.json({ error: 'Failed to create admin user' }, 500);
            }

            // Update user to be admin
            await db.update(users).set({ role: 'admin' }).where(eq(users.id, result.user.id));

            // Create initial instance settings if not exists
            const existingSettings = await db.query.instanceSettings.findFirst();
            if (!existingSettings) {
                await db.insert(instanceSettings).values({}).returning();
            }

            return c.json({
                success: true,
                message: 'Setup completed successfully',
            });
        } catch (error) {
            console.error('Failed to complete setup:', error);
            return c.json(
                {
                    error: 'Failed to complete setup',
                },
                500
            );
        }
    });

export default app;
