import { GameRuleError } from "../core/errors/game-rule.error";
import { INoble } from "../core/interfaces/noble.interface";
import { RandomFn, shuffle } from "../core/utils/shuffle.util";

/** The nobles still on the board. */
export class NobleState {

    private _available: Array<INoble> = [];

    public initialize(allNobles: ReadonlyArray<INoble>, count: number, random: RandomFn): void {
        this._available = shuffle(allNobles, random).slice(0, count);
    }

    public get available(): ReadonlyArray<INoble> {
        return this._available;
    }

    public take(nobleId: number): INoble {
        const index = this._available.findIndex(n => n.id === nobleId);
        if (index < 0)
            throw new GameRuleError("That noble is not available");
        return this._available.splice(index, 1)[0];
    }
}
