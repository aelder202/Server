import SeqType from '#/cache/config/SeqType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { isClientConnected } from '#/engine/entity/NetworkPlayer.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import SimulatedPlayer, { isSimulatedPlayer } from '#/engine/entity/SimulatedPlayer.js';
import { findPath, isIndoors, isMapBlocked } from '#/engine/GameMap.js';
import BotProfileStore, { BotItemStore, BotProfile, LivingWorldActivity } from '#/engine/living/BotProfileStore.js';
import Environment from '#/util/Environment.js';

type Coord = { level: number; x: number; z: number };

type ActivityDefinition = {
    id: LivingWorldActivity;
    label: string;
    spots: Coord[];
    stat?: PlayerStat;
    xp?: number;
    product?: string;
    consumes?: BotItemStore;
    maxInventory?: number;
    actionTicks: [number, number];
    actionLoops?: [number, number];
    anims: string[];
    chats: string[];
    weight?: number;
};

type AreaDefinition = {
    id: string;
    center: Coord;
    radius: number;
    bank: Coord;
    safePoints: Coord[];
    spawnPoints: Coord[];
    activities: ActivityDefinition[];
};

type BotRuntime = {
    activity: ActivityDefinition;
    destination: Coord;
    nextActionTick: number;
    actionsRemaining: number;
    stuckTicks: number;
    recoveryCount: number;
    pathFailures: number;
    lastDistance: number;
    lastProgressTick: number;
    lastX: number;
    lastZ: number;
};

type LivingWorldHost = {
    currentTick: number;
    playerLoop: { all(): IterableIterator<Player> };
    addSimulatedPlayer(player: SimulatedPlayer): boolean;
    removeSimulatedPlayer(player: SimulatedPlayer): void;
};

const LUMBRIDGE: AreaDefinition = {
    id: 'lumbridge',
    center: { level: 0, x: 3222, z: 3222 },
    radius: 140,
    bank: { level: 0, x: 3208, z: 3222 },
    safePoints: [
        { level: 0, x: 3222, z: 3218 },
        { level: 0, x: 3217, z: 3225 },
        { level: 0, x: 3232, z: 3227 },
        { level: 0, x: 3206, z: 3229 },
        { level: 0, x: 3241, z: 3221 }
    ],
    spawnPoints: [
        { level: 0, x: 3221, z: 3219 },
        { level: 0, x: 3232, z: 3227 },
        { level: 0, x: 3206, z: 3239 },
        { level: 0, x: 3254, z: 3262 },
        { level: 0, x: 3197, z: 3229 },
        { level: 0, x: 3239, z: 3224 },
        { level: 0, x: 3241, z: 3153 },
        { level: 0, x: 3260, z: 3230 },
        { level: 0, x: 3210, z: 3215 },
        { level: 0, x: 3204, z: 3244 },
        { level: 0, x: 3231, z: 3295 },
        { level: 0, x: 3192, z: 3205 }
    ],
    activities: [
        {
            id: 'woodcutting',
            label: 'Chopping trees',
            spots: [
                { level: 0, x: 3198, z: 3233 },
                { level: 0, x: 3204, z: 3244 },
                { level: 0, x: 3235, z: 3238 },
                { level: 0, x: 3251, z: 3243 }
            ],
            stat: PlayerStat.WOODCUTTING,
            xp: 250,
            product: 'logs',
            maxInventory: 18,
            actionTicks: [9, 16],
            actionLoops: [3, 8],
            anims: ['human_woodcutting_rune_axe', 'human_woodcutting_mithril_axe', 'human_woodcutting_steel_axe', 'human_woodcutting_bronze_axe', 'human_axe_chop'],
            chats: ['Need a few more logs.', 'This tree is taking ages.', 'Banking after this load.'],
            weight: 6
        },
        {
            id: 'fishing',
            label: 'Net fishing',
            spots: [
                { level: 0, x: 3239, z: 3224 },
                { level: 0, x: 3242, z: 3218 },
                { level: 0, x: 3240, z: 3153 }
            ],
            stat: PlayerStat.FISHING,
            xp: 100,
            product: 'raw_shrimps',
            maxInventory: 20,
            actionTicks: [10, 18],
            actionLoops: [3, 8],
            anims: ['human_smallnet'],
            chats: ['Any shrimp yet?', 'Fishing is slow today.', 'I should cook these soon.'],
            weight: 4
        },
        {
            id: 'combat',
            label: 'Training combat',
            spots: [
                { level: 0, x: 3255, z: 3266 },
                { level: 0, x: 3251, z: 3257 },
                { level: 0, x: 3231, z: 3295 },
                { level: 0, x: 3198, z: 3270 }
            ],
            stat: PlayerStat.ATTACK,
            xp: 160,
            product: 'bones',
            maxInventory: 16,
            actionTicks: [8, 14],
            actionLoops: [2, 7],
            anims: ['human_axe_hack', 'human_staff_pummel', 'human_unarmedpunch', 'human_axe_chop'],
            chats: ['One more cow.', 'Anyone seen a goblin?', 'Training to ten attack.'],
            weight: 4
        },
        {
            id: 'firemaking',
            label: 'Lighting fires',
            spots: [
                { level: 0, x: 3206, z: 3216 },
                { level: 0, x: 3218, z: 3218 },
                { level: 0, x: 3230, z: 3209 }
            ],
            stat: PlayerStat.FIREMAKING,
            xp: 160,
            consumes: { logs: 1 },
            actionTicks: [8, 14],
            actionLoops: [2, 5],
            anims: ['human_createfire'],
            chats: ['Firemaking line is crooked.', 'Need more logs.', 'That one caught fast.'],
            weight: 2
        },
        {
            id: 'travelling',
            label: 'Walking through town',
            spots: [
                { level: 0, x: 3222, z: 3218 },
                { level: 0, x: 3206, z: 3229 },
                { level: 0, x: 3237, z: 3205 },
                { level: 0, x: 3244, z: 3226 }
            ],
            actionTicks: [4, 9],
            actionLoops: [1, 2],
            anims: [],
            chats: ['Heading over there.', 'Forgot something at the bank.', 'Long walk.'],
            weight: 2
        }
    ]
};

