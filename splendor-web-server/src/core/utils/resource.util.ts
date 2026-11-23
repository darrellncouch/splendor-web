import { ALL_GEM_COLORS } from "../constants/gem-colors.constant";
import { GameRuleError } from "../errors/game-rule.error";
import { IResource } from "../interfaces/resource.interface";
import { GemColor } from "../types/gem-color.type";

export type GemRecord = Record<GemColor, number>;

export function emptyGemRecord(): GemRecord {
    return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
}

export function isGemColor(value: unknown): value is GemColor {
    return typeof value === 'string' && (ALL_GEM_COLORS as ReadonlyArray<string>).includes(value);
}

export function toGemRecord(resources: ReadonlyArray<IResource>): GemRecord {
    const record = emptyGemRecord();
    resources.forEach(r => record[r.id] += r.count);
    return record;
}

export function toResourceArray(record: Readonly<GemRecord>, includeZero = true): Array<IResource> {
    return ALL_GEM_COLORS
        .map(id => ({ id, count: record[id] }))
        .filter(r => includeZero || r.count > 0);
}

export function totalCount(resources: ReadonlyArray<IResource>): number {
    return resources.reduce((sum, r) => sum + r.count, 0);
}

/** "1 white, 2 red" for log messages. */
export function describeResources(resources: ReadonlyArray<IResource>): string {
    const parts = resources.filter(r => r.count > 0).map(r => `${r.count} ${r.id}`);
    return parts.length ? parts.join(', ') : 'nothing';
}

/**
 * Validates untrusted input from a client into a clean resource list.
 * Rejects unknown colors, non-integer or negative counts and duplicate colors. Zero counts are dropped.
 */
export function parseResources(input: unknown, label = 'gems'): Array<IResource> {
    if (!Array.isArray(input))
        throw new GameRuleError(`${label} must be a list`);

    const seen = new Set<GemColor>();
    const result: Array<IResource> = [];

    for (const item of input) {
        if (typeof item !== 'object' || item === null)
            throw new GameRuleError(`Invalid entry in ${label}`);

        const { id, count } = item as Record<string, unknown>;
        if (!isGemColor(id))
            throw new GameRuleError(`Unknown gem color "${String(id)}"`);
        if (typeof count !== 'number' || !Number.isInteger(count) || count < 0)
            throw new GameRuleError(`Gem counts must be whole numbers of 0 or more`);
        if (seen.has(id))
            throw new GameRuleError(`Duplicate gem color "${id}" in ${label}`);

        seen.add(id);
        if (count > 0)
            result.push({ id, count });
    }
    return result;
}
