import { GameRules } from "../core/constants/game-rules.constant";
import { GameRuleError } from "../core/errors/game-rule.error";
import { IGameContext } from "../core/interfaces/game-context.interface";
import { INoble } from "../core/interfaces/noble.interface";
import { IResource } from "../core/interfaces/resource.interface";
import { describeResources, totalCount } from "../core/utils/resource.util";
import { GameState } from "../state/game.state";
import { NobleState } from "../state/noble.state";
import { PlayerState } from "../state/player.state";

/**
 * Everything that happens after a player's main action, in rule order:
 *   1. If they hold more than 10 tokens, they discard down to 10 (waits for the player).
 *   2. Noble visit: if they qualify for one, it's given automatically. If several, they choose (waits).
 *   3. End of turn: start the final round if someone hit 15, move to the next player, end the game after the last round.
 */
export class TurnService {

    /** Call this after a main action. It runs as far as it can until the player has to decide something. */
    public continueTurn(ctx: IGameContext): void {
        const { state } = ctx;
        const player = this.requireCurrentPlayer(state);

        const excess = player.gemTotal - GameRules.MAX_TOKENS;
        if (excess > 0) {
            state.pending = { type: 'discard', playerId: player.id, count: excess };
            return;
        }

        if (!this.resolveNobleVisit(state, ctx.nobles, player))
            return; // waiting for the player to pick a noble

        this.endTurn(state);
    }

    public discard(ctx: IGameContext, player: PlayerState, gems: ReadonlyArray<IResource>): void {
        const pending = ctx.state.pending;
        if (pending?.type !== 'discard' || pending.playerId !== player.id)
            throw new GameRuleError("You don't need to discard right now");

        const total = totalCount(gems);
        if (total !== pending.count)
            throw new GameRuleError(`You must discard exactly ${pending.count} gem(s)`);

        player.removeGems(gems);
        ctx.bank.deposit(gems);
        ctx.state.pending = null;
        ctx.state.addLog(`${player.name} returned ${describeResources(gems)}`);

        this.continueTurn(ctx);
    }

    public chooseNoble(ctx: IGameContext, player: PlayerState, nobleId: number): void {
        const pending = ctx.state.pending;
        if (pending?.type !== 'chooseNoble' || pending.playerId !== player.id)
            throw new GameRuleError("You don't need to choose a noble right now");
        if (!pending.nobleIds.includes(nobleId))
            throw new GameRuleError("You can't claim that noble");

        this.awardNoble(ctx.state, ctx.nobles, player, nobleId);
        ctx.state.pending = null;
        this.endTurn(ctx.state);
    }

    public getEligibleNobles(player: PlayerState, nobles: NobleState): Array<INoble> {
        return nobles.available.filter(n => player.qualifiesFor(n));
    }

    /** Returns true if the turn can continue, or false if the player has to pick from several nobles. */
    private resolveNobleVisit(state: GameState, nobles: NobleState, player: PlayerState): boolean {
        const eligible = this.getEligibleNobles(player, nobles);

        if (eligible.length === 0)
            return true;

        //GAME RULE: only one noble per turn. If more than one qualifies, the player chooses.
        if (eligible.length === 1) {
            this.awardNoble(state, nobles, player, eligible[0].id);
            return true;
        }

        state.pending = { type: 'chooseNoble', playerId: player.id, nobleIds: eligible.map(n => n.id) };
        return false;
    }

    private awardNoble(state: GameState, nobles: NobleState, player: PlayerState, nobleId: number): void {
        const noble = nobles.take(nobleId);
        player.addNoble(noble);
        state.addLog(`A noble visited ${player.name} (+${noble.prestige} prestige)`);
    }

    private endTurn(state: GameState): void {
        const player = this.requireCurrentPlayer(state);

        //GAME RULE: reaching 15 prestige starts the final round so everyone gets the same number of turns
        if (!state.finalRound && player.prestige >= GameRules.WINNING_PRESTIGE) {
            state.finalRound = true;
            state.addLog(`${player.name} reached ${player.prestige} prestige. This is the final round!`);
        }

        const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
        if (nextIndex === 0) {
            if (state.finalRound) {
                this.finishGame(state);
                return;
            }
            state.round++;
        }

        state.currentPlayerIndex = nextIndex;
    }

    private finishGame(state: GameState): void {
        //GAME RULE: highest prestige wins. Ties go to whoever bought the fewest cards. If still tied, they share the win.
        const best = Math.max(...state.players.map(p => p.prestige));
        const contenders = state.players.filter(p => p.prestige === best);
        const fewestCards = Math.min(...contenders.map(p => p.purchasedCards.length));
        const winners = contenders.filter(p => p.purchasedCards.length === fewestCards);

        state.phase = 'finished';
        state.pending = null;
        state.winnerIds = winners.map(p => p.id);
        state.addLog(`Game over! ${winners.map(p => p.name).join(' & ')} won with ${best} prestige`);
    }

    private requireCurrentPlayer(state: GameState): PlayerState {
        const player = state.currentPlayer;
        if (!player)
            throw new GameRuleError("The game is not in progress");
        return player;
    }
}
