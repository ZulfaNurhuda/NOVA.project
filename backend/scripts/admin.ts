import { db, users } from '../db';
import { eq } from 'drizzle-orm';

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error('Please provide an email address.');
        process.exit(1);
    }

    try {
        const [user] = await db.select().from(users).where(eq(users.email, email));

        if (!user) {
            console.error(`User with email "${email}" not found.`);
            process.exit(1);
        }

        await db.update(users).set({ role: 'admin' }).where(eq(users.email, email));

        console.log(`User "${email}" has been granted admin privileges.`);
    } catch (error) {
        console.error('An error occurred:', error);
        process.exit(1);
    } finally {
        await db.$client.end();
    }
}

main();