const VARROCK: AreaDefinition = {
    id: 'varrock',
    center: { level: 0, x: 3213, z: 3423 },
    radius: 180,
    bank: { level: 0, x: 3181, z: 3436 },
    safePoints: [
        { level: 0, x: 3213, z: 3423 },
        { level: 0, x: 3181, z: 3436 },
        { level: 0, x: 3254, z: 3420 },
        { level: 0, x: 3208, z: 3429 },
        { level: 0, x: 3232, z: 3433 },
        { level: 0, x: 3197, z: 3404 },
        { level: 0, x: 3244, z: 3406 }
    ],
    spawnPoints: [
        { level: 0, x: 3213, z: 3423 },
        { level: 0, x: 3185, z: 3436 },
        { level: 0, x: 3253, z: 3420 },
        { level: 0, x: 3245, z: 3428 },
        { level: 0, x: 3285, z: 3368 },
        { level: 0, x: 3168, z: 3421 },
        { level: 0, x: 3188, z: 3425 },
        { level: 0, x: 3212, z: 3464 },
        { level: 0, x: 3208, z: 3495 },
        { level: 0, x: 3253, z: 3401 },
        { level: 0, x: 3202, z: 3431 },
        { level: 0, x: 3229, z: 3437 },
        { level: 0, x: 3238, z: 3404 },
        { level: 0, x: 3194, z: 3403 },
        { level: 0, x: 3174, z: 3427 },
        { level: 0, x: 3270, z: 3429 },
        { level: 0, x: 3181, z: 3375 },
        { level: 0, x: 3221, z: 3398 },
        { level: 0, x: 3259, z: 3431 },
        { level: 0, x: 3218, z: 3411 },
        { level: 0, x: 3196, z: 3441 },
        { level: 0, x: 3263, z: 3415 },
        { level: 0, x: 3206, z: 3478 },
        { level: 0, x: 3227, z: 3488 },
        { level: 0, x: 3189, z: 3388 }
    ],
    activities: [
        {
            id: 'travelling',
            label: 'Walking through Varrock',
            spots: [
                { level: 0, x: 3213, z: 3423 },
                { level: 0, x: 3185, z: 3436 },
                { level: 0, x: 3253, z: 3420 },
                { level: 0, x: 3210, z: 3464 },
                { level: 0, x: 3253, z: 3401 },
                { level: 0, x: 3188, z: 3425 },
                { level: 0, x: 3285, z: 3368 }
            ],
            actionTicks: [4, 10],
            actionLoops: [1, 3],
            anims: [],
            chats: ['Running errands.', 'Need to get back to west bank.', 'Varrock is busy today.'],
            weight: 5
        },
        {
            id: 'smithing',
            label: 'Smithing at the anvils',
            spots: [
                { level: 0, x: 3187, z: 3425 },
                { level: 0, x: 3188, z: 3424 },
                { level: 0, x: 3189, z: 3426 }
            ],
            stat: PlayerStat.SMITHING,
            xp: 380,
            consumes: { steel_bar: 1 },
            product: 'steel_knife',
            maxInventory: 24,
            actionTicks: [7, 13],
            actionLoops: [3, 8],
            anims: ['human_smithing'],
            chats: ['Need more bars.', 'Making knives for ranged.', 'Hammer is nearly worn out.'],
            weight: 5
        },
        {
            id: 'combat',
            label: 'Attacking guards',
            spots: [
                { level: 0, x: 3212, z: 3464 },
                { level: 0, x: 3208, z: 3495 },
                { level: 0, x: 3225, z: 3488 },
                { level: 0, x: 3218, z: 3473 }
            ],
            stat: PlayerStat.STRENGTH,
            xp: 240,
            product: 'bones',
            maxInventory: 18,
            actionTicks: [6, 12],
            actionLoops: [2, 8],
            anims: ['human_axe_hack', 'human_axe_chop', 'human_staff_pummel', 'human_unarmedpunch'],
            chats: ['Guard respawn is slow.', 'Almost out of food.', 'These guards hit harder than rats.'],
            weight: 6
        },
        {
            id: 'mining',
            label: 'Mining ore',
            spots: [
                { level: 0, x: 3286, z: 3366 },
                { level: 0, x: 3282, z: 3371 },
                { level: 0, x: 3279, z: 3368 },
                { level: 0, x: 3181, z: 3375 },
                { level: 0, x: 3176, z: 3369 }
            ],
            stat: PlayerStat.MINING,
            xp: 175,
            product: 'copper_ore',
            maxInventory: 20,
            actionTicks: [10, 18],
            actionLoops: [3, 8],
            anims: ['human_mining_rune_pickaxe', 'human_mining_mithril_pickaxe', 'human_mining_steel_pickaxe', 'human_mining_bronze_pickaxe'],
            chats: ['Copper again.', 'Need tin next.', 'This pickaxe is awful.'],
            weight: 5
        },
        {
            id: 'essence_mining',
            label: 'Mining rune essence',
            spots: [
                { level: 0, x: 3253, z: 3401 },
                { level: 0, x: 3252, z: 3404 },
                { level: 0, x: 3255, z: 3402 }
            ],
            stat: PlayerStat.MINING,
            xp: 110,
            product: 'blankrune',
            maxInventory: 26,
            actionTicks: [8, 14],
            actionLoops: [4, 10],
            anims: ['human_mining_rune_pickaxe', 'human_mining_steel_pickaxe', 'human_mining_bronze_pickaxe'],
            chats: ['Aubury sent me down again.', 'Essence run, then bank.', 'Need runes for teleports.'],
            weight: 4
        },
        {
            id: 'woodcutting',
            label: 'Chopping Varrock trees',
            spots: [
                { level: 0, x: 3168, z: 3421 },
                { level: 0, x: 3174, z: 3427 },
                { level: 0, x: 3246, z: 3428 },
                { level: 0, x: 3270, z: 3429 },
                { level: 0, x: 3191, z: 3402 }
            ],
            stat: PlayerStat.WOODCUTTING,
            xp: 250,
            product: 'logs',
            maxInventory: 18,
            actionTicks: [9, 16],
            actionLoops: [3, 9],
            anims: ['human_woodcutting_rune_axe', 'human_woodcutting_adamant_axe', 'human_woodcutting_mithril_axe', 'human_woodcutting_steel_axe', 'human_woodcutting_bronze_axe'],
            chats: ['Selling these at the general store.', 'Logs are easy money.', 'I need a better axe.'],
            weight: 6
        },
        {
            id: 'firemaking',
            label: 'Lighting fires',
            spots: [
                { level: 0, x: 3198, z: 3429 },
                { level: 0, x: 3206, z: 3429 },
                { level: 0, x: 3223, z: 3435 },
                { level: 0, x: 3242, z: 3426 },
                { level: 0, x: 3256, z: 3420 }
            ],
            stat: PlayerStat.FIREMAKING,
            xp: 160,
            consumes: { logs: 1 },
            actionTicks: [7, 13],
            actionLoops: [2, 6],
            anims: ['human_createfire'],
            chats: ['Fire line toward east bank.', 'Forgot more logs.', 'This one should light.'],
            weight: 4
        },
        {
            id: 'fletching',
            label: 'Fletching at the bank',
            spots: [
                { level: 0, x: 3185, z: 3437 },
                { level: 0, x: 3183, z: 3440 },
                { level: 0, x: 3253, z: 3420 },
                { level: 0, x: 3256, z: 3421 }
            ],
            stat: PlayerStat.FLETCHING,
            xp: 220,
            consumes: { logs: 1 },
            product: 'unstrung_shortbow',
            maxInventory: 24,
            actionTicks: [5, 10],
            actionLoops: [4, 10],
            anims: ['human_knife_slash'],
            chats: ['Cutting these into shortbows.', 'Need bowstrings later.', 'Fletching while I wait.'],
            weight: 4
        },
        {
            id: 'vial_filling',
            label: 'Filling vials',
            spots: [
                { level: 0, x: 3213, z: 3429 },
                { level: 0, x: 3210, z: 3432 },
                { level: 0, x: 3207, z: 3433 }
            ],
            stat: PlayerStat.HERBLORE,
            xp: 40,
            consumes: { vial_empty: 1 },
            product: 'vial_water',
            maxInventory: 26,
            actionTicks: [4, 8],
            actionLoops: [5, 12],
            anims: ['human_herbing_vial'],
            chats: ['Filling these for potions.', 'Need more empty vials.', 'Water vials sell fine.'],
            weight: 3
        }
    ]
};

