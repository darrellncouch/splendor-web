import { GamePhase } from "../types/game-phase.type";
import { IDeck } from "./deck.interface";
import { ILogEntry } from "./log-entry.interface";
import { INoble } from "./noble.interface";
import { IPendingDecision } from "./pending-decision.interface";
import { IPlayer } from "./player.interface";
import { IResource } from "./resource.interface";

/** The public game state. This is everything the host screen shows. */
export interface IBoard {
    roomCode: string;
    phase: GamePhase;
    round: number;
    finalRound: boolean;
    currentPlayerId: string | null;
    vipPlayerId: string | null;
    minPlayers: number;
    maxPlayers: number;
    /** Tier 1, 2 and 3, in that order. */
    market: Array<IDeck>;
    availableNobles: Array<INoble>;
    bank: Array<IResource>;
    /** In turn order. */
    players: Array<IPlayer>;
    pending: IPendingDecision | null;
    winnerIds: Array<string>;
    log: Array<ILogEntry>;
}
