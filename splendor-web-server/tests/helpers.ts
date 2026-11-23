import { loadGameData } from "../src/core/data/game-data.loader";
import { ICard } from "../src/core/interfaces/card.interface";
import { IGameData } from "../src/core/interfaces/game-data.interface";
import { RandomFn } from "../src/core/utils/shuffle.util";
import { GameEngine } from "../src/gameEngine";
import { resolve } from "path";

/** Deterministic RNG (mulberry32) so failing games can be replayed. */
export function seeded(seed: number): RandomFn {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let cached: IGameData | undefined;
export function testData(): IGameData {
    cached ??= loadGameData(resolve(__dirname, '../data'));
    return cached;
}

export function startedGame(playerCount: number, seed = 1): GameEngine {
    const engine = new GameEngine('TEST', testData(), seeded(seed));
    for (let i = 0; i < playerCount; i++) engine.addPlayer(`P${i + 1}`);
    engine.start();
    return engine;
}

export function card(partial: Partial<ICard> & Pick<ICard, 'id'>): ICard {
    return { tier: 1, prestige: 0, bonus: 'white', cost: [], ...partial };
}
