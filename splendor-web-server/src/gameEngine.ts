import { IBoard } from "./core/interfaces/board.interface";
import { IGameContext } from "./core/interfaces/game-context.interface";
import { IGameData } from "./core/interfaces/game-data.interface";
import { PlayerAction } from "./core/interfaces/player-action.interface";
import { RandomFn } from "./core/utils/shuffle.util";
import { GameSetupService } from "./logic/game-setup.service";
import { LobbyService } from "./logic/lobby.service";
import { PlayerActionService } from "./logic/player-action.service";
import { IPlayerView, ViewService } from "./logic/view.service";
import { BankState } from "./state/bank.state";
import { GameState } from "./state/game.state";
import { MarketState } from "./state/market.state";
import { NobleState } from "./state/noble.state";
import { PlayerState } from "./state/player.state";

/**
 * One room's game. It holds the state objects and passes each request to the right service.
 * It knows nothing about websockets. The hub calls these methods and broadcasts the views.
 */
export class GameEngine implements IGameContext {

    public readonly state = new GameState();
    public readonly bank = new BankState();
    public readonly market = new MarketState();
    public readonly nobles = new NobleState();

    private readonly lobby = new LobbyService();
    private readonly setup: GameSetupService;
    private readonly actions = new PlayerActionService();
    private readonly views = new ViewService(this.actions);

    constructor(
        public readonly roomCode: string,
        private readonly data: IGameData,
        random: RandomFn = Math.random,
    ) {
        this.setup = new GameSetupService(random);
    }

    // ---- lobby ----

    public addPlayer(name: unknown): PlayerState {
        const player = this.lobby.join(this.state, name);
        this.state.addLog(`${player.name} joined`);
        return player;
    }

    public rejoin(sessionToken: unknown): PlayerState {
        return this.lobby.rejoin(this.state, sessionToken);
    }

    public removePlayer(playerId: string): PlayerState {
        const player = this.lobby.remove(this.state, playerId);
        this.state.addLog(`${player.name} left`);
        return player;
    }

    public setPlayerConnected(playerId: string, connected: boolean): void {
        const player = this.state.getPlayer(playerId);
        if (player) player.connected = connected;
    }

    public isVip(playerId: string): boolean {
        return this.state.vipPlayerId === playerId;
    }

    // ---- game flow ----

    public start(): void {
        this.setup.start(this, this.data);
    }

    /** Back to the lobby with the same players, for "play again". */
    public resetToLobby(): void {
        this.state.returnToLobby();
        this.bank.initialize(0, 0);
    }

    public performAction(playerId: string, action: PlayerAction): void {
        this.actions.execute(this, playerId, action);
    }

    // ---- views ----

    public getBoard(): IBoard {
        return this.views.buildBoard(this, this.roomCode);
    }

    public getPlayerView(playerId: string): IPlayerView | null {
        return this.views.buildPlayerView(this, this.roomCode, playerId);
    }
}
