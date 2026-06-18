import { zValidator } from '@hono/zod-validator';
import { createReadStream, createWriteStream } from 'fs';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { nanoid } from 'nanoid';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { eq, sql } from 'drizzle-orm';
import { db, files } from '../../db';
import { generateSafeFilePath, getMaxFileSize, isPathSafe } from '../lib/files';
import { resolveSettings } from '../lib/settings';
import { authMiddleware } from '../middlewares/auth';
import { idParamSchema } from '../validations/shared';

const filesRoute = new Hono();

filesRoute.get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');

    try {
        // Fetch file record
        const file = await db.query.files.findFirst({ where: eq(files.id, id) });

        if (!file) {
            return c.json({ error: 'File not found' }, 404);
        }

        // Fetch secrets associated with this file via the join table _FileToSecrets
        // (A = file id, B = secret id)
        const fileSecretsResult = await db.execute(
            sql`SELECT s.id, s.views, s.expires_at FROM secrets s
                INNER JOIN "_FileToSecrets" fts ON fts."B" = s.id
                WHERE fts."A" = ${id}`
        );

        const associatedSecrets = fileSecretsResult.rows as Array<{ id: string; views: number | null; expires_at: Date }>;

        // Security: Verify the file is associated with at least one valid (non-expired) secret
        // This prevents direct file access without going through the secret viewing flow
        // We allow views >= 0 because files need to be downloadable after the last view is consumed
        // (the secret view and file download are separate requests)
        const hasValidSecret = associatedSecrets.some((secret) => {
            const now = new Date();
            const hasViewsRemaining = secret.views === null || secret.views >= 0;
            const notExpired = new Date(secret.expires_at) > now;
            return hasViewsRemaining && notExpired;
        });

        if (!hasValidSecret) {
            return c.json({ error: 'File not found' }, 404);
        }

        // Validate path is within upload directory to prevent path traversal
        if (!isPathSafe(file.path)) {
            console.error(`Path traversal attempt detected: ${file.path}`);
            return c.json({ error: 'File not found' }, 404);
        }

        // Stream the file instead of loading it entirely into memory
        const nodeStream = createReadStream(file.path);
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;

        return stream(c, async (s) => {
            s.onAbort(() => {
                nodeStream.destroy();
            });
            await s.pipe(webStream);
        });
    } catch (error) {
        console.error('Failed to download file:', error);
        return c.json({ error: 'Failed to download file' }, 500);
    }
});

filesRoute.post('/', authMiddleware, async (c) => {
    try {
        // Check if file uploads are allowed
        const instanceSettings = await resolveSettings();
        const allowFileUploads = instanceSettings?.allowFileUploads ?? true;

        if (!allowFileUploads) {
            return c.json({ error: 'File uploads are disabled on this instance.' }, 403);
        }

        const body = await c.req.parseBody();
        const file = body['file'];

        if (!(file instanceof File)) {
            return c.json({ error: 'File is required and must be a file.' }, 400);
        }

        const maxFileSize = await getMaxFileSize();
        if (file.size > maxFileSize) {
            return c.json(
                { error: `File size exceeds the limit of ${maxFileSize / 1024 / 1024}MB.` },
                413
            );
        }

        const id = nanoid();
        const safePath = generateSafeFilePath(id, file.name);

        if (!safePath) {
            console.error(`Path traversal attempt in upload: ${file.name}`);
            return c.json({ error: 'Invalid filename' }, 400);
        }

        // Stream the file to disk instead of loading it entirely into memory
        const webStream = file.stream();
        const nodeStream = Readable.fromWeb(webStream as import('stream/web').ReadableStream);
        const writeStream = createWriteStream(safePath.path);

        await pipeline(nodeStream, writeStream);

        const [newFile] = await db
            .insert(files)
            .values({ id, filename: safePath.filename, path: safePath.path })
            .returning();

        return c.json({ id: newFile.id }, 201);
    } catch (error) {
        console.error('Failed to upload file:', error);
        return c.json({ error: 'Failed to upload file' }, 500);
    }
});

export default filesRoute;
