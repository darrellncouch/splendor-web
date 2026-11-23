import { createServer, Server } from "http";
import { IGameData } from "./core/interfaces/game-data.interface";
import { GameHub, IGameHubOptions } from "./hub/game.hub";
import { RoomRegistry } from "./hub/room.registry";

export interface IGameServer {
    http: Server;
    hub: GameHub;
    rooms: RoomRegistry;
    close(): Promise<void>;
}

/** Sets up the HTTP server (only for the health check) with the websocket hub attached. Doesn't start listening. */
export function createGameServer(data: IGameData, options: IGameHubOptions = {}): IGameServer {
    const rooms = new RoomRegistry(data);

    const http = createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, rooms: rooms.count }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Splendor Web game server. Connect with a WebSocket.');
    });

    const hub = new GameHub(http, rooms, options);

    return {
        http,
        hub,
        rooms,
        close: () => new Promise<void>(resolve => {
            hub.close();
            http.close(() => resolve());
        }),
    };
}
