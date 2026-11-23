import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GEM_NAMES, sortByColor } from '../gems';
import { INoble } from '../protocol';

/** A noble tile: prestige plus the card bonuses it requires. Its size comes from the `--noble-w` CSS variable. */
@Component({
  selector: 'sp-noble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.selected]': 'selected()',
    '[style.--noble-img]': 'image()',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <div class="req">
      @for (c of cost(); track c.id) {
        <span class="bar gem-{{ c.id }}">{{ c.count }}</span>
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
      aspect-ratio: 1;
      padding: calc(var(--w) * .07);
      border-radius: calc(var(--w) * .08);
      background:
        var(--noble-img, none) center / cover,
        radial-gradient(circle at 70% 60%, #d9c7a3, #a88b5a);
      box-shadow: 0 3px 8px rgba(0,0,0,.45), inset 0 0 0 calc(var(--w) * .035) rgba(255,255,255,.35);
    }
    .req {
      display: flex;
      flex-direction: column;
      gap: calc(var(--w) * .04);
      padding: calc(var(--w) * .04);
      border-radius: calc(var(--w) * .05);
      background: rgba(255,255,255,.4);
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
      background: var(--gem);
      box-shadow: inset 0 0 0 2px var(--gem-dark);
    }
    .prestige {
      font-size: calc(var(--w) * .34);
      font-weight: 900;
      line-height: 1;
      color: #fff;
      text-shadow: 0 0 3px #000, 0 2px 3px #000;
    }
    :host(.selected) { box-shadow: 0 0 0 4px #fff, 0 0 22px rgba(255,255,255,.7); }
  `,
})
export class NobleComponent {
  readonly noble = input.required<INoble>();
  readonly selected = input(false);

  protected readonly cost = computed(() => sortByColor(this.noble().cost));
  protected readonly image = computed(() => (this.noble().imgUrl ? `url("${this.noble().imgUrl}")` : null));
  protected readonly label = computed(() => {
    const req = this.cost().map(c => `${c.count} ${GEM_NAMES[c.id]}`).join(', ');
    return `Noble worth ${this.noble().prestige} prestige, requires ${req} bonuses`;
  });
}
