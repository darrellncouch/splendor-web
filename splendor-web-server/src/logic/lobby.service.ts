import { randomUUID } from "crypto";
import { GameRules } from "../core/constants/game-rules.constant";
import { GameRuleError } from "../core/errors/game-rule.error";
import { GameState } from "../state/game.state";
import { PlayerState } from "../state/player.state";

/** Joining, leaving, rejoining and kicking players. */
export class LobbyService {

    public join(state: GameState, rawName: unknown): PlayerState {
        if (state.phase !== 'lobby')
            throw new GameRuleError("This game has already started");
        if (state.players.length >= GameRules.MAX_PLAYERS)
            throw new GameRuleError(`This room is full (${GameRules.MAX_PLAYERS} players max)`);

        const name = this.validateName(state, rawName);
        const player = new PlayerState(randomUUID(), name, randomUUID());
        state.players.push(player);
        state.vipPlayerId ??= player.id;
        return player;
    }

    public rejoin(state: GameState, sessionToken: unknown): PlayerState {
        const player = typeof sessionToken === 'string'
            ? state.players.find(p => p.sessionToken === sessionToken)
            : undefined;
        if (!player)
            throw new GameRuleError("Your seat in that room was not found. Join again.");
        return player;
    }

    /** Players can only be removed in the lobby. During a game their seat stays so they can rejoin. */
    public remove(state: GameState, playerId: string): PlayerState {
        if (state.phase === 'playing')
            throw new GameRuleError("Players can't be removed during a game");

        const player = state.requirePlayer(playerId);
        state.players = state.players.filter(p => p.id !== playerId);
        if (state.vipPlayerId === playerId)
            state.vipPlayerId = state.players[0]?.id ?? null;
        return player;
    }

    private validateName(state: GameState, rawName: unknown): string {
        const name = typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ') : '';
        if (!name)
            throw new GameRuleError("Please enter a name");
        if (name.length > GameRules.MAX_NAME_LENGTH)
            throw new GameRuleError(`Names can be at most ${GameRules.MAX_NAME_LENGTH} characters`);
        if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase()))
            throw new GameRuleError("Someone in this room already has that name");
        return name;
    }
}
