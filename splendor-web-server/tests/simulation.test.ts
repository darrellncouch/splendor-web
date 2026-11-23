import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_GEM_COLORS } from "../src/core/constants/gem-colors.constant";
import { PlayerAction } from "../src/core/interfaces/player-action.interface";
import { IResource } from "../src/core/interfaces/resource.interface";
import { RandomFn } from "../src/core/utils/shuffle.util";
import { GameEngine } from "../src/gameEngine";
import { seeded, startedGame } from "./helpers";

/**
 * Bots play complete games using only what a real client gets (the player view and its action flags).
 * Checks that tokens are never created or destroyed and nobody ends a turn above 10.
 */
function totalTokens(g: GameEngine): number {
    const bank = g.bank.getCurrent().reduce((s, r) => s + r.count, 0);
    return bank + g.state.players.reduce((s, p) => s + p.gemTotal, 0);
}

function pick<T>(items: ReadonlyArray<T>, random: RandomFn): T {
    return items[Math.floor(random() * items.length)];
}

function chooseAction(g: GameEngine, playerId: string, random: RandomFn): PlayerAction {
    const view = g.getPlayerView(playerId)!;
    const a = view.actions;
    const self = view.self;

    if (a.pending?.type === 'discard') {
        const gems: Array<IResource> = [];
        let left = a.pending.count;
        for (const { id, count } of self.gems) {
            const n = Math.min(count, left);
            if (n > 0) gems.push({ id, count: n });
            left -= n;
        }
        return { type: 'discardGems', gems };
    }
    if (a.pending?.type === 'chooseNoble')
        return { type: 'chooseNoble', nobleId: pick(a.pending.nobleIds, random) };

    if (a.canPurchase && random() < 0.85)
        return { type: 'purchaseCard', cardId: pick(a.affordableCardIds, random) };

    const roll = random();
    if (a.canReserve && roll < 0.1) {
        const market = view.board.market.flatMap(d => d.cards).filter(c => c !== null);
        if (market.length && random() < 0.7) return { type: 'reserveCard', source: { from: 'market', cardId: pick(market, random)!.id } };
        if (a.reservableDeckTiers.length) return { type: 'reserveCard', source: { from: 'deck', tier: pick(a.reservableDeckTiers, random) } };
    }
    if (a.canTakeGems) {
        if (a.doubleGemColors.length && random() < 0.3)
            return { type: 'takeGems', gems: [{ id: pick(a.doubleGemColors, random), count: 2 }] };
        const colors = [...a.distinctGemColors].sort(() => random() - 0.5).slice(0, a.requiredDistinctCount);
        return { type: 'takeGems', gems: colors.map(id => ({ id, count: 1 })) };
    }
    if (a.canReserve && a.reservableDeckTiers.length)
        return { type: 'reserveCard', source: { from: 'deck', tier: pick(a.reservableDeckTiers, random) } };
    if (a.canPurchase)
        return { type: 'purchaseCard', cardId: pick(a.affordableCardIds, random) };
    assert.ok(a.canPass, 'bot found no action but canPass is false');
    return { type: 'pass' };
}

describe('full game simulation', () => {
    for (const players of [2, 3, 4]) {
        it(`completes 25 random ${players}-player games without breaking rules`, () => {
            for (let seed = 1; seed <= 25; seed++) {
                const g = startedGame(players, seed);
                const random = seeded(seed * 31);
                const tokens = totalTokens(g);
                let steps = 0;

                while (g.state.phase === 'playing') {
                    assert.ok(++steps < 5000, `seed ${seed}: game did not finish`);
                    const current = g.state.currentPlayer!;
                    g.performAction(current.id, chooseAction(g, current.id, random));

                    assert.equal(totalTokens(g), tokens, `seed ${seed}: tokens were created or destroyed`);
                    for (const color of ALL_GEM_COLORS) assert.ok(g.bank.getCount(color) >= 0);
                    if (!g.state.pending)
                        for (const p of g.state.players) assert.ok(p.gemTotal <= 10, `seed ${seed}: ${p.name} has ${p.gemTotal} tokens`);
                }

                assert.equal(g.state.phase, 'finished');
                assert.ok(g.state.winnerIds.length >= 1);
                const best = Math.max(...g.state.players.map(p => p.prestige));
                assert.ok(best >= 15, `seed ${seed}: game ended with top score ${best}`);
            }
        });
    }
});
