import fs from 'fs';
import path from 'path';

import { PlayerStat } from '#/engine/entity/PlayerStat.js';

export const BOT_PROFILE_VERSION = 5;

export type LivingWorldActivity =
    | 'idle'
    | 'travelling'
    | 'banking'
    | 'woodcutting'
    | 'fishing'
    | 'mining'
    | 'essence_mining'
    | 'combat'
    | 'cooking'
    | 'thieving'
    | 'prayer'
    | 'agility'
    | 'crafting'
    | 'herblore'
    | 'runecraft'
    | 'smithing'
    | 'firemaking'
    | 'fletching'
    | 'vial_filling'
    | 'trading'
    | 'questing';

export type BotItemStore = Record<string, number>;

export type BotProfile = {
    version: number;
    id: string;
    username: string;
    role: string;
    gender: number;
    body: number[];
    colors: number[];
    worn: string[];
    x: number;
    z: number;
    level: number;
    stats: number[];
    levels: number[];
    inventory: BotItemStore;
    bank: BotItemStore;
    activity: LivingWorldActivity;
    goal: string;
    ticksActive: number;
    lastSeenTick: number;
};

const PROFILE_FILE = 'profiles.json';
const STAT_COUNT = 21;

const CURATED_NAMES = [
    'ashwalker',
    'bronzemac',
    'cowhunter',
    'logrunner',
    'minetom',
    'fishmira',
    'bankbeth',
    'varrockian',
    'lumbylad',
    'rivernia',
    'tinminer',
    'oakmae',
    'goblinjoe',
    'roadkim',
    'willowdan',
    'coppermeg',
    'anvilal',
    'guardbait',
    'essrunner',
    'vialvic',
    'fireliz',
    'fletchfin',
    'eastbanker',
    'westbankben',
    'mithmara',
    'steelshay',
    'runerob',
    'mageivy',
    'bowkari',
    'chopnora',
    'smelteli',
    'waterwren',
    'palacepam',
    'coalcole',
    'bankstand',
    'ratmatt',
    'essenceed',
    'shortbowjo',
    'guardgail',
    'tinytim',
    'loglena',
    'ironike',
    'bronzebea',
    'runevera',
    'oakotto',
    'firedan',
    'vialval',
    'smithsam',
    'willowwes',
    'marketmia'
];

const NAME_PREFIXES = ['ash', 'amber', 'blue', 'brave', 'calm', 'dusk', 'ember', 'frost', 'gold', 'green', 'iron', 'jade', 'keen', 'mist', 'oak', 'red', 'rune', 'swift', 'wild', 'young'];
const NAME_SUFFIXES = ['bear', 'birch', 'crow', 'finch', 'fox', 'hawk', 'ivy', 'lynx', 'miner', 'reed', 'smith', 'wolf', 'wren', 'yew', 'zinc'];

function createDefaultNames(): string[] {
    const names = new Set(CURATED_NAMES);
    for (const prefix of NAME_PREFIXES) {
        for (const suffix of NAME_SUFFIXES) {
            const base = `${prefix}${suffix}`;
            names.add(base);
            for (let variant = 2; variant <= 4; variant++) {
                names.add(`${base}${variant}`);
            }
        }
    }
    return [...names];
}

const DEFAULT_NAMES = createDefaultNames();

const ROLES = ['skiller', 'newbie', 'melee_low', 'ranger', 'smith', 'mage', 'guard_hunter', 'melee_mid', 'woodcutter', 'veteran'];

const MALE_BODY = [0, 10, 18, 26, 33, 36, 42];
const FEMALE_BODY = [45, -1, 56, 61, 67, 70, 79];

