import { ICard } from "../core/interfaces/card.interface";
import { IDeck } from "../core/interfaces/deck.interface";
import { CardTier } from "../core/types/card-tier.type";
import { RandomFn, shuffle } from "../core/utils/shuffle.util";
import { DeckState } from "./deck.state";

export const CARD_TIERS: ReadonlyArray<CardTier> = [1, 2, 3];

/** All three tiers of development cards. */
export class MarketState {

    private readonly _decks: Record<CardTier, DeckState> = {
        1: new DeckState(1),
        2: new DeckState(2),
        3: new DeckState(3),
    };

    public initialize(allCards: ReadonlyArray<ICard>, random: RandomFn): void {
        CARD_TIERS.forEach(tier => {
            this._decks[tier].initialize(shuffle(allCards.filter(c => c.tier === tier), random));
        });
    }

    public deck(tier: CardTier): DeckState {
        return this._decks[tier];
    }

    public findFaceUp(cardId: number): ICard | undefined {
        for (const tier of CARD_TIERS) {
            const card = this._decks[tier].findFaceUp(cardId);
            if (card) return card;
        }
        return undefined;
    }

    public takeFaceUp(cardId: number): ICard {
        const card = this.findFaceUp(cardId);
        return this._decks[card ? card.tier : 1].takeFaceUp(cardId);
    }

    public allFaceUp(): Array<ICard> {
        return CARD_TIERS.flatMap(tier => this._decks[tier].faceUp.filter((c): c is ICard => c !== null));
    }

    public hasAnyCard(): boolean {
        return CARD_TIERS.some(tier => this._decks[tier].hasAnyCard());
    }

    public toView(): Array<IDeck> {
        return CARD_TIERS.map(tier => this._decks[tier].toView());
    }
}
