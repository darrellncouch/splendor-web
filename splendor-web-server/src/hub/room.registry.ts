import { randomInt, randomUUID } from "crypto";
import { GameRuleError } from "../core/errors/game-rule.error";
import { IGameData } from "../core/interfaces/game-data.interface";
import { GameEngine } from "../gameEngine";

// No I or O, so codes can't be mixed up with 1 and 0 when read off a Discord screenshare.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;

export interface IRoom {
    code: string;
    /** Secret the host screen uses to reconnect after a refresh. */
    hostToken: string;
    engine: GameEngine;
    lastActivity: number;
}

/** Every live room, kept in memory. */
export class RoomRegistry {

    private readonly rooms = new Map<string, IRoom>();

    constructor(private readonly data: IGameData) { }

    public get count(): number {
        return this.rooms.size;
    }

    public create(): IRoom {
        const code = this.generateCode();
        const room: IRoom = {
            code,
            hostToken: randomUUID(),
            engine: new GameEngine(code, this.data),
            lastActivity: Date.now(),
        };
        this.rooms.set(code, room);
        return room;
    }

    public get(code: string): IRoom | undefined {
        return this.rooms.get(code.trim().toUpperCase());
    }

    public require(code: string): IRoom {
        const room = this.get(code);
        if (!room)
            throw new GameRuleError(`Room "${code.toUpperCase()}" was not found`);
        return room;
    }

    public delete(room: IRoom): void {
        this.rooms.delete(room.code);
    }

    public touch(room: IRoom): void {
        room.lastActivity = Date.now();
    }

    /** Deletes rooms that nobody is connected to and that have been idle longer than `idleMs`. */
    public cleanup(idleMs: number, hasConnections: (code: string) => boolean): Array<string> {
        const removed: Array<string> = [];
        const cutoff = Date.now() - idleMs;
        for (const room of this.rooms.values()) {
            if (room.lastActivity < cutoff && !hasConnections(room.code)) {
                this.rooms.delete(room.code);
                removed.push(room.code);
            }
        }
        return removed;
    }

    private generateCode(): string {
        for (let attempt = 0; attempt < 1000; attempt++) {
            const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
            if (!this.rooms.has(code)) return code;
        }
        throw new Error("Could not generate a unique room code");
    }
}
