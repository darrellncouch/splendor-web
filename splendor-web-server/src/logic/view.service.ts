import { GameRules } from "../core/constants/game-rules.constant";
import { BASIC_GEM_COLORS } from "../core/constants/gem-colors.constant";
import { IAvailableActions } from "../core/interfaces/available-actions.interface";
import { IBoard } from "../core/interfaces/board.interface";
import { IGameContext } from "../core/interfaces/game-context.interface";
import { IPlayer, ISelfPlayer } from "../core/interfaces/player.interface";
import { toResourceArray } from "../core/utils/resource.util";
import { PlayerState } from "../state/player.state";
import { PlayerActionService } from "./player-action.service";

export interface IPlayerView {
    board: IBoard;
    self: ISelfPlayer;
    actions: IAvailableActions;
}

/**
 * Turns server state into the plain JSON sent to clients. Hidden information is removed here:
 * other players' reserved cards are face down and the draw piles only show a count.
 */
export class ViewService {

    constructor(private readonly actions: PlayerActionService) { }

    public buildBoard(ctx: IGameContext, roomCode: string): IBoard {
        const { state } = ctx;
        const inGame = state.phase !== 'lobby';

        return {
            roomCode,
            phase: state.phase,
            round: state.round,
            finalRound: state.finalRound,
            currentPlayerId: state.currentPlayer?.id ?? null,
            vipPlayerId: state.vipPlayerId,
            minPlayers: GameRules.MIN_PLAYERS,
            maxPlayers: GameRules.MAX_PLAYERS,
            market: inGame ? ctx.market.toView() : [],
            availableNobles: inGame ? [...ctx.nobles.available] : [],
            bank: ctx.bank.getCurrent(),
            players: state.players.map((p, seat) => this.toPublicPlayer(ctx, p, seat)),
            pending: state.pending,
            winnerIds: [...state.winnerIds],
            log: [...state.log],
        };
    }

    public buildPlayerView(ctx: IGameContext, roomCode: string, playerId: string): IPlayerView | null {
        const seat = ctx.state.players.findIndex(p => p.id === playerId);
        if (seat < 0)
            return null;

        const player = ctx.state.players[seat];
        const self: ISelfPlayer = {
            ...this.toPublicPlayer(ctx, player, seat),
            reserved: player.reservedCards.map(r => ({ ...r.card, fromDeck: r.fromDeck })),
        };

        return {
            board: this.buildBoard(ctx, roomCode),
            self,
            actions: this.actions.getAvailableActions(ctx, player),
        };
    }

    private toPublicPlayer(ctx: IGameContext, player: PlayerState, seat: number): IPlayer {
        const bonuses = player.bonuses;
        return {
            id: player.id,
            name: player.name,
            connected: player.connected,
            isVip: ctx.state.vipPlayerId === player.id,
            seat,
            isCurrentTurn: ctx.state.currentPlayer?.id === player.id,
            prestige: player.prestige,
            gems: toResourceArray(player.gems),
            gemTotal: player.gemTotal,
            bonuses: BASIC_GEM_COLORS.map(id => ({ id, quantity: bonuses[id] })),
            purchasedCount: player.purchasedCards.length,
            reserved: player.reservedCards.map(r => ({ tier: r.card.tier })),
            nobles: [...player.nobles],
        };
    }
}
