import { GameRuleError } from "../core/errors/game-rule.error";
import { ICard } from "../core/interfaces/card.interface";
import { INoble } from "../core/interfaces/noble.interface";
import { IResource } from "../core/interfaces/resource.interface";
import { GemColor } from "../core/types/gem-color.type";
import { emptyGemRecord, GemRecord, toGemRecord } from "../core/utils/resource.util";

export interface IReservedCard {
    card: ICard;
    /** True when it was drawn blind from the top of a deck instead of taken from the market. */
    fromDeck: boolean;
}

/** One player's seat: identity, connection status, tokens, cards and nobles. */
export class PlayerState {

    public connected = true;

    private _gems: GemRecord = emptyGemRecord();
    private _purchased: Array<ICard> = [];
    private _reserved: Array<IReservedCard> = [];
    private _nobles: Array<INoble> = [];

    constructor(
        public readonly id: string,
        public name: string,
        /** Secret the client stores so it can rejoin after a refresh or disconnect. */
        public readonly sessionToken: string,
    ) { }

    public resetForNewGame(): void {
        this._gems = emptyGemRecord();
        this._purchased = [];
        this._reserved = [];
        this._nobles = [];
    }

    // ---- derived values ----

    public get gems(): Readonly<GemRecord> {
        return { ...this._gems };
    }

    public getGemCount(color: GemColor): number {
        return this._gems[color];
    }

    public get gemTotal(): number {
        return Object.values(this._gems).reduce((a, b) => a + b, 0);
    }

    /** Permanent discounts from purchased cards. Gold is always 0. */
    public get bonuses(): GemRecord {
        const bonuses = emptyGemRecord();
        this._purchased.forEach(card => bonuses[card.bonus] += 1);
        return bonuses;
    }

    public get prestige(): number {
        return this._purchased.reduce((sum, c) => sum + c.prestige, 0)
            + this._nobles.reduce((sum, n) => sum + n.prestige, 0);
    }

    public get purchasedCards(): ReadonlyArray<ICard> {
        return this._purchased;
    }

    public get reservedCards(): ReadonlyArray<IReservedCard> {
        return this._reserved;
    }

    public get nobles(): ReadonlyArray<INoble> {
        return this._nobles;
    }

    /** True if this player's bonuses meet the noble's requirements. */
    public qualifiesFor(noble: INoble): boolean {
        const bonuses = this.bonuses;
        return noble.cost.every(req => bonuses[req.id] >= req.count);
    }

    // ---- gems ----

    public hasGems(resources: ReadonlyArray<IResource>): boolean {
        const requested = toGemRecord(resources);
        return (Object.keys(requested) as Array<GemColor>).every(c => this._gems[c] >= requested[c]);
    }

    public addGems(resources: ReadonlyArray<IResource>): void {
        resources.forEach(r => this._gems[r.id] += r.count);
    }

    public removeGems(resources: ReadonlyArray<IResource>): void {
        if (!this.hasGems(resources))
            throw new GameRuleError("You do not have those gems");
        resources.forEach(r => this._gems[r.id] -= r.count);
    }

    // ---- cards & nobles ----

    public addPurchased(card: ICard): void {
        this._purchased.push(card);
    }

    public addReserved(card: ICard, fromDeck: boolean): void {
        this._reserved.push({ card, fromDeck });
    }

    public findReserved(cardId: number): IReservedCard | undefined {
        return this._reserved.find(r => r.card.id === cardId);
    }

    public removeReserved(cardId: number): ICard {
        const index = this._reserved.findIndex(r => r.card.id === cardId);
        if (index < 0)
            throw new GameRuleError("You have not reserved that card");
        return this._reserved.splice(index, 1)[0].card;
    }

    public addNoble(noble: INoble): void {
        this._nobles.push(noble);
    }
}
