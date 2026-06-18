import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, instanceSettings } from '../../db';
import config from '../config';
import { ADMIN_SETTINGS_FIELDS, PUBLIC_SETTINGS_FIELDS } from '../lib/constants';
import settings from '../lib/settings';
import { handleNotFound, isPublicUrl } from '../lib/utils';
import { authMiddleware, checkAdmin } from '../middlewares/auth';
import { instanceSettingsSchema } from '../validations/instance';

const app = new Hono();

// GET /api/instance/managed - check if instance is in managed mode
app.get('/managed', async (c) => {
    return c.json({ managed: config.isManaged() });
});

// GET /api/instance/settings/public - public settings for all users
app.get('/settings/public', async (c) => {
    try {
        // In managed mode, return settings from environment variables
        if (config.isManaged()) {
            const managedSettings = config.getManagedSettings();
            const publicSettings = Object.fromEntries(
                Object.entries(managedSettings || {}).filter(
                    ([key]) => key in PUBLIC_SETTINGS_FIELDS
                )
            );
            return c.json(publicSettings);
        }

        let dbSettings = await db.query.instanceSettings.findFirst({
            columns: PUBLIC_SETTINGS_FIELDS as any,
        });

        if (!dbSettings) {
            const initialData = {
                ...Object.fromEntries(
                    Object.entries(config.get('general') as Record<string, unknown>).filter(([, v]) => v !== undefined)
                ),
                ...Object.fromEntries(
                    Object.entries(config.get('security') as Record<string, unknown>).filter(([, v]) => v !== undefined)
                ),
            };

            const [inserted] = await db.insert(instanceSettings).values(initialData as any).returning();
            dbSettings = inserted as any;
        }

        const configSettings = {
            ...(config.get('general') as Record<string, unknown>),
            ...(config.get('security') as Record<string, unknown>),
        };
        const filteredConfigSettings = Object.fromEntries(
            Object.entries(configSettings).filter(
                ([key, value]) => value !== undefined && value !== '' && key in PUBLIC_SETTINGS_FIELDS
            )
        );

        const finalSettings = {
            ...dbSettings,
            ...filteredConfigSettings,
        };

        return c.json(finalSettings);
    } catch (error) {
        console.error('Failed to fetch public instance settings:', error);
        return c.json({ error: 'Failed to fetch instance settings' }, 500);
    }
});

// GET /api/instance/settings - admin only
app.get('/settings', authMiddleware, checkAdmin, async (c) => {
    try {
        // In managed mode, return settings from environment variables
        if (config.isManaged()) {
            const managedSettings = config.getManagedSettings();
            return c.json(managedSettings);
        }

        let dbSettings = await db.query.instanceSettings.findFirst({
            columns: ADMIN_SETTINGS_FIELDS as any,
        });

        if (!dbSettings) {
            const initialData = {
                ...Object.fromEntries(
                    Object.entries(config.get('general') as Record<string, unknown>).filter(([, v]) => v !== undefined)
                ),
                ...Object.fromEntries(
                    Object.entries(config.get('security') as Record<string, unknown>).filter(([, v]) => v !== undefined)
                ),
            };

            const [inserted] = await db.insert(instanceSettings).values(initialData as any).returning();
            dbSettings = inserted as any;
        }

        const configSettings = {
            ...(config.get('general') as Record<string, unknown>),
            ...(config.get('security') as Record<string, unknown>),
        };
        const filteredConfigSettings = Object.fromEntries(
            Object.entries(configSettings).filter(([, value]) => value !== undefined && value !== '')
        );

        const finalSettings = {
            ...dbSettings,
            ...filteredConfigSettings,
        };

        return c.json(finalSettings);
    } catch (error) {
        console.error('Failed to fetch instance settings:', error);
        return c.json({ error: 'Failed to fetch instance settings' }, 500);
    }
});

// PUT /api/instance/settings
app.put(
    '/settings',
    authMiddleware,
    checkAdmin,
    zValidator('json', instanceSettingsSchema),
    async (c) => {
        // Block updates in managed mode
        if (config.isManaged()) {
            return c.json(
                { error: 'Instance is in managed mode. Settings cannot be modified.' },
                403
            );
        }

        const body = c.req.valid('json');

        if (body.webhookUrl && body.webhookUrl !== '' && !(await isPublicUrl(body.webhookUrl))) {
            return c.json({ error: 'Webhook URL cannot point to private/internal addresses' }, 400);
        }

        try {
            const existingSettings = await db.query.instanceSettings.findFirst();

            if (!existingSettings) {
                return c.json({ error: 'Instance settings not found' }, 404);
            }

            const [updatedSettings] = await db
                .update(instanceSettings)
                .set(body as any)
                .where(eq(instanceSettings.id, existingSettings.id))
                .returning();

            const currentSettings = await settings.resolveSettings();
            await settings.setCachedInstanceSettings({
                ...currentSettings,
                ...updatedSettings,
            });

            return c.json(updatedSettings);
        } catch (error) {
            console.error('Failed to update instance settings:', error);
            return handleNotFound(error as Error & { code?: string }, c);
        }
    }
);

export default app;
