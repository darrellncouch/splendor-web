import { BasicGemColor } from "../types/gem-color.type";
import { CardTier } from "../types/card-tier.type";
import { IPendingDecision } from "./pending-decision.interface";

/**
 * Pre-computed so the client stays dumb: it just enables or disables buttons from these flags.
 * Every `can*` flag is false when it isn't this player's turn.
 */
export interface IAvailableActions {
    isYourTurn: boolean;
    /** A decision this player must resolve right now (discard down to 10, or pick a noble). */
    pending: IPendingDecision | null;
    canTakeGems: boolean;
    /** Colors that can be part of a "take different colors" move. */
    distinctGemColors: Array<BasicGemColor>;
    /** A "take different colors" move must be exactly this many colors (3, or fewer if the bank is low). */
    requiredDistinctCount: number;
    /** Colors that can be taken 2 at a time (the bank has 4 or more). */
    doubleGemColors: Array<BasicGemColor>;
    canReserve: boolean;
    /** Tiers whose draw pile still has cards for a blind reserve. */
    reservableDeckTiers: Array<CardTier>;
    canPurchase: boolean;
    /** Market and reserved cards this player can afford now. Filled in even when it's not their turn, so the client can highlight them. */
    affordableCardIds: Array<number>;
    canPass: boolean;
}
