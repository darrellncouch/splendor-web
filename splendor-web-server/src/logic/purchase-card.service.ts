import { BASIC_GEM_COLORS } from "../core/constants/gem-colors.constant";
import { GameRuleError } from "../core/errors/game-rule.error";
import { ICard } from "../core/interfaces/card.interface";
import { IResource } from "../core/interfaces/resource.interface";
import { emptyGemRecord, GemRecord, toGemRecord, toResourceArray } from "../core/utils/resource.util";
import { BankState } from "../state/bank.state";
import { MarketState } from "../state/market.state";
import { PlayerState } from "../state/player.state";

export interface IPurchaseResult {
    card: ICard;
    paid: Array<IResource>;
    fromReserve: boolean;
}

/**
 * The "purchase a card" action: buy a face-up market card or one of your own reserved cards.
 * Your bonuses lower the cost of each color, and gold can stand in for any color.
 */
export class PurchaseCardService {

    /** What the player still owes in each color after bonuses. */
    public getAmountOwed(player: PlayerState, card: ICard): GemRecord {
        const bonuses = player.bonuses;
        const cost = toGemRecord(card.cost);
        const owed = emptyGemRecord();
        BASIC_GEM_COLORS.forEach(c => owed[c] = Math.max(0, cost[c] - bonuses[c]));
        return owed;
    }

    /** Pays with colored gems first and fills any shortfall with gold. Returns null if they can't afford it. */
    public computeAutoPayment(player: PlayerState, card: ICard): Array<IResource> | null {
        const owed = this.getAmountOwed(player, card);
        const payment = emptyGemRecord();
        let goldNeeded = 0;

        BASIC_GEM_COLORS.forEach(c => {
            payment[c] = Math.min(owed[c], player.getGemCount(c));
            goldNeeded += owed[c] - payment[c];
        });

        if (goldNeeded > player.getGemCount('gold'))
            return null;

        payment.gold = goldNeeded;
        return toResourceArray(payment, false);
    }

    public canAfford(player: PlayerState, card: ICard): boolean {
        return this.computeAutoPayment(player, card) !== null;
    }

    /** Market cards plus this player's reserved cards that they can afford now. */
    public getAffordableCardIds(player: PlayerState, market: MarketState): Array<number> {
        return [...market.allFaceUp(), ...player.reservedCards.map(r => r.card)]
            .filter(card => this.canAfford(player, card))
            .map(card => card.id);
    }

    /** Checks a payment the player chose (for example, spending gold while still holding the colored gem). */
    public validatePayment(player: PlayerState, card: ICard, payment: ReadonlyArray<IResource>): void {
        if (!player.hasGems(payment))
            throw new GameRuleError("You do not have those gems");

        const owed = this.getAmountOwed(player, card);
        const paid = toGemRecord(payment);
        let shortfall = 0;

        for (const c of BASIC_GEM_COLORS) {
            if (paid[c] > owed[c])
                throw new GameRuleError(`You are overpaying ${c} (owe ${owed[c]})`);
            shortfall += owed[c] - paid[c];
        }

        if (paid.gold !== shortfall)
            throw new GameRuleError(`That payment needs exactly ${shortfall} gold`);
    }

    public execute(
        player: PlayerState,
        bank: BankState,
        market: MarketState,
        cardId: number,
        payment?: ReadonlyArray<IResource>,
    ): IPurchaseResult {
        const reserved = player.findReserved(cardId);
        const card = reserved?.card ?? market.findFaceUp(cardId);
        if (!card)
            throw new GameRuleError("That card isn't available to buy");

        let paid: Array<IResource>;
        if (payment) {
            this.validatePayment(player, card, payment);
            paid = payment.map(p => ({ ...p }));
        } else {
            const auto = this.computeAutoPayment(player, card);
            if (!auto)
                throw new GameRuleError("You can't afford that card");
            paid = auto;
        }

        player.removeGems(paid);
        bank.deposit(paid);

        if (reserved)
            player.removeReserved(cardId);
        else
            market.takeFaceUp(cardId);

        player.addPurchased(card);
        return { card, paid, fromReserve: !!reserved };
    }
}
