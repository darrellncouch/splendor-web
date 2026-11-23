import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CardBackComponent, CardComponent } from '@shared/components/card.component';
import { GemComponent } from '@shared/components/gem.component';
import { NobleComponent } from '@shared/components/noble.component';
import { PlayerSummaryComponent } from '@shared/components/player-summary.component';
import { ALL_GEM_COLORS, countOf } from '@shared/gems';
import { IBoard, IPlayer } from '@shared/protocol';

/** The main board shown on the host screen: nobles, the 3 market rows, the bank, players, log, and results. */
@Component({
  selector: 'sp-board',
  imports: [CardComponent, CardBackComponent, NobleComponent, GemComponent, PlayerSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent {
  readonly board = input.required<IBoard>();
  readonly playAgain = output<void>();
  readonly closeRoom = output<void>();

  protected readonly gemColors = ALL_GEM_COLORS;
  protected readonly countOf = countOf;

  /** Tier 3 on top, like the real table. */
  protected readonly rows = computed(() => [...this.board().market].sort((a, b) => b.tier - a.tier));

  protected readonly currentPlayer = computed(() =>
    this.board().players.find(p => p.id === this.board().currentPlayerId) ?? null,
  );

  protected readonly recentLog = computed(() => [...this.board().log].reverse().slice(0, 8));

  protected readonly standings = computed(() =>
    [...this.board().players].sort((a, b) => b.prestige - a.prestige || a.purchasedCount - b.purchasedCount),
  );

  protected confirm(message: string): boolean {
    return window.confirm(message);
  }

  protected isWinner(p: IPlayer): boolean {
    return this.board().winnerIds.includes(p.id);
  }

  protected reservedTiers(p: IPlayer): Array<1 | 2 | 3> {
    return p.reserved.map(r => r.tier);
  }

  protected pendingLabel(p: IPlayer): string | null {
    const pending = this.board().pending;
    if (!pending || pending.playerId !== p.id) return null;
    return pending.type === 'discard' ? `Returning ${pending.count} gem${pending.count > 1 ? 's' : ''}` : 'Choosing a noble';
  }
}