const GEAR: Record<string, string[][]> = {
    skiller: [['bronze_axe'], ['iron_axe'], ['bronze_pickaxe'], ['steel_pickaxe'], ['knife'], ['plainstaff']],
    newbie: [[], ['bronze_sword'], ['bronze_sword', 'bronze_sq_shield'], ['bronze_sword', 'bronze_chainbody']],
    melee_low: [
        ['iron_sword', 'iron_chainbody', 'iron_sq_shield'],
        ['steel_sword', 'steel_chainbody', 'steel_sq_shield'],
        ['iron_sword', 'iron_full_helm', 'iron_platelegs'],
        ['steel_sword', 'steel_full_helm', 'steel_platelegs']
    ],
    ranger: [
        ['shortbow', 'leather_cowl', 'leather_chaps'],
        ['oak_shortbow', 'coif', 'leather_chaps', 'hardleather_body'],
        ['willow_shortbow', 'coif', 'studded_body', 'studded_chaps'],
        ['maple_shortbow', 'coif', 'studded_body', 'studded_chaps']
    ],
    smith: [['hammer'], ['steel_sword', 'steel_full_helm'], ['mithril_sword', 'mithril_chainbody'], ['steel_warhammer', 'steel_platelegs']],
    mage: [['plainstaff'], ['staff_of_air'], ['staff_of_water'], ['staff_of_fire'], ['magic_staff']],
    guard_hunter: [
        ['steel_sword', 'steel_platebody', 'steel_full_helm', 'steel_kiteshield'],
        ['mithril_sword', 'mithril_chainbody', 'mithril_full_helm', 'mithril_sq_shield'],
        ['adamant_sword', 'adamant_chainbody', 'adamant_full_helm', 'adamant_sq_shield'],
        ['rune_sword', 'rune_chainbody', 'rune_full_helm', 'rune_sq_shield']
    ],
    melee_mid: [
        ['mithril_sword', 'mithril_platebody', 'mithril_platelegs'],
        ['adamant_sword', 'adamant_chainbody', 'adamant_platelegs'],
        ['rune_sword', 'rune_chainbody', 'rune_platelegs'],
        ['mithril_sword', 'mithril_full_helm', 'mithril_kiteshield']
    ],
    woodcutter: [['steel_axe'], ['mithril_axe'], ['adamant_axe'], ['rune_axe']],
    veteran: [
        ['rune_sword', 'rune_chainbody', 'rune_platelegs', 'rune_kiteshield'],
        ['rune_sword', 'rune_platebody', 'rune_full_helm', 'rune_platelegs'],
        ['adamant_sword', 'adamant_platebody', 'adamant_full_helm', 'adamant_kiteshield'],
        ['magic_staff', 'rune_full_helm', 'rune_chainbody']
    ]
};

function getExpByLevel(level: number): number {
    if (level <= 1) {
        return 0;
    }

    let acc = 0;
    for (let i = 0; i < level - 1; i++) {
        const nextLevel = i + 1;
        acc += Math.floor(nextLevel + Math.pow(2.0, nextLevel / 7.0) * 300.0);
    }
    return Math.floor(acc / 4) * 10;
}

