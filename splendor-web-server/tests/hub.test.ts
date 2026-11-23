import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { WebSocket } from "ws";
import { createGameServer, IGameServer } from "../src/server";
import { testData } from "./helpers";

/** A test client that queues incoming messages and can wait for one of a given type. */
class Client {
    private queue: Array<any> = [];
    private waiters: Array<{ match: (m: any) => boolean; resolve: (m: any) => void }> = [];
    readonly ws: WebSocket;

    constructor(url: string) {
        this.ws = new WebSocket(url);
        this.ws.on('message', data => {
            const msg = JSON.parse(data.toString());
            const i = this.waiters.findIndex(w => w.match(msg));
            if (i >= 0) this.waiters.splice(i, 1)[0].resolve(msg);
            else this.queue.push(msg);
        });
    }

    open(): Promise<void> {
        return new Promise((res, rej) => { this.ws.once('open', () => res()); this.ws.once('error', rej); });
    }

    send(msg: object): void {
        this.ws.send(JSON.stringify(msg));
    }

    next(match: (m: any) => boolean, timeoutMs = 2000): Promise<any> {
        const i = this.queue.findIndex(match);
        if (i >= 0) return Promise.resolve(this.queue.splice(i, 1)[0]);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs);
            this.waiters.push({ match, resolve: m => { clearTimeout(timer); resolve(m); } });
        });
    }

    /** Throws away queued messages so the next `next()` only sees new ones. */
    drain(): void {
        this.queue = [];
    }

    close(): void {
        this.ws.close();
    }
}

const ofType = (type: string) => (m: any) => m.type === type;

describe('GameHub over websockets', () => {
    let server: IGameServer;
    let url: string;

    before(async () => {
        server = createGameServer(testData());
        await new Promise<void>(r => server.http.listen(0, r));
        url = `ws://127.0.0.1:${(server.http.address() as AddressInfo).port}`;
    });

    after(async () => {
        await server.close();
    });

    it('runs lobby -> game -> action -> rejoin end to end', async () => {
        const host = new Client(url);
        await host.open();
        host.send({ type: 'host:create' });
        const created = await host.next(ofType('room:created'));
        assert.match(created.roomCode, /^[A-Z]{4}$/);

        const alice = new Client(url);
        const bob = new Client(url);
        await Promise.all([alice.open(), bob.open()]);

        alice.send({ type: 'player:join', roomCode: created.roomCode.toLowerCase(), name: 'Alice' });
        const aliceJoined = await alice.next(ofType('player:joined'));
        bob.send({ type: 'player:join', roomCode: created.roomCode, name: 'alice' });
        assert.match((await bob.next(ofType('error'))).message, /already has that name/);
        bob.send({ type: 'player:join', roomCode: created.roomCode, name: 'Bob' });
        const bobJoined = await bob.next(ofType('player:joined'));

        // Bob isn't the VIP, so he can't start the game
        bob.send({ type: 'game:start', requestId: 7 });
        const denied = await bob.next(ofType('error'));
        assert.equal(denied.requestId, 7);

        host.drain(); alice.drain(); bob.drain();
        alice.send({ type: 'game:start' }); // Alice is the VIP
        const hostState = await host.next(m => m.type === 'state' && m.board.phase === 'playing');
        assert.equal(hostState.role, 'host');
        assert.equal(hostState.board.players.length, 2);
        assert.equal(hostState.board.market.length, 3);

        const aliceState = await alice.next(m => m.type === 'state' && m.board.phase === 'playing');
        const bobState = await bob.next(m => m.type === 'state' && m.board.phase === 'playing');
        const firstId: string = hostState.board.currentPlayerId;
        const [first, firstState, second] = firstId === aliceJoined.playerId
            ? [alice, aliceState, bob] : [bob, bobState, alice];
        assert.equal(firstState.actions.isYourTurn, true);
        assert.equal((first === alice ? bobState : aliceState).actions.canTakeGems, false);

        // Out-of-turn move is rejected
        second.send({ type: 'action', action: { type: 'takeGems', gems: [{ id: 'white', count: 1 }, { id: 'blue', count: 1 }, { id: 'red', count: 1 }] } });
        assert.match((await second.next(ofType('error'))).message, /not your turn/);

        // A legal move goes out to everyone
        host.drain(); first.drain(); second.drain();
        first.send({ type: 'action', action: { type: 'takeGems', gems: [{ id: 'white', count: 1 }, { id: 'blue', count: 1 }, { id: 'red', count: 1 }] } });
        const afterHost = await host.next(ofType('state'));
        const afterSecond = await second.next(ofType('state'));
        assert.notEqual(afterHost.board.currentPlayerId, firstId);
        assert.equal(afterSecond.actions.isYourTurn, true);
        assert.equal(afterHost.board.players.find((p: any) => p.id === firstId).gemTotal, 3);

        // Bob drops and rejoins with his token
        bob.close();
        const disconnected = await host.next(m => m.type === 'state' && m.board.players.some((p: any) => !p.connected));
        assert.ok(disconnected);
        const bob2 = new Client(url);
        await bob2.open();
        bob2.send({ type: 'player:rejoin', roomCode: created.roomCode, sessionToken: bobJoined.sessionToken });
        assert.equal((await bob2.next(ofType('player:joined'))).playerId, bobJoined.playerId);
        await host.next(m => m.type === 'state' && m.board.players.every((p: any) => p.connected));

        // Bad input is rejected without crashing the server
        bob2.send({ type: 'action', action: { type: 'takeGems', gems: 'lol' } });
        assert.match((await bob2.next(ofType('error'))).message, /must be a list/);
        bob2.ws.send('not json');
        assert.match((await bob2.next(ofType('error'))).message, /valid JSON/);

        [host, alice, bob2].forEach(c => c.close());
    });

    it('lets the host reconnect with its token', async () => {
        const host = new Client(url);
        await host.open();
        host.send({ type: 'host:create' });
        const created = await host.next(ofType('room:created'));
        host.close();

        const host2 = new Client(url);
        await host2.open();
        host2.send({ type: 'host:rejoin', roomCode: created.roomCode, hostToken: 'wrong' });
        await host2.next(ofType('error'));
        host2.send({ type: 'host:rejoin', roomCode: created.roomCode, hostToken: created.hostToken });
        await host2.next(ofType('room:hosting'));
        const state = await host2.next(ofType('state'));
        assert.equal(state.board.phase, 'lobby');
        host2.close();
    });
});
