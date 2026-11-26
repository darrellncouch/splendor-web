import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CardBackComponent, CardComponent } from '@shared/components/card.component';
import { GemComponent } from '@shared/components/gem.component';
import { NobleComponent } from '@shared/components/noble.component';
import { PlayerSummaryComponent } from '@shared/components/player-summary.component';
import { ALL_GEM_COLORS, BASIC_GEM_COLORS, countOf, GEM_NAMES } from '@shared/gems';
import { BasicGemColor, CardTier, GemColor, ICard, IPlayer, IPlayerView, PlayerAction, ReserveSource } from '@shared/protocol';
import { RulesComponent } from './rules.component';

type Sheet = 'take' | 'buy' | 'reserve' | null;

/**
 * The in-game phone screen: a "Me" tab, one tab per opponent, and the action bar. Buttons are
 * turned on and off from the server's `actions` flags. Picking gems or cards here is just for
 * input. The server checks every move.
 */
@Component({
  selector: 'sp-game',
  imports: [GemComponent, CardComponent, CardBackComponent, NobleComponent, PlayerSummaryComponent, RulesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent {
  readonly view = input.required<IPlayerView>();
  readonly stateVersion = input(0);
  readonly isVip = input(false);
  readonly action = output<PlayerAction>();
  readonly playAgain = output<void>();
  /** The player wants out of this room (back to the join screen). */
  readonly leave = output<void>();

  protected confirmLeave(): void {
    const playing = this.view().board.phase === 'playing';
    const msg = playing
      ? 'Leave this game? You will not be able to rejoin your seat.'
      : 'Leave this room?';
    if (confirm(msg)) this.leave.emit();
  }

  protected readonly gemNames = GEM_NAMES;
  protected readonly basicColors = BASIC_GEM_COLORS;
  protected readonly allColors = ALL_GEM_COLORS;
  protected readonly countOf = countOf;

  /** 'me' or an opponent's player id */
  protected readonly tab = signal<string>('me');
  protected readonly sheet = signal<Sheet>(null);
  protected readonly gemPick = signal<Partial<Record<BasicGemColor, number>>>({});
  protected readonly cardPick = signal<{ kind: 'card'; id: number } | { kind: 'deck'; tier: CardTier } | null>(null);
  protected readonly discardPick = signal<Partial<Record<GemColor, number>>>({});

  protected readonly board = computed(() => this.view().board);
  protected readonly self = computed(() => this.view().self);
  protected readonly actions = computed(() => this.view().actions);
  protected readonly opponents = computed(() => this.board().players.filter(p => p.id !== this.self().id));
  protected readonly activeOpponent = computed(() => this.opponents().find(p => p.id === this.tab()) ?? null);
  protected readonly currentPlayer = computed(() => this.board().players.find(p => p.isCurrentTurn) ?? null);
  protected readonly rows = computed(() => [...this.board().market].sort((a, b) => b.tier - a.tier));
  protected readonly affordable = computed(() => new Set(this.actions().affordableCardIds));

  protected readonly pending = computed(() => this.actions().pending);
  protected readonly pendingNobles = computed(() => {
    const p = this.pending();
    return p?.type === 'chooseNoble' ? this.board().availableNobles.filter(n => p.nobleIds.includes(n.id)) : [];
  });

  // ---- take gems ----
  protected readonly gemPickTotal = computed(() => Object.values(this.gemPick()).reduce((a, b) => a + (b ?? 0), 0));
  protected readonly gemPickValid = computed(() => {
    const picks = Object.entries(this.gemPick()).filter(([, n]) => (n ?? 0) > 0);
    const a = this.actions();
    if (picks.length === 1 && picks[0][1] === 2) return true;
    return picks.length > 0 && picks.every(([, n]) => n === 1) && picks.length === a.requiredDistinctCount;
  });
  protected readonly gemHint = computed(() => {
    const a = this.actions();
    const doubles = a.doubleGemColors.length ? ' or 2 of the same color' : '';
    return `Pick ${a.requiredDistinctCount} different color${a.requiredDistinctCount === 1 ? '' : 's'}${doubles}.`;
  });
  protected readonly overLimitAfterTake = computed(() => Math.max(0, this.self().gemTotal + this.gemPickTotal() - 10));

  // ---- discard ----
  protected readonly discardTotal = computed(() => Object.values(this.discardPick()).reduce((a, b) => a + (b ?? 0), 0));

  constructor() {
    // A new state from the server means our move went through (or it's someone else's turn now), so reset the pickers.
    effect(() => {
      this.stateVersion();
      const a = this.view().actions;
      if (!a.isYourTurn || a.pending) this.sheet.set(null);
      this.gemPick.set({});
      this.cardPick.set(null);
      if (a.pending?.type !== 'discard') this.discardPick.set({});
    });
  }

  protected openSheet(sheet: Sheet): void {
    this.gemPick.set({});
    this.cardPick.set(null);
    this.sheet.set(sheet);
  }

  // ---- gem picker ----
  protected tapGem(color: BasicGemColor): void {
    const a = this.actions();
    const picks = { ...this.gemPick() };
    const current = picks[color] ?? 0;
    const others = Object.entries(picks).filter(([c, n]) => c !== color && (n ?? 0) > 0).length;

    if (current === 0) {
      if (!a.distinctGemColors.includes(color)) return;
      if (Object.values(picks).some(n => n === 2)) return; // already taking a double
      if (others >= 3) return;
      picks[color] = 1;
    } else if (current === 1 && others === 0 && a.doubleGemColors.includes(color)) {
      picks[color] = 2;
    } else {
      delete picks[color];
    }
    this.gemPick.set(picks);
  }

  protected gemPickCount(color: BasicGemColor): number {
    return this.gemPick()[color] ?? 0;
  }

  protected confirmTake(): void {
    const gems = Object.entries(this.gemPick())
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([id, count]) => ({ id: id as BasicGemColor, count: count! }));
    this.action.emit({ type: 'takeGems', gems });
  }

  // ---- card pickers ----
  protected pickCard(card: ICard): void {
    if (this.sheet() === 'buy' && !this.affordable().has(card.id)) return;
    const cur = this.cardPick();
    this.cardPick.set(cur?.kind === 'card' && cur.id === card.id ? null : { kind: 'card', id: card.id });
  }

  protected pickDeck(tier: CardTier): void {
    if (!this.actions().reservableDeckTiers.includes(tier)) return;
    this.cardPick.set({ kind: 'deck', tier });
  }

  protected isPicked(card: ICard): boolean {
    const cur = this.cardPick();
    return cur?.kind === 'card' && cur.id === card.id;
  }

  protected isDeckPicked(tier: CardTier): boolean {
    const cur = this.cardPick();
    return cur?.kind === 'deck' && cur.tier === tier;
  }

  protected confirmCard(): void {
    const pick = this.cardPick();
    if (!pick) return;
    if (this.sheet() === 'buy' && pick.kind === 'card') {
      this.action.emit({ type: 'purchaseCard', cardId: pick.id });
    } else if (this.sheet() === 'reserve') {
      const source: ReserveSource = pick.kind === 'card' ? { from: 'market', cardId: pick.id } : { from: 'deck', tier: pick.tier };
      this.action.emit({ type: 'reserveCard', source });
    }
  }

  /** Buy straight from the reserved hand on the Me tab. */
  protected buyReserved(cardId: number): void {
    if (this.actions().canPurchase && this.affordable().has(cardId)) this.action.emit({ type: 'purchaseCard', cardId });
  }

  protected pass(): void {
    this.action.emit({ type: 'pass' });
  }

  /** Put the gems just taken back instead of discarding. The turn starts over with every move available. */
  protected undoTake(): void {
    this.action.emit({ type: 'undoTakeGems' });
  }

  // ---- discard ----
  protected adjustDiscard(color: GemColor, delta: number): void {
    const p = this.pending();
    if (p?.type !== 'discard') return;
    const have = countOf(this.self().gems, color);
    const cur = this.discardPick()[color] ?? 0;
    const next = Math.max(0, Math.min(have, cur + delta));
    if (delta > 0 && this.discardTotal() >= p.count) return;
    this.discardPick.set({ ...this.discardPick(), [color]: next });
  }

  protected discardCount(color: GemColor): number {
    return this.discardPick()[color] ?? 0;
  }

  protected confirmDiscard(): void {
    const gems = Object.entries(this.discardPick())
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([id, count]) => ({ id: id as GemColor, count: count! }));
    this.action.emit({ type: 'discardGems', gems });
  }

  protected chooseNoble(nobleId: number): void {
    this.action.emit({ type: 'chooseNoble', nobleId });
  }

  // ---- helpers ----
  protected reservedTiers(p: IPlayer): CardTier[] {
    return p.reserved.map(r => r.tier);
  }

  protected readonly standings = computed(() =>
    [...this.board().players].sort((a, b) => b.prestige - a.prestige || a.purchasedCount - b.purchasedCount),
  );

  protected isWinner(p: IPlayer): boolean {
    return this.board().winnerIds.includes(p.id);
  }
}
