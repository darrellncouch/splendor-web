import { GameRules } from "../core/constants/game-rules.constant";
import { BASIC_GEM_COLORS } from "../core/constants/gem-colors.constant";
import { GemId } from "../core/constants/gem-ids.constant";
import { GameRuleError } from "../core/errors/game-rule.error";
import { IResource } from "../core/interfaces/resource.interface";
import { BasicGemColor } from "../core/types/gem-color.type";
import { BankState } from "../state/bank.state";
import { PlayerState } from "../state/player.state";

export interface ITakeGemOptions {
    distinctColors: Array<BasicGemColor>;
    doubleColors: Array<BasicGemColor>;
    requiredDistinct: number;
}

/**
 * The "take gems" action:
 *  - take 3 gems of different colors (fewer only if the bank has fewer than 3 colors left), or
 *  - take 2 gems of one color, if the bank has at least 4 of that color.
 * Gold can never be taken this way.
 * Going over 10 tokens is allowed here. The turn service then makes the player discard.
 */
export class TakeGemsService {

    public getOptions(bank: BankState): ITakeGemOptions {
        const distinctColors = BASIC_GEM_COLORS.filter(c => bank.getCount(c) > 0);
        const doubleColors = BASIC_GEM_COLORS.filter(c => bank.getCount(c) >= GameRules.MIN_BANK_FOR_DOUBLE);
        return {
            distinctColors,
            doubleColors,
            requiredDistinct: Math.min(GameRules.MAX_DISTINCT_TAKE, distinctColors.length),
        };
    }

    public canTakeAny(bank: BankState): boolean {
        return this.getOptions(bank).distinctColors.length > 0;
    }

    /** `request` must already be cleaned by parseResources (no duplicate colors, no zero or negative counts). */
    public validate(bank: BankState, request: ReadonlyArray<IResource>): void {
        if (request.length === 0)
            throw new GameRuleError("Select at least one gem to take");

        //GAME RULE: Gold tokens are only available when reserving a card
        if (request.some(x => x.id === GemId.GOLD))
            throw new GameRuleError("Gold can't be taken from the bank. You get one when you reserve a card, if any are left");

        const options = this.getOptions(bank);

        //GAME RULE: 2 of the same color
        if (request.some(x => x.count > 1)) {
            if (request.length !== 1 || request[0].count !== 2)
                throw new GameRuleError("Take 3 different gems or 2 of the same gem");

            //GAME RULE: only if the bank has 4 or more of that color
            if (!options.doubleColors.includes(request[0].id as BasicGemColor))
                throw new GameRuleError(`You can only take 2 ${request[0].id} gems if the bank has ${GameRules.MIN_BANK_FOR_DOUBLE} or more`);
            return;
        }

        //GAME RULE: up to 3 different colors
        if (request.length > GameRules.MAX_DISTINCT_TAKE)
            throw new GameRuleError(`You can take at most ${GameRules.MAX_DISTINCT_TAKE} different gems`);

        if (!bank.has(request))
            throw new GameRuleError("The bank doesn't have enough of those gems");

        //GAME RULE: you must take 3 different gems unless the bank has fewer than 3 colors left
        if (request.length < options.requiredDistinct)
            throw new GameRuleError(`You must take ${options.requiredDistinct} different gems`);
    }

    public execute(player: PlayerState, bank: BankState, request: ReadonlyArray<IResource>): Array<IResource> {
        this.validate(bank, request);
        const taken = bank.withdraw(request);
        player.addGems(taken);
        return taken;
    }
}
