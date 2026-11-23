import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { BASIC_GEM_COLORS } from "../constants/gem-colors.constant";
import { ICard } from "../interfaces/card.interface";
import { IGameData } from "../interfaces/game-data.interface";
import { INoble } from "../interfaces/noble.interface";
import { IResource } from "../interfaces/resource.interface";
import { BasicGemColor } from "../types/gem-color.type";

/**
 * Loads cards and nobles from the data folder. Default is <server root>/data; set DATA_DIR to change it.
 *
 * For each of `cards` and `nobles`, the first of these files that exists is used:
 *   cards.json, cards.csv, cards.example.json
 *
 * JSON: same shape as ICard / INoble.
 * CSV (header row required, costs as one column per color):
 *   cards.csv:  id,tier,prestige,bonus,white,blue,green,red,black
 *   nobles.csv: id,prestige,white,blue,green,red,black,imgUrl
 */
export function loadGameData(dataDir = process.env.DATA_DIR ?? resolve(__dirname, '../../../data')): IGameData {
    const cards = loadFile(dataDir, 'cards', parseCardsCsv).map((c, i) => validateCard(c, i));
    const nobles = loadFile(dataDir, 'nobles', parseNoblesCsv).map((n, i) => validateNoble(n, i));

    assertUniqueIds(cards, 'card');
    assertUniqueIds(nobles, 'noble');
    for (const tier of [1, 2, 3]) {
        if (!cards.some(c => c.tier === tier))
            throw new Error(`Game data has no tier ${tier} cards`);
    }
    if (nobles.length < 5)
        console.warn(`[data] Only ${nobles.length} nobles loaded. A 4-player game uses 5.`);

    return { cards, nobles };
}

function loadFile(dir: string, name: string, parseCsv: (text: string) => Array<unknown>): Array<unknown> {
    const candidates = [`${name}.json`, `${name}.csv`, `${name}.example.json`];
    for (const file of candidates) {
        const path = join(dir, file);
        if (!existsSync(path)) continue;

        const text = readFileSync(path, 'utf8');
        const parsed = file.endsWith('.csv') ? parseCsv(text) : JSON.parse(text);
        if (!Array.isArray(parsed))
            throw new Error(`${path} must contain an array`);
        if (file.includes('.example.'))
            console.warn(`[data] Using placeholder ${file}. Add ${name}.json or ${name}.csv to use the real data.`);
        console.log(`[data] Loaded ${parsed.length} ${name} from ${file}`);
        return parsed;
    }
    throw new Error(`No ${name} data found in ${dir} (looked for ${candidates.join(', ')})`);
}

// ---- CSV ----

function parseCsv(text: string): Array<Record<string, string>> {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
}

function costFromRow(row: Record<string, string>): Array<IResource> {
    return BASIC_GEM_COLORS
        .map(id => ({ id, count: Number(row[id] || 0) }))
        .filter(r => r.count !== 0);
}

function parseCardsCsv(text: string): Array<unknown> {
    return parseCsv(text).map(row => ({
        id: Number(row.id),
        tier: Number(row.tier),
        prestige: Number(row.prestige || 0),
        bonus: row.bonus,
        cost: costFromRow(row),
    }));
}

function parseNoblesCsv(text: string): Array<unknown> {
    return parseCsv(text).map(row => ({
        id: Number(row.id),
        prestige: Number(row.prestige || 3),
        cost: costFromRow(row),
        imgUrl: row.imgUrl ?? '',
    }));
}

// ---- validation ----

function isNonNegInt(v: unknown): v is number {
    return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function validateCost(cost: unknown, where: string): Array<IResource> {
    if (!Array.isArray(cost))
        throw new Error(`${where}: cost must be an array`);
    return cost.map(entry => {
        const { id, count } = (entry ?? {}) as Record<string, unknown>;
        if (!BASIC_GEM_COLORS.includes(id as BasicGemColor))
            throw new Error(`${where}: invalid cost color "${String(id)}" (gold is not allowed in costs)`);
        if (!isNonNegInt(count))
            throw new Error(`${where}: invalid cost count for ${String(id)}`);
        return { id: id as BasicGemColor, count };
    }).filter(r => r.count > 0);
}

function validateCard(raw: unknown, index: number): ICard {
    const c = (raw ?? {}) as Record<string, unknown>;
    const where = `card #${index} (id ${String(c.id)})`;
    if (!isNonNegInt(c.id)) throw new Error(`${where}: id must be a whole number`);
    if (c.tier !== 1 && c.tier !== 2 && c.tier !== 3) throw new Error(`${where}: tier must be 1, 2 or 3`);
    if (!isNonNegInt(c.prestige)) throw new Error(`${where}: prestige must be a whole number`);
    if (!BASIC_GEM_COLORS.includes(c.bonus as BasicGemColor)) throw new Error(`${where}: invalid bonus color "${String(c.bonus)}"`);
    return { id: c.id, tier: c.tier, prestige: c.prestige, bonus: c.bonus as BasicGemColor, cost: validateCost(c.cost, where) };
}

function validateNoble(raw: unknown, index: number): INoble {
    const n = (raw ?? {}) as Record<string, unknown>;
    const where = `noble #${index} (id ${String(n.id)})`;
    if (!isNonNegInt(n.id)) throw new Error(`${where}: id must be a whole number`);
    if (!isNonNegInt(n.prestige)) throw new Error(`${where}: prestige must be a whole number`);
    return { id: n.id, prestige: n.prestige, cost: validateCost(n.cost, where), imgUrl: typeof n.imgUrl === 'string' ? n.imgUrl : '' };
}

function assertUniqueIds(items: ReadonlyArray<{ id: number }>, label: string): void {
    const seen = new Set<number>();
    for (const item of items) {
        if (seen.has(item.id)) throw new Error(`Duplicate ${label} id ${item.id}`);
        seen.add(item.id);
    }
}
