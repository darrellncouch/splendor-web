import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GEM_NAMES } from '../gems';
import { GemColor } from '../protocol';

/** A round gem token, with an optional count in the middle. */
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
      display: inline-grid;
      place-items: center;
      width: var(--d);
      height: var(--d);
      border-radius: 50%;
      flex: none;
      font-weight: 800;
      font-size: calc(var(--d) * 0.42);
      color: var(--gem-fg);
      background:
        radial-gradient(circle at 32% 28%, rgba(255,255,255,.65) 0 12%, transparent 34%),
        radial-gradient(circle at 50% 50%, var(--gem) 0 58%, var(--gem-dark) 100%);
      box-shadow: inset 0 0 0 calc(var(--d) * 0.07) var(--gem-dark), 0 2px 4px rgba(0,0,0,.45);
      text-shadow: 0 1px 2px var(--gem-shadow);
    }
    :host(.size-xs) { --d: 1.25rem; }
    :host(.size-sm) { --d: 1.75rem; }
    :host(.size-lg) { --d: 3.4rem; }
    :host(.size-xl) { --d: 4.6rem; }
    :host(.empty) { opacity: .35; }
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