const AREAS = [LUMBRIDGE, VARROCK];

const BANKING_ACTIVITY: ActivityDefinition = {
    id: 'banking',
    label: 'Banking supplies',
    spots: [],
    actionTicks: [6, 12],
    actionLoops: [1, 1],
    anims: ['human_pickuptable'],
    chats: ['Banking this load.', 'Need to clear my inventory.', 'Back in a minute.']
};

function randomOf<T>(items: T[]): T {
    return items[Math.trunc(Math.random() * items.length)];
}

function randomDelay([min, max]: [number, number]): number {
    return min + Math.trunc(Math.random() * (max - min + 1));
}

function totalItems(store: BotItemStore): number {
    return Object.values(store).reduce((total, count) => total + count, 0);
}

function addItem(store: BotItemStore, item: string, count: number): void {
    store[item] = (store[item] ?? 0) + count;
}

function removeItem(store: BotItemStore, item: string, count: number): void {
    const next = (store[item] ?? 0) - count;
    if (next > 0) {
        store[item] = next;
    } else {
        delete store[item];
    }
}

function consumeItems(store: BotItemStore, consumes: BotItemStore | undefined): void {
    if (!consumes) {
        return;
    }

    for (const [item, count] of Object.entries(consumes)) {
        removeItem(store, item, count);
    }
}

