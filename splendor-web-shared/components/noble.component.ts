import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ART } from '../art';
import { GEM_NAMES, sortByColor } from '../gems';
import { INoble } from '../protocol';

/**
 * A noble tile: prestige plus the card bonuses it requires. Its width comes from `--noble-w`
 * and its height from `--noble-ratio` (height / width, default square).
 */
@Component({
  selector: 'sp-noble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.selected]': 'selected()',
    '[style.--noble-img]': 'image()',
    '[class.has-art]': '!!image()',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <div class="req">
      @for (c of cost(); track c.id) {
        <span class="req-row gem-{{ c.id }}">
          <span class="bar">{{ c.count }}</span>
          <i class="mini-gem" aria-hidden="true"></i>
        </span>
      }
    </div>
    <span class="prestige">{{ noble().prestige }}</span>
  `,
  styles: `
    :host {
      --w: var(--noble-w, 6rem);
      position: relative;
      display: flex;
      justify-content: space-between;
      width: var(--w);
      aspect-ratio: 1 / var(--noble-ratio, 1);
      padding: calc(var(--w) * .07);
      border-radius: calc(var(--w) * .08);
      /* weathered parchment, like a wanted poster */
      background:
        var(--noble-img, none) center 15% / cover no-repeat,
        var(--parchment);
      box-shadow:
        0 3px 8px rgba(0,0,0,.5),
        inset 0 0 0 1px rgba(110,66,20,.6),
        inset 0 0 calc(var(--w) * .14) rgba(120,70,20,.55);
    }
    /* frosted strip down the left edge, just wide enough for the squares and their gems.
       The negative margin pulls it out to the inside of the frame. */
    .req {
      display: flex;
      flex-direction: column;
      gap: calc(var(--w) * .04);
      margin: calc(var(--w) * -.025) 0 calc(var(--w) * -.025) calc(var(--w) * -.025);
      padding: calc(var(--w) * .05) calc(var(--w) * .03) calc(var(--w) * .05) calc(var(--w) * .045);
      border-radius: calc(var(--w) * .05) 0 0 calc(var(--w) * .05);
      background: rgba(255, 255, 255, .3);
      backdrop-filter: blur(3px);
      box-shadow: 1px 0 0 rgba(255, 255, 255, .35);
    }
    /* the gem sits over the right edge of its requirement square */
    .req-row { display: flex; align-items: center; }
    .mini-gem {
      position: relative;
      margin-left: calc(var(--w) * -.06);
      width: calc(var(--w) * .18);
      height: calc(var(--w) * .18);
      background: var(--gem-art) center / contain no-repeat;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,.45));
    }
    .bar {
      display: grid;
      place-items: center;
      width: calc(var(--w) * .2);
      height: calc(var(--w) * .25);
      border-radius: 3px;
      font-weight: 800;
      font-size: calc(var(--w) * .15);
      color: var(--gem-fg);
      background: color-mix(in srgb, var(--gem) 72%, transparent);
      backdrop-filter: blur(2px);
      box-shadow: inset 0 0 0 2px var(--gem-dark), 0 1px 2px rgba(0,0,0,.5);
      text-shadow: 0 0 3px var(--gem-shadow);
    }
    .prestige {
      font-size: calc(var(--w) * .34);
      font-weight: 900;
      line-height: 1;
      color: #fff;
      text-shadow: 0 0 3px #000, 0 2px 3px #000;
    }
    /* portrait frame, like a captain's painting */
    :host(.has-art) {
      box-shadow:
        0 3px 8px rgba(0,0,0,.5),
        inset 0 0 0 calc(var(--w) * .03) #c9a25a,
        inset 0 0 0 calc(var(--w) * .045) rgba(0,0,0,.5),
        inset 0 calc(var(--w) * -.25) calc(var(--w) * .2) rgba(0,0,0,.35);
    }
    :host(.selected) { box-shadow: 0 0 0 4px #fff, 0 0 22px rgba(255,255,255,.7); }
  `,
})
export class NobleComponent {
  readonly noble = input.required<INoble>();
  readonly selected = input(false);

  protected readonly cost = computed(() => sortByColor(this.noble().cost));
  private readonly art = inject(ART);
  protected readonly image = computed(() => {
    const url = this.art.noble(this.noble());
    return url ? `url("${url}")` : null;
  });
  protected readonly label = computed(() => {
    const req = this.cost().map(c => `${c.count} ${GEM_NAMES[c.id]}`).join(', ');
    return `Noble worth ${this.noble().prestige} prestige, requires ${req} bonuses`;
  });
}
