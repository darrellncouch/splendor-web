/** Something the current player has to resolve before their turn can end. */
export type IPendingDecision =
    | { type: 'discard'; playerId: string; /** How many tokens they must return. */ count: number }
    | { type: 'chooseNoble'; playerId: string; nobleIds: Array<number> };
