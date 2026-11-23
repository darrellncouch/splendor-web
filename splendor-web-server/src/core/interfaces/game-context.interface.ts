import { BankState } from "../../state/bank.state";
import { GameState } from "../../state/game.state";
import { MarketState } from "../../state/market.state";
import { NobleState } from "../../state/noble.state";

/** All of one room's state objects together, so services can work on a game. */
export interface IGameContext {
    state: GameState;
    bank: BankState;
    market: MarketState;
    nobles: NobleState;
}
