import { GameRules } from "../core/constants/game-rules.constant";
import { GameRuleError } from "../core/errors/game-rule.error";
import { IGameContext } from "../core/interfaces/game-context.interface";
import { IGameData } from "../core/interfaces/game-data.interface";
import { RandomFn, shuffle } from "../core/utils/shuffle.util";

/** Starts a game: random seat order, then the bank, market and nobles are set up for the player count. */
export class GameSetupService {

    constructor(private readonly random: RandomFn = Math.random) { }

    public start(ctx: IGameContext, data: IGameData): void {
        const { state } = ctx;
        const count = state.players.length;

        if (state.phase === 'playing')
            throw new GameRuleError("The game has already started");
        if (count < GameRules.MIN_PLAYERS)
            throw new GameRuleError(`At least ${GameRules.MIN_PLAYERS} players are needed to start`);
        if (count > GameRules.MAX_PLAYERS)
            throw new GameRuleError(`At most ${GameRules.MAX_PLAYERS} players can play`);

        state.players = shuffle(state.players, this.random);
        state.players.forEach(p => p.resetForNewGame());

        //GAME RULE: 4 / 5 / 7 of each gem for 2 / 3 / 4 players, 5 gold, and nobles = players + 1
        ctx.bank.initialize(GameRules.GEMS_PER_COLOR_BY_PLAYERS[count], GameRules.GOLD_TOKENS);
        ctx.market.initialize(data.cards, this.random);
        ctx.nobles.initialize(data.nobles, count + 1, this.random);

        state.beginGame();
        state.addLog(`Game started! ${state.players[0].name} goes first`);
    }
}
