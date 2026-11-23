import { CardTier } from "../types/card-tier.type";
import { ICard } from "./card.interface";

/** One row of the market as the clients see it: the face-up cards plus how many are left in the draw pile. */
export interface IDeck {
    tier: CardTier;
    /** How many cards are still face down in the draw pile. */
    remaining: number;
    /** Always 4 slots. A slot is null once the draw pile can't refill it. */
    cards: Array<ICard | null>;
}
