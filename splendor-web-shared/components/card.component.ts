import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GEM_NAMES, sortByColor } from '../gems';
import { CardTier, ICard } from '../protocol';
import { GemComponent } from './gem.component';

/** A face-up development card. Its size comes from the `--card-w` CSS variable. */
@Component({
  selector: 'sp-card',
  imports: [GemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"bonus-" + card().bonus + " tier-" + card().tier',
    '[class.affordable]': 'affordable()',
    '[class.selected]': 'selected()',
    '[class.dim]': 'dim()',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <div class="top">
      <span class="prestige">{{ card().prestige || '' }}</span>
      <sp-gem [color]="card().bonus" size="sm" />
    </div>
    <div class="cost">
      @for (c of cost(); track c.id) {
        <span class="pip gem-{{ c.id }}">{{ c.count }}</span>
      }
    </div>
    <span class="tier-dots">{{ dots() }}</span>
  `,
  styles: `
    :host {
      --w: var(--card-w, 7rem);
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: var(--w);
      aspect-ratio: 5 / 7;
      padding: calc(var(--w) * .06);
      border-radius: calc(var(--w) * .08);
      background:
        linear-gradient(160deg, rgba(255,255,255,.22), transparent 45%),
        linear-gradient(180deg, var(--gem) 0 26%, var(--gem-dark) 26.5% 27.5%, var(--card-body) 28%);
      box-shadow: 0 3px 8px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,255,255,.12);
      color: var(--gem-fg);
      transition: transform .15s ease, box-shadow .15s ease, opacity .15s;
      font-size: calc(var(--w) * .1);
    }
    .top { display: flex; justify-content: space-between; align-items: flex-start; }
    .top sp-gem { --d: calc(var(--w) * .26); }
    .prestige {
      font-size: calc(var(--w) * .3);
      font-weight: 900;
      line-height: 1;
      color: #fff;
      text-shadow: 0 0 3px #000, 0 2px 3px #000;
    }
    .cost { display: flex; flex-direction: column-reverse; gap: calc(var(--w) * .035); align-items: flex-start; }
    .pip {
      display: grid;
      place-items: center;
      width: calc(var(--w) * .24);
      height: calc(var(--w) * .24);
      border-radius: 50%;
      font-weight: 800;
      font-size: calc(var(--w) * .15);
      color: var(--gem-fg);
      background: var(--gem);
      box-shadow: inset 0 0 0 2px var(--gem-dark), 0 1px 2px rgba(0,0,0,.5);
    }
    .tier-dots {
      position: absolute;
      right: calc(var(--w) * .07);
      bottom: calc(var(--w) * .04);
      color: rgba(255,255,255,.55);
      letter-spacing: .1em;
    }
    :host(.affordable) { box-shadow: 0 0 0 3px var(--accent), 0 0 18px var(--accent-glow); }
    :host(.selected) { transform: translateY(-6%); box-shadow: 0 0 0 4px #fff, 0 0 22px rgba(255,255,255,.7); }
    :host(.dim) { opacity: .45; filter: saturate(.6); }
  `,
})
export class CardComponent {
  readonly card = input.required<ICard>();
  readonly affordable = input(false);
  readonly selected = input(false);
  readonly dim = input(false);

  protected readonly cost = computed(() => sortByColor(this.card().cost.filter(c => c.count > 0)));
  protected readonly dots = computed(() => '•'.repeat(this.card().tier));
  protected readonly label = computed(() => {
    const c = this.card();
    const cost = this.cost().map(x => `${x.count} ${GEM_NAMES[x.id]}`).join(', ');
    return `Tier ${c.tier} ${GEM_NAMES[c.bonus]} card, ${c.prestige} prestige, costs ${cost || 'nothing'}`;
  });
}

/** The back of a card: a deck pile or a face-down reserve. */
@Component({
  selector: 'sp-card-back',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"tier-" + tier()', '[attr.aria-label]': '"Tier " + tier() + " deck"' },
  template: `
    <span class="dots">{{ dots() }}</span>
    @if (remaining() !== null) { <span class="remaining">{{ remaining() }}</span> }
  `,
  styles: `
    :host {
      --w: var(--card-w, 7rem);
      display: grid;
      place-items: center;
      align-content: center;
      gap: .2em;
      width: var(--w);
      aspect-ratio: 5 / 7;
      border-radius: calc(var(--w) * .08);
      background:
        repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 6px, transparent 6px 12px),
        radial-gradient(circle, var(--tier-light), var(--tier));
      box-shadow: 0 3px 8px rgba(0,0,0,.45), inset 0 0 0 calc(var(--w) * .04) rgba(255,255,255,.25);
      color: #fff;
      font-size: calc(var(--w) * .14);
    }
    .dots { font-size: calc(var(--w) * .22); letter-spacing: .15em; }
    .remaining { font-weight: 800; opacity: .9; }
  `,
})
export class CardBackComponent {
  readonly tier = input.required<CardTier>();
  readonly remaining = input<number | null>(null);
  protected readonly dots = computed(() => '•'.repeat(this.tier()));
}
