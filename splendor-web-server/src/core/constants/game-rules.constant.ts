export const GameRules = {
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 4,
    /** Most tokens a player may hold when their turn ends. */
    MAX_TOKENS: 10,
    MAX_RESERVED: 3,
    /** Reaching this triggers the final round. */
    WINNING_PRESTIGE: 15,
    GOLD_TOKENS: 5,
    MARKET_SLOTS: 4,
    /** You may only take 2 of one color if the bank has at least this many before you take them. */
    MIN_BANK_FOR_DOUBLE: 4,
    MAX_DISTINCT_TAKE: 3,
    /** Non-gold gems of each color in the bank, by player count. */
    GEMS_PER_COLOR_BY_PLAYERS: { 2: 4, 3: 5, 4: 7 } as Readonly<Record<number, number>>,
    MAX_NAME_LENGTH: 16,
} as const;
