import { serve } from '@hono/node-server';
import 'dotenv/config';
import { Hono } from 'hono';
import api from './api/app';
import config from './api/config';

const port = Number(config.get('server.port') ?? 3001);

const app = new Hono();

// Mount the API — backend serves only /api/* routes
app.route('/api', api);

function gracefulShutdown(signal: string, server: ReturnType<typeof serve>) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    const forceExitTimeout = setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 10000);
    server.close((err) => {
        clearTimeout(forceExitTimeout);
        if (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
        console.log('Server closed successfully.');
        process.exit(0);
    });
}

if (process.env.NODE_ENV === 'production') {
    const server = serve({ fetch: app.fetch, port });
    console.log(`Backend API running on port ${port}`);
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT',  () => gracefulShutdown('SIGINT',  server));
}

export default app;
