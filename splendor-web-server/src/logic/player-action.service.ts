import { GameRuleError } from "../core/errors/game-rule.error";
import { IAvailableActions } from "../core/interfaces/available-actions.interface";
import { IGameContext } from "../core/interfaces/game-context.interface";
import { PlayerAction } from "../core/interfaces/player-action.interface";
import { describeResources } from "../core/utils/resource.util";
import { PlayerState } from "../state/player.state";
import { PurchaseCardService } from "./purchase-card.service";
import { ReserveCardService } from "./reserve-card.service";
import { TakeGemsService } from "./take-gems.service";
import { TurnService } from "./turn.service";

/**
 * Entry point for every move. It checks that it's this player's turn and that they don't
 * have an unfinished decision, runs the right action service, then hands off to the TurnService.
 */
export class PlayerActionService {

    constructor(
        private readonly takeGems = new TakeGemsService(),
        private readonly reserveCard = new ReserveCardService(),
        private readonly purchaseCard = new PurchaseCardService(),
        private readonly turn = new TurnService(),
    ) { }

    public execute(ctx: IGameContext, playerId: string, action: PlayerAction): void {
        const { state, bank, market } = ctx;

        if (state.phase !== 'playing')
            throw new GameRuleError("The game is not in progress");

        const player = state.currentPlayer;
        if (!player || player.id !== playerId)
            throw new GameRuleError("It's not your turn");

        // Finish a pending decision first (discard down to 10 / pick a noble)
        const pending = state.pending;
        if (pending) {
            if (pending.type === 'discard' && action.type === 'discardGems')
                return this.turn.discard(ctx, player, action.gems);
            if (pending.type === 'chooseNoble' && action.type === 'chooseNoble')
                return this.turn.chooseNoble(ctx, player, action.nobleId);

            throw new GameRuleError(pending.type === 'discard'
                ? `You must return ${pending.count} gem(s) before your turn can end`
                : "You must choose which noble visits you");
        }

        switch (action.type) {
            case 'takeGems': {
                const taken = this.takeGems.execute(player, bank, action.gems);
                state.addLog(`${player.name} took ${describeResources(taken)}`);
                break;
            }
            case 'reserveCard': {
                const result = this.reserveCard.execute(player, bank, market, action.source);
                const what = result.fromDeck ? `a face-down tier ${result.card.tier} card` : `a tier ${result.card.tier} card`;
                state.addLog(`${player.name} reserved ${what}${result.gotGold ? ' and took 1 gold' : ''}`);
                break;
            }
            case 'purchaseCard': {
                const result = this.purchaseCard.execute(player, bank, market, action.cardId, action.payment);
                const source = result.fromReserve ? ' from their reserve' : '';
                state.addLog(`${player.name} bought a tier ${result.card.tier} ${result.card.bonus} card${source} for ${describeResources(result.paid)}`);
                break;
            }
            case 'pass': {
                if (this.hasLegalMainAction(ctx, player))
                    throw new GameRuleError("You can only pass when you have no legal move");
                state.addLog(`${player.name} had no legal move and passed`);
                break;
            }
            case 'discardGems':
            case 'chooseNoble':
                throw new GameRuleError("You can't do that right now");
        }

        this.turn.continueTurn(ctx);
    }

    public hasLegalMainAction(ctx: IGameContext, player: PlayerState): boolean {
        return this.takeGems.canTakeAny(ctx.bank)
            || this.reserveCard.canReserve(player, ctx.market)
            || this.purchaseCard.getAffordableCardIds(player, ctx.market).length > 0;
    }

    /** The flags clients use to turn their action buttons on and off. */
    public getAvailableActions(ctx: IGameContext, player: PlayerState): IAvailableActions {
        const { state, bank, market } = ctx;
        const isYourTurn = state.phase === 'playing' && state.currentPlayer?.id === player.id;
        const pending = isYourTurn ? state.pending : null;
        const free = isYourTurn && !pending;

        const gemOptions = this.takeGems.getOptions(bank);
        const affordableCardIds = this.purchaseCard.getAffordableCardIds(player, market);
        const canTakeGems = free && gemOptions.distinctColors.length > 0;
        const canReserve = free && this.reserveCard.canReserve(player, market);
        const canPurchase = free && affordableCardIds.length > 0;

        return {
            isYourTurn,
            pending,
            canTakeGems,
            distinctGemColors: gemOptions.distinctColors,
            requiredDistinctCount: gemOptions.requiredDistinct,
            doubleGemColors: gemOptions.doubleColors,
            canReserve,
            reservableDeckTiers: this.reserveCard.getReservableDeckTiers(market),
            canPurchase,
            affordableCardIds,
            canPass: free && !canTakeGems && !canReserve && !canPurchase,
        };
    }
}
