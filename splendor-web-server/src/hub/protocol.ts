import { GameRuleError } from "../core/errors/game-rule.error";
import { IBoard } from "../core/interfaces/board.interface";
import { PlayerAction } from "../core/interfaces/player-action.interface";
import { parseResources } from "../core/utils/resource.util";
import { IPlayerView } from "../logic/view.service";

/*
 * Wire protocol. Every frame is one JSON object with a `type`.
 * A client can add `requestId` to any message, and an error reply will include it.
 */

// ---------- client -> server ----------

export type ClientMessage =
    /** Host screen opens a new room. Reply: room:created */
    | { type: 'host:create' }
    /** Host screen reconnects to its room after a refresh. Reply: room:hosting */
    | { type: 'host:rejoin'; roomCode: string; hostToken: string }
    /** Host removes a player while in the lobby. */
    | { type: 'host:kick'; playerId: string }
    /** Phone joins with a name. Reply: player:joined (save the sessionToken!) */
    | { type: 'player:join'; roomCode: string; name: string }
    /** Phone reconnects with its saved token. Reply: player:joined */
    | { type: 'player:rejoin'; roomCode: string; sessionToken: string }
    /** Leave the room. Removes the seat in the lobby; during a game it only disconnects. */
    | { type: 'player:leave' }
    /** Host or VIP player starts the game. */
    | { type: 'game:start' }
    /** Host or VIP player sends everyone back to the lobby (play again). */
    | { type: 'game:reset' }
    /** A move by the player whose turn it is. */
    | { type: 'action'; action: PlayerAction }
    /** Ask the server to resend the current state. */
    | { type: 'state:request' }
    | { type: 'ping' };

// ---------- server -> client ----------

export type ServerMessage =
    | { type: 'room:created'; roomCode: string; hostToken: string }
    | { type: 'room:hosting'; roomCode: string }
    | { type: 'player:joined'; roomCode: string; playerId: string; sessionToken: string; name: string }
    /** Sent to the host after every change. */
    | { type: 'state'; role: 'host'; board: IBoard }
    /** Sent to each player after every change, with their own private view. */
    | ({ type: 'state'; role: 'player' } & IPlayerView)
    /** You were kicked, left, or another tab took your seat. The client should go back to the join screen. */
    | { type: 'removed'; reason: string }
    | { type: 'error'; message: string; requestId?: string | number }
    | { type: 'pong' };

// ---------- parsing untrusted input ----------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: Obj, key: string): string {
    const v = o[key];
    if (typeof v !== 'string' || !v.trim())
        throw new GameRuleError(`Missing "${key}"`);
    return v.trim();
}

function id(v: unknown, label: string): number {
    if (typeof v !== 'number' || !Number.isInteger(v))
        throw new GameRuleError(`Invalid ${label}`);
    return v;
}

export function parseClientMessage(raw: string): { message: ClientMessage; requestId?: string | number } {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new GameRuleError("Messages must be valid JSON");
    }
    if (!isObj(data) || typeof data.type !== 'string')
        throw new GameRuleError("Messages need a \"type\"");

    const requestId = typeof data.requestId === 'string' || typeof data.requestId === 'number' ? data.requestId : undefined;
    return { message: toClientMessage(data), requestId };
}

function toClientMessage(d: Obj): ClientMessage {
    switch (d.type) {
        case 'host:create':
        case 'player:leave':
        case 'game:start':
        case 'game:reset':
        case 'state:request':
        case 'ping':
            return { type: d.type };
        case 'host:rejoin':
            return { type: d.type, roomCode: str(d, 'roomCode'), hostToken: str(d, 'hostToken') };
        case 'host:kick':
            return { type: d.type, playerId: str(d, 'playerId') };
        case 'player:join':
            return { type: d.type, roomCode: str(d, 'roomCode'), name: typeof d.name === 'string' ? d.name : '' };
        case 'player:rejoin':
            return { type: d.type, roomCode: str(d, 'roomCode'), sessionToken: str(d, 'sessionToken') };
        case 'action':
            return { type: 'action', action: parsePlayerAction(d.action) };
        default:
            throw new GameRuleError(`Unknown message type "${String(d.type)}"`);
    }
}

export function parsePlayerAction(input: unknown): PlayerAction {
    if (!isObj(input) || typeof input.type !== 'string')
        throw new GameRuleError("Invalid action");

    switch (input.type) {
        case 'takeGems':
            return { type: 'takeGems', gems: parseResources(input.gems) };
        case 'discardGems':
            return { type: 'discardGems', gems: parseResources(input.gems) };
        case 'reserveCard': {
            const source = input.source;
            if (isObj(source) && source.from === 'market')
                return { type: 'reserveCard', source: { from: 'market', cardId: id(source.cardId, 'card id') } };
            if (isObj(source) && source.from === 'deck') {
                if (source.tier !== 1 && source.tier !== 2 && source.tier !== 3)
                    throw new GameRuleError("Invalid deck tier");
                return { type: 'reserveCard', source: { from: 'deck', tier: source.tier } };
            }
            throw new GameRuleError("Reserve source must be { from: 'market', cardId } or { from: 'deck', tier }");
        }
        case 'purchaseCard':
            return {
                type: 'purchaseCard',
                cardId: id(input.cardId, 'card id'),
                payment: input.payment == null ? undefined : parseResources(input.payment, 'payment'),
            };
        case 'chooseNoble':
            return { type: 'chooseNoble', nobleId: id(input.nobleId, 'noble id') };
        case 'pass':
            return { type: 'pass' };
        default:
            throw new GameRuleError(`Unknown action "${input.type}"`);
    }
}