function hashString(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createRng(seed: number): () => number {
    let state = seed || 0x9e3779b9;
    return () => {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let result = Math.imul(state ^ (state >>> 15), 1 | state);
        result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

function randomLevel(rng: () => number, min: number, max: number): number {
    return min + Math.trunc(rng() * (max - min + 1));
}

function randomOf<T>(rng: () => number, items: T[]): T {
    return items[Math.trunc(rng() * items.length)];
}

function setStat(stats: number[], levels: number[], stat: PlayerStat, level: number): void {
    const next = Math.max(1, Math.min(99, Math.trunc(level)));
    levels[stat] = next;
    stats[stat] = getExpByLevel(next);
}

function createStats(username: string, index: number, role: string): { stats: number[]; levels: number[] } {
    const rng = createRng(hashString(`${username}:${index}:stats`));
    const stats = new Array(STAT_COUNT).fill(0);
    const levels = new Array(STAT_COUNT).fill(1);

    setStat(stats, levels, PlayerStat.HITPOINTS, 10);
    setStat(stats, levels, PlayerStat.WOODCUTTING, randomLevel(rng, 1, 55));
    setStat(stats, levels, PlayerStat.FISHING, randomLevel(rng, 1, 35));
    setStat(stats, levels, PlayerStat.COOKING, randomLevel(rng, 1, 50));
    setStat(stats, levels, PlayerStat.MINING, randomLevel(rng, 1, 55));
    setStat(stats, levels, PlayerStat.SMITHING, randomLevel(rng, 1, 45));
    setStat(stats, levels, PlayerStat.FIREMAKING, randomLevel(rng, 1, 45));
    setStat(stats, levels, PlayerStat.FLETCHING, randomLevel(rng, 1, 45));
    setStat(stats, levels, PlayerStat.CRAFTING, randomLevel(rng, 1, 30));
    setStat(stats, levels, PlayerStat.HERBLORE, randomLevel(rng, 3, 35));
    setStat(stats, levels, PlayerStat.AGILITY, randomLevel(rng, 1, 35));
    setStat(stats, levels, PlayerStat.RUNECRAFT, randomLevel(rng, 1, 20));

    switch (role) {
        case 'newbie':
            setStat(stats, levels, PlayerStat.ATTACK, randomLevel(rng, 1, 8));
            setStat(stats, levels, PlayerStat.STRENGTH, randomLevel(rng, 1, 9));
            setStat(stats, levels, PlayerStat.DEFENCE, randomLevel(rng, 1, 5));
            setStat(stats, levels, PlayerStat.HITPOINTS, randomLevel(rng, 10, 14));
            break;
        case 'melee_low':
            setStat(stats, levels, PlayerStat.ATTACK, randomLevel(rng, 8, 22));
            setStat(stats, levels, PlayerStat.STRENGTH, randomLevel(rng, 10, 26));
            setStat(stats, levels, PlayerStat.DEFENCE, randomLevel(rng, 5, 20));
            setStat(stats, levels, PlayerStat.HITPOINTS, randomLevel(rng, 16, 28));
            break;
        case 'ranger':
            setStat(stats, levels, PlayerStat.RANGED, randomLevel(rng, 12, 55));
            setStat(stats, levels, PlayerStat.DEFENCE, randomLevel(rng, 1, 40));
            setStat(stats, levels, PlayerStat.HITPOINTS, randomLevel(rng, 18, 52));
            break;
        case 'smith':
            setStat(stats, levels, PlayerStat.ATTACK, randomLevel(rng, 10, 35));
            setStat(stats, levels, PlayerStat.STRENGTH, randomLevel(rng, 10, 38));
            setStat(stats, levels, PlayerStat.DEFENCE, randomLevel(rng, 8, 30));
            setStat(stats, levels, PlayerStat.HITPOINTS, randomLevel(rng, 18, 42));
            setStat(stats, levels, PlayerStat.SMITHING, randomLevel(rng, 25, 70));
            setStat(stats, levels, PlayerStat.MINING, randomLevel(rng, 25, 70));
            break;
        case 'mage':
            setStat(stats, levels, PlayerStat.MAGIC, randomLevel(rng, 13, 60));
            setStat(stats, levels, PlayerStat.DEFENCE, randomLevel(rng, 1, 35));
            setStat(stats, levels, PlayerStat.HITPOINTS, randomLevel(rng, 18, 50));
            break;
        case 'guard_hunter':
            setStat(stats, levels, PlayerStat.ATTACK, randomLevel(rng, 30, 60));
            setStat(stats, levels, PlayerStat.STRENGTH, randomLevel(rng, 35, 65));
            setStat(stats, levels, PlayerStat.DEFENCE, randomLevel(rng, 25, 55));
            setStat(stats, levels, PlayerStat.HITPOINTS, randomLevel(rng, 38, 68));
            setStat(stats, levels, PlayerStat.PRAYER, randomLevel(rng, 1, 34));
            break;
        case 'melee_mid':
            setStat(stats, levels, PlayerStat.ATTACK, randomLevel(rng, 25, 50));
            setStat(stats, levels, PlayerStat.STRENGTH, randomLevel(rng, 25, 55));
            setStat(stats, levels, PlayerStat.DEFENCE, randomLevel(rng, 20, 45));
            setStat(stats, levels, PlayerStat.HITPOINTS, randomLevel(rng, 32, 58));
            break;
        case 'woodcutter':
            setStat(stats, levels, PlayerStat.ATTACK, randomLevel(rng, 5, 42));
            setStat(stats, levels, PlayerStat.STRENGTH, randomLevel(rng, 5, 45));
            setStat(stats, levels, PlayerStat.DEFENCE, randomLevel(rng, 1, 35));
            setStat(stats, levels, PlayerStat.HITPOINTS, randomLevel(rng, 12, 48));
            setStat(stats, levels, PlayerStat.WOODCUTTING, randomLevel(rng, 45, 85));
            setStat(stats, levels, PlayerStat.FIREMAKING, randomLevel(rng, 30, 70));
            setStat(stats, levels, PlayerStat.FLETCHING, randomLevel(rng, 20, 65));
            break;
        case 'veteran':
            setStat(stats, levels, PlayerStat.ATTACK, randomLevel(rng, 55, 78));
            setStat(stats, levels, PlayerStat.STRENGTH, randomLevel(rng, 55, 82));
            setStat(stats, levels, PlayerStat.DEFENCE, randomLevel(rng, 45, 72));
            setStat(stats, levels, PlayerStat.HITPOINTS, randomLevel(rng, 58, 82));
            setStat(stats, levels, PlayerStat.RANGED, randomLevel(rng, 20, 70));
            setStat(stats, levels, PlayerStat.MAGIC, randomLevel(rng, 25, 70));
            setStat(stats, levels, PlayerStat.PRAYER, randomLevel(rng, 20, 55));
            break;
        case 'skiller':
        default:
            setStat(stats, levels, PlayerStat.HITPOINTS, 10);
            setStat(stats, levels, PlayerStat.WOODCUTTING, randomLevel(rng, 35, 80));
            setStat(stats, levels, PlayerStat.MINING, randomLevel(rng, 25, 75));
            setStat(stats, levels, PlayerStat.SMITHING, randomLevel(rng, 15, 55));
            setStat(stats, levels, PlayerStat.FIREMAKING, randomLevel(rng, 25, 75));
            setStat(stats, levels, PlayerStat.FLETCHING, randomLevel(rng, 25, 75));
            break;
    }

    return { stats, levels };
}

function createWorn(username: string, index: number, role: string): string[] {
    const rng = createRng(hashString(`${username}:${index}:gear`));
    return [...randomOf(rng, GEAR[role] ?? GEAR.newbie)];
}

function defaultProfile(username: string, index: number): BotProfile {
    const role = ROLES[index % ROLES.length];
    const { stats, levels } = createStats(username, index, role);
    const gender = index % 3 === 0 ? 1 : 0;

    return {
        version: BOT_PROFILE_VERSION,
        id: username,
        username,
        role,
        gender,
        body: gender === 1 ? [...FEMALE_BODY] : [...MALE_BODY],
        colors: [index % 12, (index * 3) % 16, (index * 5) % 16, (index * 2) % 6, (index * 7) % 8],
        worn: createWorn(username, index, role),
        x: 3222,
        z: 3222,
        level: 0,
        stats,
        levels,
        inventory: {},
        bank: createStartingBank(index, role),
        activity: 'idle',
        goal: 'Looking for something to do',
        ticksActive: 0,
        lastSeenTick: 0
    };
}

function createStartingBank(index: number, role: string): BotItemStore {
    const base = 12 + (index % 31);
    const commonSupplies: BotItemStore = {
        coins: 2500 + index * 17,
        bronze_axe: 1,
        bronze_pickaxe: 1,
        net: 1,
        fishing_rod: 1,
        fly_fishing_rod: 1,
        lobster_pot: 1,
        harpoon: 1,
        fishing_bait: 250,
        feather: 250,
        tinderbox: 1,
        knife: 1,
        hammer: 1,
        logs: 80,
        raw_shrimp: 40,
        bones: 40,
        bronze_bar: 48,
        needle: 1,
        thread: 80,
        leather: 48,
        vial_water: 48,
        guam_leaf: 48,
        eye_of_newt: 48,
        blankrune: 64
    };
    const stockByRole: Record<string, BotItemStore> = {
        skiller: { logs: base * 2, copper_ore: base },
        newbie: { bones: base, raw_shrimp: Math.ceil(base / 2) },
        melee_low: { bones: base * 2 },
        ranger: { logs: base, unstrung_shortbow: Math.ceil(base / 3) },
        smith: { copper_ore: base * 2, steel_knife: base },
        mage: { blankrune: base * 2 },
        guard_hunter: { bones: base * 2, steel_knife: Math.ceil(base / 2) },
        melee_mid: { bones: base * 2 },
        woodcutter: { logs: base * 3 },
        veteran: { copper_ore: base, blankrune: base, vial_water: Math.ceil(base / 2) }
    };

    return mergeMigrationSupplies(stockByRole[role] ?? stockByRole.newbie, commonSupplies);
}

function mergeMigrationSupplies(bank: BotItemStore, fallback: BotItemStore): BotItemStore {
    const migrated = { ...bank };
    for (const [item, count] of Object.entries(fallback)) {
        migrated[item] = Math.max(migrated[item] ?? 0, count);
    }
    return migrated;
}

function normalizeItemStore(value: unknown): BotItemStore {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const store: BotItemStore = {};
    for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
        if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
            store[key] = Math.trunc(count);
        }
    }
    return store;
}

function normalizeWorn(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(item => typeof item === 'string' && item.length > 0);
}

function normalizeProfile(profile: Partial<BotProfile>, fallback: BotProfile): BotProfile {
    const needsInventoryMigration = profile.version !== BOT_PROFILE_VERSION;
    const stats = Array.isArray(profile.stats) ? profile.stats.slice(0, STAT_COUNT) : [...fallback.stats];
    const levels = Array.isArray(profile.levels) ? profile.levels.slice(0, STAT_COUNT) : [...fallback.levels];
    const storedBank = normalizeItemStore(profile.bank);

    while (stats.length < STAT_COUNT) {
        stats.push(0);
    }
    while (levels.length < STAT_COUNT) {
        levels.push(1);
    }
    if (needsInventoryMigration) {
        for (const stat of [PlayerStat.COOKING, PlayerStat.HERBLORE, PlayerStat.AGILITY]) {
            if (levels[stat] <= 1) {
                levels[stat] = fallback.levels[stat];
                stats[stat] = fallback.stats[stat];
            }
        }
    }

    return {
        ...fallback,
        ...profile,
        version: BOT_PROFILE_VERSION,
        id: fallback.id,
        username: fallback.username,
        role: typeof profile.role === 'string' ? profile.role : fallback.role,
        gender: profile.gender === 1 ? 1 : 0,
        body: Array.isArray(profile.body) && profile.body.length === 7 ? profile.body : fallback.body,
        colors: Array.isArray(profile.colors) && profile.colors.length === 5 ? profile.colors : fallback.colors,
        worn: normalizeWorn(profile.worn).length > 0 ? normalizeWorn(profile.worn) : fallback.worn,
        x: typeof profile.x === 'number' ? profile.x : fallback.x,
        z: typeof profile.z === 'number' ? profile.z : fallback.z,
        level: typeof profile.level === 'number' ? profile.level : fallback.level,
        stats,
        levels,
        inventory: normalizeItemStore(profile.inventory),
        bank: needsInventoryMigration ? mergeMigrationSupplies(storedBank, fallback.bank) : storedBank,
        activity: profile.activity ?? fallback.activity,
        goal: profile.goal ?? fallback.goal,
        ticksActive: profile.ticksActive ?? fallback.ticksActive,
        lastSeenTick: profile.lastSeenTick ?? fallback.lastSeenTick
    };
}

export default class BotProfileStore {
    private readonly dir: string;
    private readonly file: string;
    private profiles: BotProfile[] | null = null;

    constructor(dir: string) {
        this.dir = path.resolve(dir);
        this.file = path.join(this.dir, PROFILE_FILE);
    }

    all(): BotProfile[] {
        if (!this.profiles) {
            this.profiles = this.load();
        }

        return this.profiles;
    }

    save(profile: BotProfile): void {
        const profiles = this.all();
        const index = profiles.findIndex(candidate => candidate.id === profile.id);
        if (index === -1) {
            profiles.push(profile);
        } else {
            profiles[index] = profile;
        }
    }

    saveAll(): void {
        fs.mkdirSync(this.dir, { recursive: true });
        fs.writeFileSync(this.file, JSON.stringify(this.all(), null, 2), 'utf8');
    }

    checkout(excluded: Set<string>): BotProfile | null {
        const candidates = this.all().filter(profile => !excluded.has(profile.id));
        if (candidates.length === 0) {
            return null;
        }

        candidates.sort((a, b) => a.lastSeenTick - b.lastSeenTick);
        const pool = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
        return pool[Math.trunc(Math.random() * pool.length)];
    }

    private load(): BotProfile[] {
        const defaults = DEFAULT_NAMES.map(defaultProfile);
        if (!fs.existsSync(this.file)) {
            return defaults;
        }

        try {
            const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
            if (!Array.isArray(raw)) {
                return defaults;
            }

            const byId = new Map<string, Partial<BotProfile>>();
            for (const profile of raw) {
                if (profile && typeof profile.id === 'string') {
                    byId.set(profile.id, profile);
                }
            }

            return defaults.map(profile => normalizeProfile(byId.get(profile.id) ?? {}, profile));
        } catch {
            return defaults;
        }
    }
}
