import { InjectionToken } from '@angular/core';
import { CardTier, ICard, INoble } from './protocol';

/** Supplies illustration URLs for cards, card backs and nobles. */
export interface ArtProvider {
  card(card: ICard): string | null;
  cardBack(tier: CardTier): string | null;
  noble(noble: INoble): string | null;
}

/** No illustrations: the parchment cards and drawn emblem. Used if an app doesn't provide BUNDLED_ART. */
export const ART = new InjectionToken<ArtProvider>('ART', {
  factory: () => ({ card: () => null, cardBack: () => null, noble: n => n.imgUrl || null }),
});

// Each card tier draws from its own pool of scenes, so the art climbs from
// back-alley taverns to treasure hoards as the cards get more valuable.
const CARD_ART: Record<CardTier, readonly string[]> = {
  1: ['t1-smugglers-cave', 't1-tavern', 't1-harbor-town', 't1-dockside', 't1-beached-wreck'],
  2: ['t2-galleon-at-dock', 't2-pirate-wharf', 't2-captains-cabin', 't2-stilt-house'],
  3: ['t3-storm-galleon', 't3-moonlit-raider', 't3-island-stronghold', 't3-treasure-chest'],
};

const NOBLE_ART: readonly string[] = [
  'captain-lantern', 'captain-brass', 'captain-helm', 'captain-sabre', 'captain-dagger',
  'captain-cutlass', 'captain-sea-wind', 'captain-lamplight', 'captain-spyglass', 'captain-rum',
];

/** Picks a stable entry for an id, so a card always shows the same picture. */
function pick(pool: readonly string[], id: number): string {
  return pool[((id % pool.length) + pool.length) % pool.length];
}

/**
 * The bundled illustrations. Both apps ship the same file names in their own `public/art`
 * folder: full size for the host's big screen, half size for phones. The paths are relative,
 * so they work under a GitHub Pages sub-path (built with --base-href ./).
 * A card shows the same picture on the host and on every phone.
 */
export const BUNDLED_ART: ArtProvider = {
  card: card => `art/cards/${pick(CARD_ART[card.tier], card.id)}.jpg`,
  cardBack: tier => `art/card-backs/tier-${tier}.jpg`,
  // Art from the server's noble data wins, otherwise use the bundled portraits
  noble: noble => noble.imgUrl || `art/nobles/${pick(NOBLE_ART, noble.id - 1)}.jpg`,
};
