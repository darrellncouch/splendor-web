import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameRuleError } from "../src/core/errors/game-rule.error";
import { PurchaseCardService } from "../src/logic/purchase-card.service";
import { TakeGemsService } from "../src/logic/take-gems.service";
import { BankState } from "../src/state/bank.state";
import { PlayerState } from "../src/state/player.state";
import { card, startedGame } from "./helpers";

const take = new TakeGemsService();
const purchase = new PurchaseCardService();

function bank(perColor = 7, gold = 5) {
    const b = new BankState();
    b.initialize(perColor, gold);
    return b;
}

describe('TakeGemsService', () => {
    it('allows 3 different gems', () => {
        const p = new PlayerState('a', 'A', 't');
        const b = bank();
        take.execute(p, b, [{ id: 'white', count: 1 }, { id: 'blue', count: 1 }, { id: 'red', count: 1 }]);
        assert.equal(p.gemTotal, 3);
        assert.equal(b.getCount('white'), 6);
    });

    it('requires 3 different gems when 3+ colors are available', () => {
        assert.throws(() => take.validate(bank(), [{ id: 'white', count: 1 }]), /must take 3/);
        assert.throws(() => take.validate(bank(), [{ id: 'white', count: 1 }, { id: 'red', count: 1 }]), /must take 3/);
    });

    it('allows fewer different gems when the bank has fewer colors', () => {
        const b = bank(0);
        b.deposit([{ id: 'white', count: 1 }, { id: 'red', count: 1 }]);
        assert.doesNotThrow(() => take.validate(b, [{ id: 'white', count: 1 }, { id: 'red', count: 1 }]));
    });

    it('allows 2 of the same only when the bank has 4+', () => {
        assert.doesNotThrow(() => take.validate(bank(4), [{ id: 'green', count: 2 }]));
        assert.throws(() => take.validate(bank(3), [{ id: 'green', count: 2 }]), /4 or more/);
    });

    it('rejects mixed doubles, more than 2 of a color, 4+ colors and gold', () => {
        assert.throws(() => take.validate(bank(), [{ id: 'green', count: 2 }, { id: 'red', count: 1 }]), GameRuleError);
        assert.throws(() => take.validate(bank(), [{ id: 'green', count: 3 }]), GameRuleError);
        assert.throws(() => take.validate(bank(), ['white', 'blue', 'green', 'red'].map(id => ({ id: id as 'white', count: 1 }))), /at most 3/);
        assert.throws(() => take.validate(bank(), [{ id: 'gold', count: 1 }]), /Gold/);
        assert.throws(() => take.validate(bank(), []), /at least one/);
    });
});

describe('PurchaseCardService', () => {
    it('applies bonuses and fills the shortfall with gold', () => {
        const p = new PlayerState('a', 'A', 't');
        p.addPurchased(card({ id: 100, bonus: 'red' }));
        p.addGems([{ id: 'red', count: 1 }, { id: 'gold', count: 1 }]);
        const target = card({ id: 1, cost: [{ id: 'red', count: 3 }] });

        assert.deepEqual(purchase.computeAutoPayment(p, target), [{ id: 'red', count: 1 }, { id: 'gold', count: 1 }]);
        p.removeGems([{ id: 'gold', count: 1 }]);
        assert.equal(purchase.computeAutoPayment(p, target), null);
    });

    it('validates explicit payments', () => {
        const p = new PlayerState('a', 'A', 't');
        p.addGems([{ id: 'blue', count: 2 }, { id: 'gold', count: 2 }]);
        const target = card({ id: 1, cost: [{ id: 'blue', count: 2 }] });

        assert.doesNotThrow(() => purchase.validatePayment(p, target, [{ id: 'gold', count: 2 }]));
        assert.doesNotThrow(() => purchase.validatePayment(p, target, [{ id: 'blue', count: 1 }, { id: 'gold', count: 1 }]));
        assert.throws(() => purchase.validatePayment(p, target, [{ id: 'blue', count: 1 }]), /exactly 1 gold/);
        assert.throws(() => purchase.validatePayment(p, target, [{ id: 'blue', count: 2 }, { id: 'gold', count: 1 }]), /exactly 0 gold/);
    });
});

