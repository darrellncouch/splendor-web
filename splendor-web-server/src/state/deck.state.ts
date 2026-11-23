import { GameRules } from "../core/constants/game-rules.constant";
import { GameRuleError } from "../core/errors/game-rule.error";
import { ICard } from "../core/interfaces/card.interface";
import { IDeck } from "../core/interfaces/deck.interface";
import { CardTier } from "../core/types/card-tier.type";

/** One tier of the market: a face-down draw pile and the 4 face-up slots it refills. */
export class DeckState {

    private _drawPile: Array<ICard> = [];
    private _faceUp: Array<ICard | null> = [];

    constructor(public readonly tier: CardTier) { }

    /** `cards` should already be shuffled. The last card in the array is the top of the pile. */
    public initialize(cards: ReadonlyArray<ICard>): void {
        this._drawPile = [...cards];
        this._faceUp = Array.from({ length: GameRules.MARKET_SLOTS }, () => this._drawPile.pop() ?? null);
    }

    public get remaining(): number {
        return this._drawPile.length;
    }

    public get faceUp(): ReadonlyArray<ICard | null> {
        return this._faceUp;
    }

    public hasAnyCard(): boolean {
        return this._drawPile.length > 0 || this._faceUp.some(c => c !== null);
    }

    public findFaceUp(cardId: number): ICard | undefined {
        return this._faceUp.find(c => c?.id === cardId) ?? undefined;
    }

    /** Removes a face-up card and refills its slot from the draw pile. */
    public takeFaceUp(cardId: number): ICard {
        const index = this._faceUp.findIndex(c => c?.id === cardId);
        const card = index >= 0 ? this._faceUp[index] : null;
        if (!card)
            throw new GameRuleError("That card is not in the market");

        this._faceUp[index] = this._drawPile.pop() ?? null;
        return card;
    }

    /** Draws the top card of the face-down pile (blind reserve). */
    public drawTop(): ICard {
        const card = this._drawPile.pop();
        if (!card)
            throw new GameRuleError(`The tier ${this.tier} deck is empty`);
        return card;
    }

    public toView(): IDeck {
        return { tier: this.tier, remaining: this.remaining, cards: [...this._faceUp] };
    }
}
