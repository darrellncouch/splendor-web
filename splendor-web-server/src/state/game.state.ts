import { GameRuleError } from "../core/errors/game-rule.error";
import { ILogEntry } from "../core/interfaces/log-entry.interface";
import { IResource } from "../core/interfaces/resource.interface";
import { IPendingDecision } from "../core/interfaces/pending-decision.interface";
import { GamePhase } from "../core/types/game-phase.type";
import { PlayerState } from "./player.state";

const MAX_LOG_ENTRIES = 50;

/** Overall game flow: phase, seats and turn order, whose turn it is, end-game status and the log. */
export class GameState {

    public phase: GamePhase = 'lobby';
    /** Seat order. This is the turn order once the game starts. */
    public players: Array<PlayerState> = [];
    /** The "VIP" (first to join), who can start the game from their phone, like Jackbox. */
    public vipPlayerId: string | null = null;

    public currentPlayerIndex = 0;
    public round = 1;
    /** Set once someone hits the winning prestige. The game ends when the round finishes. */
    public finalRound = false;
    /** Set when the current player has to finish something before their turn ends. */
    public pending: IPendingDecision | null = null;
    /**
     * The gems the current player just took, while they're being asked to discard because of it.
     * Lets them put the take back and choose a different move. Null at any other time.
     */
    public undoableTake: Array<IResource> | null = null;
    public winnerIds: Array<string> = [];

    private _log: Array<ILogEntry> = [];
    private _nextLogId = 1;

    public get currentPlayer(): PlayerState | undefined {
        return this.phase === 'playing' ? this.players[this.currentPlayerIndex] : undefined;
    }

    public getPlayer(playerId: string): PlayerState | undefined {
        return this.players.find(p => p.id === playerId);
    }

    public requirePlayer(playerId: string): PlayerState {
        const player = this.getPlayer(playerId);
        if (!player)
            throw new GameRuleError("Player not found");
        return player;
    }

    public get log(): ReadonlyArray<ILogEntry> {
        return this._log;
    }

    public addLog(message: string): void {
        this._log.push({ id: this._nextLogId++, at: new Date().toISOString(), message });
        if (this._log.length > MAX_LOG_ENTRIES)
            this._log.splice(0, this._log.length - MAX_LOG_ENTRIES);
    }

    public beginGame(): void {
        this.phase = 'playing';
        this.currentPlayerIndex = 0;
        this.round = 1;
        this.finalRound = false;
        this.pending = null;
        this.undoableTake = null;
        this.winnerIds = [];
        this._log = [];
    }

    public returnToLobby(): void {
        this.phase = 'lobby';
        this.currentPlayerIndex = 0;
        this.round = 1;
        this.finalRound = false;
        this.pending = null;
        this.undoableTake = null;
        this.winnerIds = [];
        this._log = [];
        this.players.forEach(p => p.resetForNewGame());
    }
}
