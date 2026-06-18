import { Context, Next } from 'hono';
import ipRangeCheck from 'ip-range-check';
import { db, secrets } from '../../db';
import { eq } from 'drizzle-orm';
import { getClientIp } from '../lib/utils';

export const ipRestriction = async (c: Context, next: Next) => {
    const { id } = c.req.param();

    const [item] = await db
        .select({ ipRange: secrets.ipRange })
        .from(secrets)
        .where(eq(secrets.id, id));

    // If no restriction is configured, move on
    if (!item?.ipRange) {
        return next();
    }

    const ip = getClientIp(c);

    if (!ip) {
        return c.json({ error: 'Could not identify client IP' }, 400);
    }

    // The core logic is now a single, clean line
    if (!ipRangeCheck(ip, item.ipRange)) {
        return c.json({ error: 'Access restricted by IP' }, 403);
    }

    await next();
};
