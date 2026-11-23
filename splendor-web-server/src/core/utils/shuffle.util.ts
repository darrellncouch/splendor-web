export type RandomFn = () => number;

/** Fisher-Yates shuffle. Returns a new array and leaves the input alone. */
export function shuffle<T>(items: ReadonlyArray<T>, random: RandomFn = Math.random): Array<T> {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