describe('GameEngine turn flow', () => {
    it('sets up the bank and nobles for the player count', () => {
        for (const [players, gems] of [[2, 4], [3, 5], [4, 7]]) {
            const g = startedGame(players);
            assert.equal(g.bank.getCount('red'), gems);
            assert.equal(g.bank.getCount('gold'), 5);
            assert.equal(g.nobles.available.length, players + 1);
            assert.equal(g.market.allFaceUp().length, 12);
        }
    });

    it('rejects moves out of turn and moves to the next player', () => {
        const g = startedGame(3);
        const [first, second] = g.state.players;
        const gems = [{ id: 'white' as const, count: 1 }, { id: 'blue' as const, count: 1 }, { id: 'green' as const, count: 1 }];

        assert.throws(() => g.performAction(second.id, { type: 'takeGems', gems }), /not your turn/);
        g.performAction(first.id, { type: 'takeGems', gems });
        assert.equal(g.state.currentPlayer?.id, second.id);
    });

    it('makes the player discard down to 10 before the turn ends', () => {
        const g = startedGame(2);
        const p = g.state.players[0];
        p.addGems([{ id: 'black', count: 9 }]); // pretend they already hold 9
        g.performAction(p.id, { type: 'takeGems', gems: [{ id: 'white', count: 1 }, { id: 'blue', count: 1 }, { id: 'green', count: 1 }] });

        assert.deepEqual(g.state.pending, { type: 'discard', playerId: p.id, count: 2 });
        assert.equal(g.state.currentPlayer?.id, p.id);
        assert.throws(() => g.performAction(p.id, { type: 'pass' }), /return 2/);
        assert.throws(() => g.performAction(p.id, { type: 'discardGems', gems: [{ id: 'black', count: 1 }] }), /exactly 2/);

        g.performAction(p.id, { type: 'discardGems', gems: [{ id: 'black', count: 2 }] });
        assert.equal(p.gemTotal, 10);
        assert.equal(g.state.pending, null);
        assert.equal(g.state.currentPlayer?.id, g.state.players[1].id);
    });

    it('gives a blind reserve plus gold, and hides it from other players', () => {
        const g = startedGame(2);
        const [p, other] = g.state.players;
        g.performAction(p.id, { type: 'reserveCard', source: { from: 'deck', tier: 3 } });

        assert.equal(p.getGemCount('gold'), 1);
        assert.equal(p.reservedCards.length, 1);

        const othersView = g.getPlayerView(other.id)!;
        const pInOthersView = othersView.board.players.find(x => x.id === p.id)!;
        assert.deepEqual(pInOthersView.reserved, [{ tier: 3 }]);
        assert.equal(g.getPlayerView(p.id)!.self.reserved[0].id, p.reservedCards[0].card.id);
    });

    it('lets the player choose when several nobles qualify', () => {
        const g = startedGame(2);
        const p = g.state.players[0];
        // Give p every bonus color 4 times, so they qualify for every noble
        let id = 10_000;
        for (const bonus of ['white', 'blue', 'green', 'red', 'black'] as const)
            for (let i = 0; i < 4; i++) p.addPurchased(card({ id: id++, bonus }));

        g.performAction(p.id, { type: 'takeGems', gems: [{ id: 'white', count: 1 }, { id: 'blue', count: 1 }, { id: 'green', count: 1 }] });
        const pending = g.state.pending;
        assert.equal(pending?.type, 'chooseNoble');
        if (pending?.type !== 'chooseNoble') return;

        g.performAction(p.id, { type: 'chooseNoble', nobleId: pending.nobleIds[0] });
        assert.equal(p.nobles.length, 1);
        assert.equal(g.nobles.available.length, 2);
        assert.equal(g.state.currentPlayer?.id, g.state.players[1].id);
    });

    it('plays out the final round before ending the game', () => {
        const g = startedGame(3);
        const [a, b, c] = g.state.players;
        a.addPurchased(card({ id: 20_000, prestige: 15 }));
        const gems = [{ id: 'white' as const, count: 1 }, { id: 'blue' as const, count: 1 }, { id: 'green' as const, count: 1 }];
        const gems2 = [{ id: 'red' as const, count: 1 }, { id: 'black' as const, count: 1 }, { id: 'green' as const, count: 1 }];

        g.performAction(a.id, { type: 'takeGems', gems });
        assert.equal(g.state.finalRound, true);
        assert.equal(g.state.phase, 'playing');
        g.performAction(b.id, { type: 'takeGems', gems: gems2 });
        c.addPurchased(card({ id: 20_001, prestige: 15 })); // c ties on prestige with the same number of cards
        g.performAction(c.id, { type: 'takeGems', gems });

        assert.equal(g.state.phase, 'finished');
        assert.deepEqual([...g.state.winnerIds].sort(), [a.id, c.id].sort());
    });
});
