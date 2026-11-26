import { CardTier } from "../types/card-tier.type";
import { IResource } from "./resource.interface";

export type ReserveSource =
    | { from: 'market'; cardId: number }
    | { from: 'deck'; tier: CardTier };

/** Everything a player can send as a move. These arrive from clients as `{ type: 'action', action: PlayerAction }`. */
export type PlayerAction =
    | { type: 'takeGems'; gems: Array<IResource> }
    | { type: 'reserveCard'; source: ReserveSource }
    /** `payment` is optional. If it's left out, the server pays with colored gems first, then gold. */
    | { type: 'purchaseCard'; cardId: number; payment?: Array<IResource> }
    | { type: 'discardGems'; gems: Array<IResource> }
    /** Instead of discarding after taking gems, put that take back and choose another move. */
    | { type: 'undoTakeGems' }
    | { type: 'chooseNoble'; nobleId: number }
    /** Only allowed when the player has no legal move. */
    | { type: 'pass' };

export type PlayerActionType = PlayerAction['type'];
