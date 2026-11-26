import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ART } from '../art';
import { GEM_NAMES, sortByColor } from '../gems';
import { CardTier, ICard } from '../protocol';
import { GemComponent } from './gem.component';

/**
 * A face-up development card. Its width comes from `--card-w` and its height from
 * `--card-ratio` (theme.scss), so every card is the same size whatever its cost.
 */
@Component({
  selector: 'sp-card',
  imports: [GemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"bonus-" + card().bonus + " tier-" + card().tier',
    '[class.affordable]': 'affordable()',
    '[class.selected]': 'selected()',
    '[class.dim]': 'dim()',
    '[class.has-art]': '!!art()',
    '[style.--card-art]': 'art()',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <div class="top">
      <span class="prestige">{{ card().prestige || '' }}</span>
      <sp-gem [color]="card().bonus" size="sm" />
    </div>
    <div class="cost">
      @for (c of cost(); track c.id) {
        <span class="cost-row gem-{{ c.id }}">
          <span class="pip">{{ c.count }}</span>
          <i class="mini-gem" aria-hidden="true"></i>
        </span>
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
      flex: none;
      width: var(--w);
      height: calc(var(--w) * var(--card-ratio, 1.6));
      overflow: hidden;
      padding: calc(var(--w) * .06);
      border-radius: calc(var(--w) * .08);
      background:
        linear-gradient(160deg, rgba(255,255,255,.2), transparent 45%),
        linear-gradient(180deg, var(--gem) 0 calc(var(--w) * .4), var(--gem-dark) calc(var(--w) * .4) calc(var(--w) * .42), transparent calc(var(--w) * .42)),
        var(--parchment);
      box-shadow:
        0 3px 8px rgba(0,0,0,.5),
        inset 0 0 0 1px rgba(110,66,20,.6),
        inset 0 0 calc(var(--w) * .12) rgba(120,70,20,.5);
      color: var(--gem-fg);
      transition: transform .15s ease, box-shadow .15s ease, opacity .15s;
      font-size: calc(var(--w) * .1);
    }
    .top { display: flex; justify-content: space-between; align-items: flex-start; }
    .top sp-gem { --d: calc(var(--w) * .26); }
    .prestige {
      font-size: calc(var(--w) * .32);
      font-weight: 900;
      line-height: 1;
      color: #fff;
      text-shadow: 0 0 3px #000, 0 2px 3px #000;
    }
    .cost { display: flex; flex-direction: column-reverse; gap: calc(var(--w) * .035); align-items: flex-start; }
    /* the gem sits over the right edge of its cost circle */
    .cost-row { display: flex; align-items: center; }
    .mini-gem {
      position: relative;
      margin-left: calc(var(--w) * -.07);
      width: calc(var(--w) * .19);
      height: calc(var(--w) * .19);
      background: var(--gem-art) center / contain no-repeat;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,.45));
    }
    .pip {
      display: grid;
      place-items: center;
      width: calc(var(--w) * .24);
      height: calc(var(--w) * .24);
      border-radius: 50%;
      font-weight: 800;
      font-size: calc(var(--w) * .15);
      color: var(--gem-fg);
      background: color-mix(in srgb, var(--gem) 72%, transparent);
      backdrop-filter: blur(2px);
      box-shadow: inset 0 0 0 2px var(--gem-dark), 0 1px 2px rgba(0,0,0,.5);
      text-shadow: 0 0 3px var(--gem-shadow);
    }
    /* Illustrated version (host only): the art fills the card under a see-through color band */
    :host(.has-art) {
      background:
        linear-gradient(160deg, rgba(255,255,255,.2), transparent 40%),
        linear-gradient(180deg,
          color-mix(in srgb, var(--gem) 88%, transparent) 0 calc(var(--w) * .4),
          var(--gem-dark) calc(var(--w) * .4) calc(var(--w) * .42),
          transparent calc(var(--w) * .42)),
        var(--card-art) center calc(var(--w) * .42) / cover no-repeat,
        #2a1a0c;
      box-shadow:
        0 3px 8px rgba(0,0,0,.5),
        inset 0 0 0 calc(var(--w) * .025) #c9a25a,
        inset 0 0 0 calc(var(--w) * .035) rgba(0,0,0,.5);
    }
    :host(.has-art) .tier-dots { color: rgba(255,255,255,.75); text-shadow: 0 1px 2px #000; }
    .tier-dots {
      position: absolute;
      right: calc(var(--w) * .07);
      bottom: calc(var(--w) * .04);
      color: rgba(80,45,10,.45);
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

  private readonly artProvider = inject(ART);
  protected readonly art = computed(() => {
    const url = this.artProvider.card(this.card());
    return url ? `url("${url}")` : null;
  });
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
  host: {
    '[class]': '"tier-" + tier()',
    '[class.has-art]': '!!art()',
    '[style.--back-art]': 'art()',
    '[attr.aria-label]': '"Tier " + tier() + " deck"',
  },
  template: `
    <span class="dots" aria-hidden="true">@for (d of dots(); track $index) { <i></i> }</span>
    @if (remaining() !== null) { <span class="remaining">{{ remaining() }}</span> }
  `,
  styles: `
    :host {
      --w: var(--card-w, 7rem);
      display: grid;
      place-items: center;
      gap: .1em;
      flex: none;
      width: var(--w);
      height: calc(var(--w) * var(--card-ratio, 1.6));
      border-radius: calc(var(--w) * .08);
      align-content: end;
      padding-bottom: calc(var(--w) * .12);
      background:
        var(--jolly-roger) center 34% / 66% no-repeat,
        repeating-linear-gradient(45deg, rgba(0,0,0,.08) 0 3px, transparent 3px 6px),
        radial-gradient(circle at 50% 38%, var(--tier-light), var(--tier) 75%);
      box-shadow:
        0 3px 8px rgba(0,0,0,.5),
        inset 0 0 0 calc(var(--w) * .035) #c9a25a,
        inset 0 0 0 calc(var(--w) * .05) rgba(0,0,0,.45);
      color: #f6ebd2;
      font-size: calc(var(--w) * .14);
    }
    /* Illustrated back (host only): the painting replaces the emblem; the bottom is shaded for the count */
    :host(.has-art) {
      background:
        linear-gradient(180deg, transparent 60%, rgba(0,0,0,.75)),
        var(--back-art) center / cover no-repeat,
        var(--tier);
    }
    .dots { display: flex; gap: calc(var(--w) * .05); margin-bottom: calc(var(--w) * .03); }
    .dots i {
      width: calc(var(--w) * .13);
      height: calc(var(--w) * .13);
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #fff8e6, #f0d89a 55%, #c9a25a);
      box-shadow: 0 0 0 calc(var(--w) * .012) rgba(60,35,5,.8), 0 1px 3px rgba(0,0,0,.7);
    }
    :host(.has-art) .dots i { box-shadow: 0 0 0 calc(var(--w) * .012) rgba(0,0,0,.85), 0 0 6px #000; }
    .remaining { font-weight: 800; opacity: .9; text-shadow: 0 1px 2px #000; }
  `,
})
export class CardBackComponent {
  readonly tier = input.required<CardTier>();
  readonly remaining = input<number | null>(null);

  private readonly artProvider = inject(ART);
  protected readonly art = computed(() => {
    const url = this.artProvider.cardBack(this.tier());
    return url ? `url("${url}")` : null;
  });
  protected readonly dots = computed(() => Array.from({ length: this.tier() }));
}
