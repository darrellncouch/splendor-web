import { GameRules } from "../core/constants/game-rules.constant";
import { GemId } from "../core/constants/gem-ids.constant";
import { GameRuleError } from "../core/errors/game-rule.error";
import { ICard } from "../core/interfaces/card.interface";
import { ReserveSource } from "../core/interfaces/player-action.interface";
import { CardTier } from "../core/types/card-tier.type";
import { BankState } from "../state/bank.state";
import { CARD_TIERS, MarketState } from "../state/market.state";
import { PlayerState } from "../state/player.state";

export interface IReserveResult {
    card: ICard;
    fromDeck: boolean;
    gotGold: boolean;
}

/**
 * The "reserve a card" action: take a face-up market card, or the top card of a deck blind,
 * into your hand (3 at most). You also get 1 gold if the bank has any.
 */
export class ReserveCardService {

    public canReserve(player: PlayerState, market: MarketState): boolean {
        return player.reservedCards.length < GameRules.MAX_RESERVED && market.hasAnyCard();
    }

    public getReservableDeckTiers(market: MarketState): Array<CardTier> {
        return CARD_TIERS.filter(t => market.deck(t).remaining > 0);
    }

    public execute(player: PlayerState, bank: BankState, market: MarketState, source: ReserveSource): IReserveResult {
        //GAME RULE: max of 3 reserved cards
        if (player.reservedCards.length >= GameRules.MAX_RESERVED)
            throw new GameRuleError(`You can only have ${GameRules.MAX_RESERVED} reserved cards`);

        const fromDeck = source.from === 'deck';
        const card = source.from === 'deck'
            ? market.deck(source.tier).drawTop()
            : market.takeFaceUp(source.cardId);

        player.addReserved(card, fromDeck);

        //GAME RULE: get 1 gold if the bank has any
        const gotGold = bank.getCount(GemId.GOLD) > 0;
        if (gotGold) {
            const gold = bank.withdraw([{ id: GemId.GOLD, count: 1 }]);
            player.addGems(gold);
        }

        return { card, fromDeck, gotGold };
    }
}
