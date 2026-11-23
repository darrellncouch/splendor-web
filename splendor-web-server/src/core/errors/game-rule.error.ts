/**
 * Thrown for anything a player did that is not allowed (bad move, wrong turn, bad input).
 * The hub sends the message straight back to the client, so keep it player-friendly.
 */
export class GameRuleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GameRuleError';
    }
}
