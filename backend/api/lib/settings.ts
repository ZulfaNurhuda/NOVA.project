import config from '../config';
import { db, instanceSettings } from '../../db';
import redis from './redis';

const memoryCache = new Map();

/**
 * Gets instance settings, fetching from database if not cached.
 * Uses Redis if available, otherwise falls back to memory.
 */
async function getInstanceSettings() {
    let cachedSettings = null;

    if (redis) {
        const data = await redis.get('instanceSettings');
        if (data) {
            try {
                cachedSettings = JSON.parse(data);
            } catch (e) {
                console.error('Failed to parse cached instance settings', e);
            }
        }
    } else {
        cachedSettings = memoryCache.get('instanceSettings');
    }

    if (!cachedSettings) {
        try {
            cachedSettings = await db.select().from(instanceSettings).limit(1).then(r => r[0] ?? null);
            if (cachedSettings) {
                if (redis) {
                    await redis.set('instanceSettings', JSON.stringify(cachedSettings), 'EX', 300); // 5 minutes cache
                } else {
                    memoryCache.set('instanceSettings', cachedSettings);
                }
            }
        } catch {
            // Table may not exist yet (fresh database)
            return null;
        }
    }
    return cachedSettings;
}

/**
 * Resolves instance settings from the appropriate source.
 * In managed mode, returns environment-based settings; otherwise fetches from database.
 */
export async function resolveSettings() {
    if (config.isManaged()) {
        return config.getManagedSettings();
    }
    return getInstanceSettings();
}

/**
 * Updates the cached instance settings.
 * Call this after modifying settings in the database.
 */
export async function setCachedInstanceSettings(settings: unknown) {
    if (redis) {
        await redis.set('instanceSettings', JSON.stringify(settings), 'EX', 300);
    } else {
        memoryCache.set('instanceSettings', settings);
    }
}

export default {
    resolveSettings,
    setCachedInstanceSettings
};
