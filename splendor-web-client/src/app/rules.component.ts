import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { GemComponent } from '@shared/components/gem.component';

/**
 * "How to play": a button (info icon or text link) that opens the rules in a modal sheet.
 * Uses a native <dialog>, so Esc, focus trapping and the backdrop come for free.
 */
@Component({
  selector: 'sp-rules',
  imports: [GemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'icon') {
      <button type="button" class="info" (click)="open()" aria-label="How to play" title="How to play">i</button>
    } @else {
      <button type="button" class="link" (click)="open()">How to play</button>
    }

    <dialog #dialog class="rules" aria-labelledby="rules-title" (click)="onBackdrop($event)">
      <header>
        <h2 id="rules-title">How to play Booty</h2>
        <button type="button" class="close" (click)="close()" aria-label="Close">✕</button>
      </header>

      <div class="body">
        <section>
          <h3>The goal</h3>
          <p>
            Be the most <b>infamous</b> pirate: first to <b>15 prestige</b> starts the final round.
            Everyone finishes that round so all players get the same number of turns, then the most prestige wins.
            Tied? The captain with the <b>fewest cards</b> wins.
          </p>
        </section>

        <section>
          <h3>On your turn, do one thing</h3>
          <ol class="moves">
            <li>
              <b>Take 3 different gems.</b>
              One each of three colors.
            </li>
            <li>
              <b>Take 2 of the same gem.</b>
              Only if that pile has at least 4 left before you take them.
            </li>
            <li>
              <b>Reserve a card.</b>
              Hide a face-up card (or the top of a draw pile) in your hand and take
              <span class="inline-gem"><sp-gem color="gold" size="xs" /></span> 1 gold doubloon if any are left.
              You can hold 3 reserved cards.
            </li>
            <li>
              <b>Buy a card.</b>
              From the table or your reserved hand. Pay its cost in gems; spent gems go back to the bank.
            </li>
          </ol>
        </section>

        <section>
          <h3>Cards are your fleet</h3>
          <ul>
            <li>Each card you own gives a <b>permanent discount</b> of 1 gem of its color on every future purchase.</li>
            <li>Some cards also carry <b>prestige</b> (the number in the corner).</li>
            <li>Cheap tier 1 cards build your discounts; pricey tier 3 cards win games.</li>
          </ul>
        </section>

        <section>
          <h3>Gold doubloons</h3>
          <p>Gold is wild: it can stand in for any gem when you buy. The only way to get it is by reserving.</p>
        </section>

        <section class="kings">
          <h3>Pirate Kings (nobles)</h3>
          <ul>
            <li>Attract pirate kings with your fleet: a set number of <b>cards</b> of certain colors. Gems in your pocket don't count.</li>
            <li>At the end of your turn, if your bonuses meet a King's demand, they <b>join you automatically</b> for <b>3 prestige</b>. It doesn't use up your move.</li>
            <li>Only one King per turn. If several qualify, you pick one.</li>
            <li>Once a King joins a captain, they're gone for everyone else. Race for them!</li>
          </ul>
        </section>

        <section>
          <h3>Pocket limit</h3>
          <p>
            You can hold <b>10 tokens</b> (gold included). End your turn with more and you must return the extras.
            If you just took gems, you can tap <b>Undo take</b> instead and pick a different move.
          </p>
        </section>
      </div>

      <footer>
        <button type="button" class="btn" (click)="close()">Aye, got it!</button>
      </footer>
    </dialog>
  `,
  styles: `
    :host { display: contents; }

    .info {
      width: 1.9rem;
      height: 1.9rem;
      display: grid;
      place-items: center;
      padding: 0;
      border: 1px solid currentColor;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      font: italic 700 1rem/1 Georgia, serif;
      cursor: pointer;
    }

    .link {
      align-self: center;
      border: 0;
      padding: .2rem;
      background: none;
      color: var(--muted);
      text-decoration: underline;
      font-size: .95rem;
      cursor: pointer;
    }

    dialog.rules {
      width: min(34rem, 100%);
      max-width: 100%;
      max-height: 92dvh;
      margin: auto auto 0;
      padding: 0;
      border: 0;
      border-top: 1px solid var(--panel-border);
      border-radius: 1rem 1rem 0 0;
      background: #24170c;
      color: var(--text);
      box-shadow: 0 -10px 30px rgba(0, 0, 0, .5);
      flex-direction: column;
      text-align: left;
      font-weight: 400;
      font-size: 1rem;
    }
    dialog.rules[open] { display: flex; }
    dialog.rules::backdrop { background: rgba(0, 0, 0, .6); }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.1rem 1rem .6rem;
    }
    h2 { margin: 0; font-family: var(--font-display); font-size: 2rem; line-height: 1; color: var(--accent); }
    .close {
      flex: none;
      width: 2.2rem;
      height: 2.2rem;
      border: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, .08);
      color: var(--text);
      font-size: 1rem;
      cursor: pointer;
    }

    .body { overflow-y: auto; padding: 0 1rem; }
    section { padding: .7rem 0; border-top: 1px solid rgba(214, 168, 88, .18); }
    section:first-child { border-top: 0; padding-top: 0; }
    h3 { margin: 0 0 .35rem; font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); }
    p, ul, ol { margin: 0; line-height: 1.45; }
    ul, ol { padding-left: 1.2rem; display: flex; flex-direction: column; gap: .35rem; }
    b { color: #fff3d6; }
    .moves li::marker { color: var(--accent); font-weight: 800; }
    .moves b { display: block; }
    .inline-gem { display: inline-block; vertical-align: middle; }
    .kings { margin: .3rem -.5rem; padding: .7rem .5rem; border-radius: .6rem; background: rgba(233, 185, 73, .08); border-top: 0; }

    footer { padding: .8rem 1rem calc(1rem + env(safe-area-inset-bottom)); }
    footer .btn { width: 100%; padding: .9em; }
  `,
})
export class RulesComponent {
  readonly variant = input<'icon' | 'link'>('icon');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected open(): void {
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /** Clicking the dimmed area outside the sheet closes it. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}
