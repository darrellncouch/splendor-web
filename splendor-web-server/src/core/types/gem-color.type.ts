export type GemColor = 'gold' | 'white' | 'black' | 'blue' | 'green' | 'red';

/** Every gem color except gold. Card costs, card bonuses and noble requirements only use these. */
export type BasicGemColor = Exclude<GemColor, 'gold'>;
