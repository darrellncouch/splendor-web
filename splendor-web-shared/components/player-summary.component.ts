import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ALL_GEM_COLORS, BASIC_GEM_COLORS, countOf } from '../gems';
import { IBonus, INoble, IResource } from '../protocol';
import { CardBackComponent } from './card.component';
import { GemComponent } from './gem.component';
import { NobleComponent } from './noble.component';

/**
 * A player's tokens, bonuses and nobles. The host uses it in its player panels and the
 * phones use it for the other-player tabs. Put extra content (like reserved cards) inside it.
 */
@Component({
  selector: 'sp-player-summary',
  imports: [GemComponent, NobleComponent, CardBackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <span class="label">Gems <b>{{ gemTotal() }}</b>/10</span>
      <div class="items">
        @for (c of gemColors; track c) {
          <sp-gem [color]="c" [count]="gemCount(c)" [size]="gemSize()" />
        }
      </div>
    </div>
    <div class="row">
      <span class="label">Bonuses</span>
      <div class="items">
        @for (c of bonusColors; track c) {
          <span class="bonus gem-{{ c }}" [class.empty]="!bonusCount(c)" [attr.aria-label]="bonusCount(c) + ' ' + c + ' bonus'">{{ bonusCount(c) }}</span>
        }
      </div>
    </div>
    @if (reservedTiers().length) {
      <div class="row">
        <span class="label">Reserved</span>
        <div class="items reserved">
          @for (t of reservedTiers(); track $index) { <sp-card-back [tier]="t" /> }
        </div>
      </div>
    }
    <ng-content />
    @if (nobles().length) {
      <div class="row">
        <span class="label">Nobles</span>
        <div class="items nobles">
          @for (n of nobles(); track n.id) { <sp-noble [noble]="n" /> }
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: .55em; }
    .row { display: flex; flex-direction: column; gap: .3em; }
    .label { font-size: .75em; text-transform: uppercase; letter-spacing: .08em; opacity: .7; }
    .label b { font-size: 1.2em; opacity: 1; }
    .items { display: flex; flex-wrap: wrap; gap: .35em; align-items: center; }
    .items:has(sp-gem) { gap: .55em; } /* room for the count badge */
    .bonus {
      display: grid;
      place-items: center;
      min-width: 1.9em;
      height: 2.5em;
      border-radius: .3em;
      font-weight: 900;
      font-size: 1.05em;
      color: var(--gem-fg);
      background: linear-gradient(160deg, rgba(255,255,255,.25), transparent 50%), var(--gem);
      box-shadow: inset 0 0 0 2px var(--gem-dark), 0 1px 3px rgba(0,0,0,.4);
    }
    .bonus.empty { opacity: .25; }
    .reserved { --card-w: 2.4rem; }
    .nobles { --noble-w: 3.6rem; }
  `,
})
export class PlayerSummaryComponent {
  readonly gems = input.required<IResource[]>();
  readonly gemTotal = input.required<number>();
  readonly bonuses = input.required<IBonus[]>();
  readonly nobles = input<INoble[]>([]);
  /** Face-down reserved cards, by tier. Leave empty if you show face-up reserves yourself. */
  readonly reservedTiers = input<Array<1 | 2 | 3>>([]);
  readonly gemSize = input<'xs' | 'sm' | 'md' | 'lg'>('sm');

  protected readonly gemColors = ALL_GEM_COLORS;
  protected readonly bonusColors = BASIC_GEM_COLORS;
  private readonly bonusMap = computed(() => new Map(this.bonuses().map(b => [b.id, b.quantity])));

  protected gemCount(color: (typeof ALL_GEM_COLORS)[number]): number {
    return countOf(this.gems(), color);
  }

  protected bonusCount(color: (typeof BASIC_GEM_COLORS)[number]): number {
    return this.bonusMap().get(color) ?? 0;
  }
}
