import { BasicGemColor, GemColor } from "../types/gem-color.type";

export const BASIC_GEM_COLORS: ReadonlyArray<BasicGemColor> = ['white', 'blue', 'green', 'red', 'black'];
export const ALL_GEM_COLORS: ReadonlyArray<GemColor> = [...BASIC_GEM_COLORS, 'gold'];
