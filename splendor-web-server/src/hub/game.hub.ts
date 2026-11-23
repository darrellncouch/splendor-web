import type { IncomingMessage, Server } from "http";
import { RawData, WebSocket, WebSocketServer } from "ws";
import { GameRuleError } from "../core/errors/game-rule.error";
import { ClientMessage, parseClientMessage, ServerMessage } from "./protocol";
import { IRoom, RoomRegistry } from "./room.registry";

interface IConnection {
    id: number;
    socket: WebSocket;
    alive: boolean;
    role: 'host' | 'player' | null;
    roomCode: string | null;
    playerId: string | null;
}

export interface IGameHubOptions {
    /** If set, only browser Origins in this list may connect (for example your GitHub Pages URL and the host app). */
    allowedOrigins?: Array<string>;
    heartbeatMs?: number;
    roomIdleMs?: number;
}

/**
 * Websocket entry point. It parses messages, works out who sent them, calls the room's
 * GameEngine, then sends every connection in that room its updated view.
 * There are no game rules in here.
 */
export class GameHub {

    private readonly wss: WebSocketServer;
    private readonly connections = new Set<IConnection>();
    private readonly timers: Array<NodeJS.Timeout> = [];
    private nextConnectionId = 1;

    constructor(server: Server, private readonly rooms: RoomRegistry, private readonly options: IGameHubOptions = {}) {
        this.wss = new WebSocketServer({
            server,
            maxPayload: 16 * 1024,
            verifyClient: (info: { origin: string; req: IncomingMessage }) => this.isOriginAllowed(info.origin),
        });
        this.wss.on('connection', socket => this.onConnection(socket));

        this.timers.push(setInterval(() => this.heartbeat(), options.heartbeatMs ?? 30_000));
        this.timers.push(setInterval(() => this.cleanupRooms(), 5 * 60_000));
    }

    public close(): void {
        this.timers.forEach(clearInterval);
        this.connections.forEach(c => c.socket.terminate());
        this.wss.close();
    }

    // ---------- connection lifecycle ----------

    private onConnection(socket: WebSocket): void {
        const conn: IConnection = { id: this.nextConnectionId++, socket, alive: true, role: null, roomCode: null, playerId: null };
        this.connections.add(conn);

        socket.on('pong', () => conn.alive = true);
        socket.on('message', (data, isBinary) => this.onMessage(conn, data, isBinary));
        socket.on('close', () => this.onClose(conn));
        socket.on('error', err => console.warn(`[hub] socket ${conn.id} error:`, err.message));
    }

    private onClose(conn: IConnection): void {
        this.connections.delete(conn);
        const room = conn.roomCode ? this.rooms.get(conn.roomCode) : undefined;
        if (!room) return;

        if (conn.role === 'player' && conn.playerId) {
            room.engine.setPlayerConnected(conn.playerId, this.isPlayerOnline(room.code, conn.playerId));
        }
        this.broadcast(room);
    }

    private heartbeat(): void {
        for (const conn of this.connections) {
            if (!conn.alive) {
                conn.socket.terminate();
                continue;
            }
            conn.alive = false;
            conn.socket.ping();
        }
    }

    private cleanupRooms(): void {
        const removed = this.rooms.cleanup(this.options.roomIdleMs ?? 60 * 60_000, code => this.roomConnections(code).length > 0);
        if (removed.length) console.log(`[hub] Closed idle rooms: ${removed.join(', ')}`);
    }

    // ---------- message handling ----------

    private onMessage(conn: IConnection, data: RawData, isBinary: boolean): void {
        let requestId: string | number | undefined;
        try {
            if (isBinary) throw new GameRuleError("Binary frames are not supported");
            const parsed = parseClientMessage(data.toString());
            requestId = parsed.requestId;
            this.handle(conn, parsed.message);
        } catch (err) {
            if (err instanceof GameRuleError) {
                this.send(conn, { type: 'error', message: err.message, requestId });
            } else {
                console.error(`[hub] Unexpected error handling message from ${conn.id}:`, err);
                this.send(conn, { type: 'error', message: "Something went wrong on the server", requestId });
            }
        }
    }

