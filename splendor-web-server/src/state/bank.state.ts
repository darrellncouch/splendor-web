import { BASIC_GEM_COLORS } from "../core/constants/gem-colors.constant";
import { GameRuleError } from "../core/errors/game-rule.error";
import { IResource } from "../core/interfaces/resource.interface";
import { GemColor } from "../core/types/gem-color.type";
import { emptyGemRecord, GemRecord, toGemRecord, toResourceArray } from "../core/utils/resource.util";

/**
 * The bank's token supply. This only holds balances: it checks that it never goes negative,
 * but it does not know the game rules. Rules for what a player may take are in
 * logic/take-gems.service.ts.
 */
export class BankState {

    private _vault: GemRecord = emptyGemRecord();

    public initialize(gemsPerColor: number, gold: number): void {
        this._vault = emptyGemRecord();
        BASIC_GEM_COLORS.forEach(color => this._vault[color] = gemsPerColor);
        this._vault.gold = gold;
    }

    public getCurrent(): Array<IResource> {
        return toResourceArray(this._vault);
    }

    public getCount(color: GemColor): number {
        return this._vault[color];
    }

    public has(resources: ReadonlyArray<IResource>): boolean {
        const requested = toGemRecord(resources);
        return (Object.keys(requested) as Array<GemColor>).every(color => this._vault[color] >= requested[color]);
    }

    public deposit(resources: ReadonlyArray<IResource>): void {
        this.assertNonNegative(resources);
        resources.forEach(resource => this._vault[resource.id] += resource.count);
    }

    public withdraw(request: ReadonlyArray<IResource>): Array<IResource> {
        this.assertNonNegative(request);

        if (!this.has(request))
            throw new GameRuleError("The bank does not have enough gems for that");

        request.forEach(x => this._vault[x.id] -= x.count);
        return request.map(x => ({ ...x }));
    }

    private assertNonNegative(resources: ReadonlyArray<IResource>): void {
        if (resources.some(r => !Number.isInteger(r.count) || r.count < 0))
            throw new GameRuleError("Gem counts must be whole numbers of 0 or more");
    }
}
