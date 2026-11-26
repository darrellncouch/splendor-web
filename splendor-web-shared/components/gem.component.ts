import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GEM_NAMES } from '../gems';
import { GemColor } from '../protocol';

/**
 * A gem token drawn from the art in assets/gems (see --gem-art in theme.scss),
 * with an optional count badge in the corner.
 */
@Component({
  selector: 'sp-gem',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"gem gem-" + color() + " size-" + size()',
    '[class.empty]': 'count() === 0',
    '[attr.title]': 'name()',
    '[attr.aria-label]': 'label()',
  },
  template: `@if (count() !== null) { <span class="count">{{ count() }}</span> }`,
  styles: `
    :host {
      --d: 2.4rem;
      position: relative;
      display: inline-block;
      width: var(--d);
      height: var(--d);
      flex: none;
      background: var(--gem-art) center / contain no-repeat;
      filter: drop-shadow(0 calc(var(--d) * 0.05) calc(var(--d) * 0.06) rgba(0,0,0,.5));
    }
    .count {
      position: absolute;
      right: -12%;
      bottom: -10%;
      min-width: calc(var(--d) * 0.5);
      height: calc(var(--d) * 0.5);
      padding: 0 calc(var(--d) * 0.08);
      box-sizing: border-box;
      display: grid;
      place-items: center;
      border-radius: 999px;
      font-weight: 800;
      font-size: calc(var(--d) * 0.34);
      line-height: 1;
      color: var(--gem-fg);
      background: var(--gem);
      box-shadow: inset 0 0 0 calc(var(--d) * 0.035) var(--gem-dark), 0 1px 2px rgba(0,0,0,.5);
    }
    :host(.size-xs) { --d: 1.25rem; }
    :host(.size-sm) { --d: 1.75rem; }
    :host(.size-lg) { --d: 3.4rem; }
    :host(.size-xl) { --d: 4.6rem; }
    :host(.empty) { opacity: .35; filter: grayscale(.7); }
  `,
})
export class GemComponent {
  readonly color = input.required<GemColor>();
  readonly count = input<number | null>(null);
  readonly size = input<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');

  protected readonly name = computed(() => GEM_NAMES[this.color()]);
  protected readonly label = computed(() =>
    this.count() === null ? this.name() : `${this.count()} ${this.name()}`,
  );
}