    private handle(conn: IConnection, msg: ClientMessage): void {
        switch (msg.type) {
            case 'ping':
                return this.send(conn, { type: 'pong' });

            case 'host:create': {
                this.assertNotInRoom(conn);
                const room = this.rooms.create();
                this.attach(conn, room, 'host', null);
                console.log(`[hub] Room ${room.code} created`);
                this.send(conn, { type: 'room:created', roomCode: room.code, hostToken: room.hostToken });
                return this.broadcast(room);
            }

            case 'host:rejoin': {
                this.assertNotInRoom(conn);
                const room = this.rooms.require(msg.roomCode);
                if (room.hostToken !== msg.hostToken)
                    throw new GameRuleError("Invalid host token for that room");
                this.attach(conn, room, 'host', null);
                this.send(conn, { type: 'room:hosting', roomCode: room.code });
                return this.sendState(conn, room);
            }

            case 'player:join': {
                this.assertNotInRoom(conn);
                const room = this.rooms.require(msg.roomCode);
                const player = room.engine.addPlayer(msg.name);
                this.attach(conn, room, 'player', player.id);
                this.send(conn, { type: 'player:joined', roomCode: room.code, playerId: player.id, sessionToken: player.sessionToken, name: player.name });
                return this.broadcast(room);
            }

            case 'player:rejoin': {
                this.assertNotInRoom(conn);
                const room = this.rooms.require(msg.roomCode);
                const player = room.engine.rejoin(msg.sessionToken);

                // Only one live socket per seat: the newest tab or device takes over.
                this.roomConnections(room.code)
                    .filter(c => c.playerId === player.id)
                    .forEach(c => this.evict(c, "You connected from another tab or device"));

                this.attach(conn, room, 'player', player.id);
                room.engine.setPlayerConnected(player.id, true);
                this.send(conn, { type: 'player:joined', roomCode: room.code, playerId: player.id, sessionToken: player.sessionToken, name: player.name });
                return this.broadcast(room);
            }

            case 'player:leave': {
                const { room, playerId } = this.requirePlayer(conn);
                if (room.engine.state.phase !== 'playing')
                    room.engine.removePlayer(playerId);
                this.evict(conn, "You left the room");
                room.engine.setPlayerConnected(playerId, this.isPlayerOnline(room.code, playerId));
                return this.broadcast(room);
            }

            case 'host:kick': {
                const room = this.requireHost(conn);
                room.engine.removePlayer(msg.playerId);
                this.roomConnections(room.code)
                    .filter(c => c.playerId === msg.playerId)
                    .forEach(c => this.evict(c, "You were removed from the room"));
                return this.broadcast(room);
            }

            case 'game:start': {
                const room = this.requireHostOrVip(conn);
                room.engine.start();
                return this.broadcast(room);
            }

            case 'game:reset': {
                const room = this.requireHostOrVip(conn);
                room.engine.resetToLobby();
                return this.broadcast(room);
            }

            case 'action': {
                const { room, playerId } = this.requirePlayer(conn);
                room.engine.performAction(playerId, msg.action);
                return this.broadcast(room);
            }

            case 'state:request': {
                const room = this.requireRoom(conn);
                return this.sendState(conn, room);
            }
        }
    }

    // ---------- membership helpers ----------

    private attach(conn: IConnection, room: IRoom, role: 'host' | 'player', playerId: string | null): void {
        conn.role = role;
        conn.roomCode = room.code;
        conn.playerId = playerId;
        this.rooms.touch(room);
    }

    /** Detaches a connection from its room, tells it why, and keeps the socket open so it can join again. */
    private evict(conn: IConnection, reason: string): void {
        conn.role = null;
        conn.roomCode = null;
        conn.playerId = null;
        this.send(conn, { type: 'removed', reason });
    }

    private assertNotInRoom(conn: IConnection): void {
        if (conn.roomCode)
            throw new GameRuleError("This connection is already in a room");
    }

    private requireRoom(conn: IConnection): IRoom {
        const room = conn.roomCode ? this.rooms.get(conn.roomCode) : undefined;
        if (!room)
            throw new GameRuleError("You are not in a room");
        this.rooms.touch(room);
        return room;
    }

    private requireHost(conn: IConnection): IRoom {
        const room = this.requireRoom(conn);
        if (conn.role !== 'host')
            throw new GameRuleError("Only the host can do that");
        return room;
    }

    private requirePlayer(conn: IConnection): { room: IRoom; playerId: string } {
        const room = this.requireRoom(conn);
        if (conn.role !== 'player' || !conn.playerId)
            throw new GameRuleError("Only players can do that");
        return { room, playerId: conn.playerId };
    }

    private requireHostOrVip(conn: IConnection): IRoom {
        const room = this.requireRoom(conn);
        const allowed = conn.role === 'host' || (conn.playerId !== null && room.engine.isVip(conn.playerId));
        if (!allowed)
            throw new GameRuleError("Only the host or the VIP can do that");
        return room;
    }

    private roomConnections(code: string): Array<IConnection> {
        return [...this.connections].filter(c => c.roomCode === code);
    }

    private isPlayerOnline(code: string, playerId: string): boolean {
        return this.roomConnections(code).some(c => c.playerId === playerId);
    }

    private isOriginAllowed(origin: string | undefined): boolean {
        const allowed = this.options.allowedOrigins;
        if (!allowed || allowed.length === 0) return true;
        // Non-browser clients (scripts, tests) send no Origin header
        return !origin || allowed.includes(origin);
    }

    // ---------- sending ----------

    private broadcast(room: IRoom): void {
        this.roomConnections(room.code).forEach(conn => this.sendState(conn, room));
    }

    private sendState(conn: IConnection, room: IRoom): void {
        if (conn.role === 'host') {
            this.send(conn, { type: 'state', role: 'host', board: room.engine.getBoard() });
        } else if (conn.role === 'player' && conn.playerId) {
            const view = room.engine.getPlayerView(conn.playerId);
            if (view) this.send(conn, { type: 'state', role: 'player', ...view });
        }
    }

    private send(conn: IConnection, message: ServerMessage): void {
        if (conn.socket.readyState === WebSocket.OPEN)
            conn.socket.send(JSON.stringify(message));
    }
}
