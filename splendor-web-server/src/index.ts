import { loadGameData } from "./core/data/game-data.loader";
import { createGameServer } from "./server";

const port = Number(process.env.PORT ?? 3000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const data = loadGameData();
const server = createGameServer(data, { allowedOrigins });

server.http.listen(port, () => {
    console.log(`[server] Booty server listening on ws://localhost:${port}`);
    if (allowedOrigins.length) console.log(`[server] Allowed origins: ${allowedOrigins.join(', ')}`);
});

const shutdown = () => {
    console.log('[server] Shutting down...');
    server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
