import { BasicGemColor, GemColor, IResource } from './protocol';

export const BASIC_GEM_COLORS: readonly BasicGemColor[] = ['white', 'blue', 'green', 'red', 'black'];
export const ALL_GEM_COLORS: readonly GemColor[] = [...BASIC_GEM_COLORS, 'gold'];

export const GEM_NAMES: Record<GemColor, string> = {
  white: 'Diamond',
  blue: 'Sapphire',
  green: 'Emerald',
  red: 'Ruby',
  black: 'Onyx',
  gold: 'Gold',
};

export function countOf(resources: readonly IResource[] | undefined, color: GemColor): number {
  return resources?.find(r => r.id === color)?.count ?? 0;
}

export function sortByColor<T extends { id: GemColor }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => ALL_GEM_COLORS.indexOf(a.id) - ALL_GEM_COLORS.indexOf(b.id));
}
