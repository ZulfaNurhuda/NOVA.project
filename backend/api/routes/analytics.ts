import { zValidator } from '@hono/zod-validator';
import { and, count, desc, gte, gt, isNotNull, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { isbot } from 'isbot';
import { z } from 'zod';
import {
    calculatePercentage,
    createVisitorId,
    getStartDateForTimeRange,
    isAnalyticsEnabled,
    isValidAnalyticsPath,
} from '../lib/analytics';
import { getClientIp } from '../lib/utils';
import { authMiddleware, checkAdmin } from '../middlewares/auth';
import { db, secrets, secretRequests, visitorAnalytics } from '../../db';

const app = new Hono();

const trackSchema = z.object({
    path: z.string().max(255),
});

const timeRangeSchema = z.object({
    timeRange: z.enum(['7d', '14d', '30d']).default('30d'),
});

// POST /api/analytics/track - Public endpoint for visitor tracking
app.post('/track', zValidator('json', trackSchema), async (c) => {
    if (!isAnalyticsEnabled()) {
        return c.json({ success: false }, 403);
    }

    const userAgent = c.req.header('user-agent') || '';

    if (isbot(userAgent)) {
        return c.json({ success: false }, 403);
    }

    try {
        const { path } = c.req.valid('json');

        if (!isValidAnalyticsPath(path)) {
            return c.json({ error: 'Invalid path format' }, 400);
        }

        const uniqueId = createVisitorId(getClientIp(c), userAgent);

        await db.insert(visitorAnalytics).values({ path, uniqueId });

        return c.json({ success: true }, 201);
    } catch (error) {
        console.error('Analytics tracking error:', error);
        return c.json({ error: 'Failed to track analytics' }, 500);
    }
});

// GET /api/analytics - Secret analytics (admin only)
app.get('/', authMiddleware, checkAdmin, zValidator('query', timeRangeSchema), async (c) => {
    const { timeRange } = c.req.valid('query');
    const now = new Date();
    const startDate = getStartDateForTimeRange(timeRange);

    try {
        // Use aggregations for basic counts - much more efficient than loading all records
        const [
            totalSecretsResult,
            totalViewsResult,
            activeCountResult,
            passwordCountResult,
            ipCountResult,
            burnableCountResult,
            dailyStats,
            totalSecretRequestsResult,
            fulfilledSecretRequestsResult,
        ] = await Promise.all([
            db.select({ value: count() }).from(secrets).where(gte(secrets.createdAt, startDate)),
            db.execute<{ total_views: number }>(sql`SELECT COALESCE(SUM(views), 0) as total_views FROM secrets WHERE created_at >= ${startDate}`),
            db.select({ value: count() }).from(secrets).where(and(gte(secrets.createdAt, startDate), gt(secrets.expiresAt, now))),
            db.select({ value: count() }).from(secrets).where(and(gte(secrets.createdAt, startDate), isNotNull(secrets.password))),
            db.select({ value: count() }).from(secrets).where(and(gte(secrets.createdAt, startDate), isNotNull(secrets.ipRange), ne(secrets.ipRange, ''))),
            db.select({ value: count() }).from(secrets).where(and(gte(secrets.createdAt, startDate), sql`is_burnable = true`)),
            db.select({ createdAt: secrets.createdAt, views: secrets.views, expiresAt: secrets.expiresAt }).from(secrets).where(gte(secrets.createdAt, startDate)),
            db.select({ value: count() }).from(secretRequests).where(gte(secretRequests.createdAt, startDate)),
            db.select({ value: count() }).from(secretRequests).where(and(gte(secretRequests.createdAt, startDate), sql`status = 'fulfilled'`)),
        ]);

        const totalSecrets = Number(totalSecretsResult[0].value);
        const viewRows = totalViewsResult.rows ?? (totalViewsResult as unknown as Array<{ total_views: number }>);
        const totalViews = Number(viewRows[0]?.total_views ?? 0);
        const activeSecrets = Number(activeCountResult[0].value);
        const expiredSecrets = totalSecrets - activeSecrets;
        const passwordProtected = Number(passwordCountResult[0].value);
        const ipRestricted = Number(ipCountResult[0].value);
        const burnable = Number(burnableCountResult[0].value);
        const totalSecretRequests = Number(totalSecretRequestsResult[0].value);
        const fulfilledSecretRequests = Number(fulfilledSecretRequestsResult[0].value);
        const averageViews = totalSecrets > 0 ? totalViews / totalSecrets : 0;

        // Process daily stats from minimal data
        const dailyStatsMap = dailyStats.reduce(
            (acc, secret) => {
                const date = secret.createdAt.toISOString().split('T')[0];
                if (!acc[date]) {
                    acc[date] = { date, secrets: 0, views: 0 };
                }
                acc[date].secrets++;
                acc[date].views += secret.views || 0;
                return acc;
            },
            {} as Record<string, { date: string; secrets: number; views: number }>
        );

        // Calculate expiration stats from minimal data
        const expirationDurations = dailyStats.map(
            (s) => (s.expiresAt.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60)
        );
        const oneHour = expirationDurations.filter((d) => d <= 1).length;
        const oneDay = expirationDurations.filter((d) => d > 1 && d <= 24).length;
        const oneWeekPlus = expirationDurations.filter((d) => d > 24).length;

        return c.json({
            totalSecrets,
            totalViews,
            activeSecrets,
            expiredSecrets,
            averageViews: parseFloat(averageViews.toFixed(2)),
            dailyStats: Object.values(dailyStatsMap),
            secretTypes: {
                passwordProtected: calculatePercentage(passwordProtected, totalSecrets),
                ipRestricted: calculatePercentage(ipRestricted, totalSecrets),
                burnable: calculatePercentage(burnable, totalSecrets),
            },
            expirationStats: {
                oneHour: calculatePercentage(oneHour, totalSecrets),
                oneDay: calculatePercentage(oneDay, totalSecrets),
                oneWeekPlus: calculatePercentage(oneWeekPlus, totalSecrets),
            },
            secretRequests: {
                total: totalSecretRequests,
                fulfilled: fulfilledSecretRequests,
            },
        });
    } catch (error) {
        console.error('Failed to fetch analytics data:', error);
        return c.json({ error: 'Failed to fetch analytics data' }, 500);
    }
});

// GET /api/analytics/visitors - Visitor analytics data (admin only)
app.get('/visitors', authMiddleware, checkAdmin, async (c) => {
    try {
        const analytics = await db
            .select()
            .from(visitorAnalytics)
            .orderBy(desc(visitorAnalytics.timestamp))
            .limit(1000);
        return c.json(analytics);
    } catch (error) {
        console.error('Analytics retrieval error:', error);
        return c.json({ error: 'Failed to retrieve analytics' }, 500);
    }
});

// GET /api/analytics/visitors/unique - Aggregated unique visitor data (admin only)
app.get('/visitors/unique', authMiddleware, checkAdmin, async (c) => {
    try {
        const aggregatedData = await db
            .select({
                uniqueId: visitorAnalytics.uniqueId,
                path: visitorAnalytics.path,
                count: count(visitorAnalytics.uniqueId),
            })
            .from(visitorAnalytics)
            .groupBy(visitorAnalytics.uniqueId, visitorAnalytics.path)
            .orderBy(desc(count(visitorAnalytics.uniqueId)));
        return c.json(aggregatedData);
    } catch (error) {
        console.error('Aggregated analytics retrieval error:', error);
        return c.json({ error: 'Failed to retrieve aggregated analytics' }, 500);
    }
});

// GET /api/analytics/visitors/daily - Daily visitor statistics (admin only)
app.get(
    '/visitors/daily',
    authMiddleware,
    checkAdmin,
    zValidator('query', timeRangeSchema),
    async (c) => {
        try {
            const { timeRange } = c.req.valid('query');
            const startDate = getStartDateForTimeRange(timeRange);

            // Use raw SQL for efficient database-level aggregation
            // This avoids loading all records into memory for high-traffic instances
            const rawData = await db.execute<{
                date: string;
                unique_visitors: bigint;
                total_visits: bigint;
                paths: string;
            }>(sql`
            SELECT
                DATE(timestamp) as date,
                COUNT(DISTINCT "uniqueId") as unique_visitors,
                COUNT(*) as total_visits,
                STRING_AGG(DISTINCT path, ',') as paths
            FROM visitor_analytics
            WHERE timestamp >= ${startDate}
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `);
            const aggregatedData = rawData.rows ?? (rawData as unknown as Array<{ date: string; unique_visitors: bigint; total_visits: bigint; paths: string }>);

            // Convert BigInt to number for JSON serialization
            const result = aggregatedData.map((row) => ({
                date: row.date,
                unique_visitors: Number(row.unique_visitors),
                total_visits: Number(row.total_visits),
                paths: row.paths || '',
            }));

            return c.json(result);
        } catch (error) {
            console.error('Daily analytics retrieval error:', error);
            return c.json({ error: 'Failed to retrieve daily analytics' }, 500);
        }
    }
);

export default app;