function moveAllItems(from: BotItemStore, to: BotItemStore): void {
    for (const [item, count] of Object.entries(from)) {
        addItem(to, item, count);
        delete from[item];
    }
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

function seq(name: string): number {
    return SeqType.getId(name);
}

function weightedActivity(activities: ActivityDefinition[]): ActivityDefinition {
    const total = activities.reduce((sum, activity) => sum + (activity.weight ?? 1), 0);
    let roll = Math.random() * total;
    for (const activity of activities) {
        roll -= activity.weight ?? 1;
        if (roll <= 0) {
            return activity;
        }
    }
    return activities[activities.length - 1];
}

function isSameCoord(a: Coord, b: { level: number; x: number; z: number }): boolean {
    return a.level === b.level && a.x === b.x && a.z === b.z;
}

export default class WorldLifeDirector {
    private readonly world: LivingWorldHost;
    private readonly store: BotProfileStore;
    private readonly active = new Map<string, SimulatedPlayer>();
    private readonly runtime = new Map<string, BotRuntime>();
    private enabled = Environment.node.livingWorld.enabled;
    private nextManageTick = 0;
    private nextSaveTick = 0;

    constructor(world: LivingWorldHost) {
        this.world = world;
        this.store = new BotProfileStore(Environment.node.livingWorld.profileDir);
    }

    setEnabled(enabled: boolean): void {
        if (this.enabled === enabled) {
            return;
        }

        this.enabled = enabled;
        if (!enabled) {
            this.despawnAll();
            this.store.saveAll();
        }
    }

    setMaxBots(maxBots: number): void {
        Environment.node.livingWorld.maxBots = Math.max(0, Math.min(1000, Math.trunc(maxBots)));
        this.nextManageTick = 0;
    }

    saveNow(): void {
        this.saveActiveProfiles();
        this.store.saveAll();
    }

    getStatus(): string {
        return `Living world ${this.enabled ? 'enabled' : 'disabled'}: ${this.active.size}/${Environment.node.livingWorld.maxBots} active bots.`;
    }

    tick(): void {
        if (!this.enabled) {
            return;
        }

        const humans = this.connectedHumans();
        if (humans.length === 0) {
            if (this.active.size > 0) {
                this.despawnAll();
                this.store.saveAll();
            }
            return;
        }

        const anchor = humans[0];
        const area = this.areaFor(anchor);
        if (!area) {
            this.despawnAll();
            return;
        }

        for (const bot of [...this.active.values()]) {
            if (!bot.isActive || distance(bot, anchor) > Environment.node.livingWorld.radius + area.radius) {
                this.despawn(bot);
                continue;
            }

            bot.touch(this.world.currentTick);
            this.tickBot(bot, area);
        }

        if (this.world.currentTick >= this.nextManageTick) {
            this.nextManageTick = this.world.currentTick + 10;
            this.ensurePopulation(area, humans.length);
        }

        if (this.world.currentTick >= this.nextSaveTick) {
            this.nextSaveTick = this.world.currentTick + 100;
            this.saveActiveProfiles();
            this.store.saveAll();
        }
    }

    private connectedHumans(): Player[] {
        const humans: Player[] = [];
        for (const player of this.world.playerLoop.all()) {
            if (!isSimulatedPlayer(player) && isClientConnected(player)) {
                humans.push(player);
            }
        }
        return humans;
    }

    private areaFor(player: Player): AreaDefinition | null {
        return AREAS.find(area => player.level === area.center.level && distance(player, area.center) <= area.radius) ?? null;
    }

    private ensurePopulation(area: AreaDefinition, humanCount: number): void {
        const desired = humanCount > 0 ? Environment.node.livingWorld.maxBots : 0;

        while (this.active.size > desired) {
            const bot = this.active.values().next().value as SimulatedPlayer | undefined;
            if (!bot) {
                break;
            }
            this.despawn(bot);
        }

        while (this.active.size < desired) {
            const activeIds = new Set(this.active.keys());
            const profile = this.store.checkout(activeIds);
            if (!profile) {
                return;
            }

            const spawn = randomOf(area.spawnPoints);
            profile.x = spawn.x;
            profile.z = spawn.z;
            profile.level = spawn.level;
            profile.activity = 'idle';
            profile.goal = 'Arriving nearby';

            const bot = new SimulatedPlayer(profile);
            if (!this.world.addSimulatedPlayer(bot)) {
                return;
            }

            if (Math.random() < 0.35) {
                bot.say(randomOf(['Hello.', 'Anyone training here?', 'Busy world today.', 'Back to work.']));
            }
            this.active.set(profile.id, bot);
            this.runtime.set(profile.id, this.createRuntime(bot, area));
        }
    }

    private createRuntime(bot: SimulatedPlayer, area: AreaDefinition): BotRuntime {
        const activity = this.chooseActivity(bot.profile, area);
        const destination = this.destinationFor(activity, area);
        bot.profile.activity = activity.id;
        bot.profile.goal = activity.label;

        return {
            activity,
            destination,
            nextActionTick: this.world.currentTick + randomDelay(activity.actionTicks),
            actionsRemaining: randomDelay(activity.actionLoops ?? [2, 6]),
            stuckTicks: 0,
            recoveryCount: 0,
            pathFailures: 0,
            lastDistance: distance(bot, destination),
            lastProgressTick: this.world.currentTick,
            lastX: bot.x,
            lastZ: bot.z
        };
    }

    private chooseActivity(profile: BotProfile, area: AreaDefinition): ActivityDefinition {
        if (totalItems(profile.inventory) >= 24) {
            return BANKING_ACTIVITY;
        }

        return weightedActivity(area.activities);
    }

    private destinationFor(activity: ActivityDefinition, area: AreaDefinition): Coord {
        const spots = activity.id === 'banking' ? [area.bank, ...area.safePoints] : activity.spots;
        const candidates = spots.filter(spot => this.isUsableDestination(spot, area));

        if (candidates.length > 0) {
            return randomOf(candidates);
        }

        return randomOf(area.safePoints);
    }

    private isUsableDestination(spot: Coord, area: AreaDefinition): boolean {
        if (spot.level !== area.center.level || distance(spot, area.center) > area.radius + 32) {
            return false;
        }

        if (isMapBlocked(spot.x, spot.z, spot.level)) {
            return false;
        }

        return !isIndoors(spot.x, spot.z, spot.level);
    }

    private queuePathTo(bot: SimulatedPlayer, destination: Coord): boolean {
        if (bot.level !== destination.level || isSameCoord(destination, bot)) {
            return false;
        }

        if (isMapBlocked(destination.x, destination.z, destination.level)) {
            return false;
        }

        const waypoints = findPath(bot.level, bot.x, bot.z, destination.x, destination.z);
        if (waypoints.length === 0) {
            return false;
        }

        const first = CoordGrid.unpackCoord(waypoints[0]);
        if (waypoints.length === 1 && first.x === bot.x && first.z === bot.z) {
            return false;
        }

        bot.queueWaypoints(waypoints);
        return true;
    }

    private tickBot(bot: SimulatedPlayer, area: AreaDefinition): void {
        let runtime = this.runtime.get(bot.profile.id);
        if (!runtime) {
            runtime = this.createRuntime(bot, area);
            this.runtime.set(bot.profile.id, runtime);
        }

        const currentDistance = distance(bot, runtime.destination);
        const moved = runtime.lastX !== bot.x || runtime.lastZ !== bot.z;
        const progressed = moved || currentDistance < runtime.lastDistance;

        if (progressed) {
            runtime.stuckTicks = 0;
            runtime.pathFailures = 0;
            runtime.lastProgressTick = this.world.currentTick;
        } else if (bot.hasWaypoints()) {
            runtime.stuckTicks++;
        }

        runtime.lastX = bot.x;
        runtime.lastZ = bot.z;
        runtime.lastDistance = currentDistance;

        if (bot.level !== runtime.destination.level) {
            this.recoverBot(bot, runtime, area);
            return;
        }

        if (!this.isUsableDestination(runtime.destination, area)) {
            this.recoverBot(bot, runtime, area);
            return;
        }

        if (currentDistance > 1) {
            if (!bot.hasWaypoints()) {
                if (!this.queuePathTo(bot, runtime.destination)) {
                    this.recoverBot(bot, runtime, area);
                }
            } else if (runtime.stuckTicks >= 6 || this.world.currentTick - runtime.lastProgressTick > 20) {
                bot.clearWaypoints();
                if (this.queuePathTo(bot, runtime.destination)) {
                    runtime.stuckTicks = 0;
                } else {
                    this.recoverBot(bot, runtime, area);
                }
            }
            return;
        }

        runtime.recoveryCount = 0;
        runtime.pathFailures = 0;

        if (this.world.currentTick < runtime.nextActionTick) {
            if (Math.random() < 0.01) {
                bot.faceSquare(runtime.destination.x, runtime.destination.z);
            }
            return;
        }

        this.performActivity(bot, runtime, area);
    }

    private performActivity(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): void {
        const profile = bot.profile;

        if (runtime.activity.id === 'banking') {
            moveAllItems(profile.inventory, profile.bank);
            if (Math.random() < 0.7) {
                bot.say(randomOf(runtime.activity.chats));
            }
            this.finishActivity(bot, runtime, area);
            return;
        }

        this.playActivityAnimation(bot, runtime.activity);
        consumeItems(profile.inventory, runtime.activity.consumes);

        const advanced =
            runtime.activity.stat !== undefined && runtime.activity.xp
                ? bot.addSimulatedXp(runtime.activity.stat, runtime.activity.xp)
                : false;

        if (runtime.activity.product) {
            addItem(profile.inventory, runtime.activity.product, 1);
        }

        runtime.actionsRemaining--;

        if (runtime.activity.stat !== undefined && advanced) {
            bot.say(`Level ${bot.baseLevels[runtime.activity.stat]}!`);
        } else if (Math.random() < 0.1) {
            bot.say(randomOf(runtime.activity.chats));
        }

        if (totalItems(profile.inventory) >= (runtime.activity.maxInventory ?? 24)) {
            runtime.activity = BANKING_ACTIVITY;
            runtime.destination = this.destinationFor(BANKING_ACTIVITY, area);
            runtime.actionsRemaining = 1;
            profile.activity = 'banking';
            profile.goal = BANKING_ACTIVITY.label;
            this.resetRuntimeTracking(bot, runtime);
        } else if (runtime.actionsRemaining <= 0) {
            this.finishActivity(bot, runtime, area);
        }

        runtime.nextActionTick = this.world.currentTick + randomDelay(runtime.activity.actionTicks);
    }

    private finishActivity(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): void {
        runtime.activity = this.chooseActivity(bot.profile, area);
        runtime.destination = this.destinationFor(runtime.activity, area);
        runtime.nextActionTick = this.world.currentTick + randomDelay(runtime.activity.actionTicks);
        runtime.actionsRemaining = randomDelay(runtime.activity.actionLoops ?? [2, 6]);
        this.resetRuntimeTracking(bot, runtime);
        bot.profile.activity = runtime.activity.id;
        bot.profile.goal = runtime.activity.label;
    }

    private recoverBot(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): void {
        bot.clearWaypoints();
        runtime.pathFailures++;
        runtime.recoveryCount++;

        if (runtime.recoveryCount >= 3 || runtime.pathFailures >= 4) {
            const safePoint = randomOf(area.safePoints);
            bot.teleJump(safePoint.x, safePoint.z, safePoint.level);
            runtime.recoveryCount = 0;
            runtime.pathFailures = 0;

            if (Math.random() < 0.25) {
                bot.say(randomOf(['Lost my route.', 'Back on track.', 'Trying somewhere else.']));
            }
        }

        this.finishActivity(bot, runtime, area);
    }

    private resetRuntimeTracking(bot: SimulatedPlayer, runtime: BotRuntime): void {
        runtime.stuckTicks = 0;
        runtime.lastX = bot.x;
        runtime.lastZ = bot.z;
        runtime.lastDistance = distance(bot, runtime.destination);
        runtime.lastProgressTick = this.world.currentTick;
    }

    private playActivityAnimation(bot: SimulatedPlayer, activity: ActivityDefinition): void {
        for (const name of activity.anims) {
            const id = seq(name);
            if (id !== -1) {
                bot.playAnimation(id, 0);
                return;
            }
        }
    }

    private despawn(bot: SimulatedPlayer): void {
        bot.syncProfile(this.world.currentTick);
        this.store.save(bot.profile);
        this.active.delete(bot.profile.id);
        this.runtime.delete(bot.profile.id);
        this.world.removeSimulatedPlayer(bot);
    }

    private despawnAll(): void {
        for (const bot of [...this.active.values()]) {
            this.despawn(bot);
        }
    }

    private saveActiveProfiles(): void {
        for (const bot of this.active.values()) {
            bot.syncProfile(this.world.currentTick);
            this.store.save(bot.profile);
        }
    }
}
