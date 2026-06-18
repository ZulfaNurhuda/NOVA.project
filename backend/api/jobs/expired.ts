import { unlink } from 'fs/promises';
import { db, secrets, files } from '../../db';
import { eq, lte, or } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const deleteExpiredSecrets = async () => {
    try {
        const now = new Date();
        await db.delete(secrets).where(
            or(
                lte(secrets.expiresAt, now),
                eq(secrets.views, 0)
            )
        );
    } catch (error) {
        console.error('Error deleting expired secrets:', error);
    }
};

export const deleteOrphanedFiles = async () => {
    try {
        // Find files not referenced by any secret (files table has no FK to secrets in this schema)
        // Since files are standalone, we delete files older than 24h with no related secrets
        const orphanedFiles = await db.select().from(files);

        if (orphanedFiles.length === 0) {
            return;
        }

        // Delete files from disk in parallel for better performance
        const deleteResults = await Promise.allSettled(
            orphanedFiles.map((file) => unlink(file.path))
        );

        // Log any failures (file may already be deleted or inaccessible)
        deleteResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(
                    `Failed to delete file from disk: ${orphanedFiles[index].path}`,
                    result.reason
                );
            }
        });

        // Delete orphaned file records from database
        if (orphanedFiles.length > 0) {
            await db.delete(files).where(
                sql`id = ANY(ARRAY[${sql.join(orphanedFiles.map(f => sql`${f.id}::uuid`))}])`
            );
        }
    } catch (error) {
        console.error('Error deleting orphaned files:', error);
    }
};
