import CategoryType from '#/cache/config/CategoryType.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import GameMap, { findPath, isMapBlocked } from '#/engine/GameMap.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import Loc from '#/engine/entity/Loc.js';
import Npc from '#/engine/entity/Npc.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import SimulatedPlayer from '#/engine/entity/SimulatedPlayer.js';
import BotProfileStore, { BotItemStore, LivingWorldActivity } from '#/engine/living/BotProfileStore.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
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
    populationWeight: number;
    center: Coord;
    radius: number;
    bank: Coord;
    safePoints: Coord[];
    spawnPoints: Coord[];
    activities: ActivityDefinition[];
};

type BotRuntime = {
    areaId: string;
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
    target: Loc | Npc | null;
    op: number;
    useItem: string | null;
    partnerId: string | null;
};

type LivingWorldHost = {
    currentTick: number;
    gameMap: GameMap;
    addSimulatedPlayer(player: SimulatedPlayer): boolean;
    removeSimulatedPlayer(player: SimulatedPlayer): void;
};

const LUMBRIDGE: AreaDefinition = {
    id: 'lumbridge',
    populationWeight: 12,
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
    populationWeight: 16,
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

type TownIndustry = 'woodcutting' | 'fishing' | 'mining';

function townPoint(center: Coord, x: number, z: number): Coord {
    return { level: center.level, x: center.x + x, z: center.z + z };
}

function createTownArea(id: string, name: string, center: Coord, bank: Coord, industry: TownIndustry, populationWeight: number = 5): AreaDefinition {
    const points: Coord[] = [
        townPoint(center, 0, 0),
        townPoint(center, 3, 1),
        townPoint(center, -4, 2),
        townPoint(center, 6, -3),
        townPoint(center, -7, -4),
        townPoint(center, 10, 6),
        townPoint(center, -11, 5),
        townPoint(center, 4, 10),
        townPoint(center, -5, -10),
        townPoint(center, 13, -8),
        townPoint(center, -13, -7),
        townPoint(center, 8, 13)
    ];
    const resourceSpots: Coord[] = [points[4], points[6], points[8], points[10]];
    let industryActivity: ActivityDefinition;
    if (industry === 'fishing') {
        industryActivity = {
            id: 'fishing',
            label: `Fishing near ${name}`,
            spots: resourceSpots,
            stat: PlayerStat.FISHING,
            xp: 120,
            product: 'raw_shrimps',
            maxInventory: 20,
            actionTicks: [9, 17],
            actionLoops: [3, 8],
            anims: ['human_smallnet'],
            chats: [`Fishing near ${name}.`, 'Another load for the bank.', 'These should sell.'],
            weight: 6
        };
    } else if (industry === 'mining') {
        industryActivity = {
            id: 'mining',
            label: `Mining near ${name}`,
            spots: resourceSpots,
            stat: PlayerStat.MINING,
            xp: 175,
            product: 'copper_ore',
            maxInventory: 20,
            actionTicks: [10, 18],
            actionLoops: [3, 8],
            anims: ['human_mining_rune_pickaxe', 'human_mining_mithril_pickaxe', 'human_mining_steel_pickaxe', 'human_mining_bronze_pickaxe'],
            chats: [`Mining near ${name}.`, 'Banking after this load.', 'Ore prices are decent.'],
            weight: 6
        };
    } else {
        industryActivity = {
            id: 'woodcutting',
            label: `Chopping trees near ${name}`,
            spots: resourceSpots,
            stat: PlayerStat.WOODCUTTING,
            xp: 250,
            product: 'logs',
            maxInventory: 18,
            actionTicks: [9, 16],
            actionLoops: [3, 8],
            anims: ['human_woodcutting_rune_axe', 'human_woodcutting_mithril_axe', 'human_woodcutting_steel_axe', 'human_woodcutting_bronze_axe', 'human_axe_chop'],
            chats: [`Chopping near ${name}.`, 'A few more logs.', 'Selling these after banking.'],
            weight: 6
        };
    }

    return {
        id,
        populationWeight,
        center,
        radius: 80,
        bank,
        safePoints: points.slice(0, 8),
        spawnPoints: points,
        activities: [
            industryActivity,
            {
                id: 'combat',
                label: `Training near ${name}`,
                spots: [points[3], points[5], points[7], points[9]],
                stat: PlayerStat.ATTACK,
                xp: 180,
                product: 'bones',
                maxInventory: 16,
                actionTicks: [8, 14],
                actionLoops: [2, 7],
                anims: ['human_axe_hack', 'human_staff_pummel', 'human_unarmedpunch', 'human_axe_chop'],
                chats: [`Training near ${name}.`, 'One more fight.', 'I should bank soon.'],
                weight: 3
            },
            {
                id: 'travelling',
                label: `Walking through ${name}`,
                spots: points,
                actionTicks: [4, 10],
                actionLoops: [1, 3],
                anims: [],
                chats: [`Heading through ${name}.`, 'Running errands.', 'Back to the bank soon.'],
                weight: 4
            }
        ]
    };
}

const FALADOR = createTownArea('falador', 'Falador', { level: 0, x: 2965, z: 3379 }, { level: 0, x: 2945, z: 3368 }, 'mining', 13);
const DRAYNOR = createTownArea('draynor', 'Draynor Village', { level: 0, x: 3080, z: 3250 }, { level: 0, x: 3092, z: 3243 }, 'woodcutting', 8);
const PORT_SARIM = createTownArea('port_sarim', 'Port Sarim', { level: 0, x: 3027, z: 3225 }, { level: 0, x: 3045, z: 3235 }, 'fishing', 7);
const AL_KHARID = createTownArea('al_kharid', 'Al Kharid', { level: 0, x: 3292, z: 3183 }, { level: 0, x: 3269, z: 3167 }, 'mining', 10);
const SEERS = createTownArea('seers', "Seers' Village", { level: 0, x: 2732, z: 3485 }, { level: 0, x: 2725, z: 3493 }, 'woodcutting', 9);
const ARDOUGNE = createTownArea('ardougne', 'Ardougne', { level: 0, x: 2663, z: 3302 }, { level: 0, x: 2616, z: 3332 }, 'woodcutting', 14);
const BRIMHAVEN = createTownArea('brimhaven', 'Brimhaven', { level: 0, x: 2802, z: 3177 }, { level: 0, x: 2802, z: 3177 }, 'fishing', 5);
const RIMMINGTON = createTownArea('rimmington', 'Rimmington', { level: 0, x: 2956, z: 3210 }, { level: 0, x: 2956, z: 3210 }, 'mining', 4);
const GNOME_COURSE = createTownArea('gnome_course', 'the Gnome Stronghold', { level: 0, x: 2474, z: 3437 }, { level: 0, x: 2449, z: 3482 }, 'woodcutting', 7);
const EDGEVILLE = createTownArea('edgeville', 'Edgeville', { level: 0, x: 3088, z: 3492 }, { level: 0, x: 3094, z: 3492 }, 'woodcutting', 7);
const BARBARIAN_VILLAGE = createTownArea('barbarian_village', 'Barbarian Village', { level: 0, x: 3081, z: 3420 }, { level: 0, x: 3094, z: 3492 }, 'fishing', 5);
const TAVERLEY = createTownArea('taverley', 'Taverley', { level: 0, x: 2894, z: 3443 }, { level: 0, x: 2945, z: 3368 }, 'woodcutting', 5);
const BURTHORPE = createTownArea('burthorpe', 'Burthorpe', { level: 0, x: 2899, z: 3544 }, { level: 0, x: 2899, z: 3544 }, 'mining', 4);
const CATHERBY = createTownArea('catherby', 'Catherby', { level: 0, x: 2815, z: 3441 }, { level: 0, x: 2808, z: 3441 }, 'fishing', 8);
const YANILLE = createTownArea('yanille', 'Yanille', { level: 0, x: 2606, z: 3095 }, { level: 0, x: 2613, z: 3093 }, 'woodcutting', 7);
const TREE_GNOME_VILLAGE = createTownArea('tree_gnome_village', 'Tree Gnome Village', { level: 0, x: 2525, z: 3168 }, { level: 0, x: 2525, z: 3168 }, 'woodcutting', 4);
const KARAMJA = createTownArea('karamja', 'Karamja', { level: 0, x: 2925, z: 3175 }, { level: 0, x: 2925, z: 3175 }, 'fishing', 5);
const SHILO_VILLAGE = createTownArea('shilo_village', 'Shilo Village', { level: 0, x: 2852, z: 2954 }, { level: 0, x: 2852, z: 2954 }, 'fishing', 4);
const ENTRANA = createTownArea('entrana', 'Entrana', { level: 0, x: 2825, z: 3338 }, { level: 0, x: 2825, z: 3338 }, 'woodcutting', 3);
const CANIFIS = createTownArea('canifis', 'Canifis', { level: 0, x: 3505, z: 3485 }, { level: 0, x: 3512, z: 3480 }, 'woodcutting', 6);
const MORTTON = createTownArea('mortton', "Mort'ton", { level: 0, x: 3488, z: 3288 }, { level: 0, x: 3488, z: 3288 }, 'mining', 3);
const RELLEKKA = createTownArea('rellekka', 'Rellekka', { level: 0, x: 2660, z: 3658 }, { level: 0, x: 2660, z: 3658 }, 'fishing', 5);
const AIR_ALTAR: AreaDefinition = {
    id: 'air_altar',
    populationWeight: 1,
    center: { level: 0, x: 2841, z: 4830 },
    radius: 32,
    bank: { level: 0, x: 2841, z: 4830 },
    safePoints: [
        { level: 0, x: 2841, z: 4830 },
        { level: 0, x: 2843, z: 4831 },
        { level: 0, x: 2839, z: 4829 }
    ],
    spawnPoints: [
        { level: 0, x: 2841, z: 4830 },
        { level: 0, x: 2843, z: 4831 },
        { level: 0, x: 2839, z: 4829 }
    ],
    activities: []
};

const AREAS: AreaDefinition[] = [
    LUMBRIDGE,
    VARROCK,
    FALADOR,
    ARDOUGNE,
    AL_KHARID,
    SEERS,
    CATHERBY,
    DRAYNOR,
    PORT_SARIM,
    YANILLE,
    EDGEVILLE,
    GNOME_COURSE,
    CANIFIS,
    BARBARIAN_VILLAGE,
    TAVERLEY,
    BRIMHAVEN,
    KARAMJA,
    RELLEKKA,
    RIMMINGTON,
    BURTHORPE,
    TREE_GNOME_VILLAGE,
    SHILO_VILLAGE,
    ENTRANA,
    MORTTON,
    AIR_ALTAR
];

const BANKING_ACTIVITY: ActivityDefinition = {
    id: 'banking',
    label: 'Banking supplies',
    spots: [],
    actionTicks: [6, 12],
    actionLoops: [1, 1],
    anims: ['human_pickuptable'],
    chats: ['Banking this load.', 'Need to clear my inventory.', 'Back in a minute.']
};

const SHARED_ACTIVITIES: ActivityDefinition[] = [
    {
        id: 'woodcutting',
        label: 'Chopping a nearby tree',
        spots: [],
        stat: PlayerStat.WOODCUTTING,
        actionTicks: [5, 10],
        actionLoops: [2, 6],
        anims: [],
        chats: ['A few more logs.', 'Then back to the bank.'],
        weight: 7
    },
    {
        id: 'fishing',
        label: 'Fishing at a nearby spot',
        spots: [],
        stat: PlayerStat.FISHING,
        actionTicks: [6, 12],
        actionLoops: [2, 6],
        anims: [],
        chats: ['One more catch.', 'This spot is busy.'],
        weight: 6
    },
    {
        id: 'mining',
        label: 'Mining a nearby rock',
        spots: [],
        stat: PlayerStat.MINING,
        actionTicks: [5, 10],
        actionLoops: [2, 6],
        anims: [],
        chats: ['Looking for ore.', 'This rock should respawn soon.'],
        weight: 6
    },
    {
        id: 'combat',
        label: 'Fighting a nearby creature',
        spots: [],
        stat: PlayerStat.ATTACK,
        actionTicks: [5, 10],
        actionLoops: [1, 4],
        anims: [],
        chats: ['Training combat.', 'I should watch my health.'],
        weight: 6
    },
    {
        id: 'thieving',
        label: 'Looking for something to steal',
        spots: [],
        stat: PlayerStat.THIEVING,
        actionTicks: [5, 10],
        actionLoops: [2, 5],
        anims: [],
        chats: ['Nobody saw that.', 'Just one more.'],
        weight: 5
    },
    {
        id: 'cooking',
        label: 'Cooking a catch',
        spots: [],
        stat: PlayerStat.COOKING,
        actionTicks: [5, 10],
        actionLoops: [2, 5],
        anims: [],
        chats: ['Hope this one does not burn.', 'Fresh from the fishing spot.'],
        weight: 4
    },
    {
        id: 'smithing',
        label: 'Smithing at an anvil',
        spots: [],
        stat: PlayerStat.SMITHING,
        actionTicks: [5, 10],
        actionLoops: [2, 5],
        anims: [],
        chats: ['A few more bars.', 'Making something useful.'],
        weight: 4
    },
    {
        id: 'firemaking',
        label: 'Lighting logs',
        spots: [],
        stat: PlayerStat.FIREMAKING,
        actionTicks: [5, 9],
        actionLoops: [2, 5],
        anims: [],
        chats: ['This should catch.', 'Making a proper fire line.'],
        weight: 4
    },
    {
        id: 'fletching',
        label: 'Fletching logs at the bank',
        spots: [],
        stat: PlayerStat.FLETCHING,
        actionTicks: [5, 10],
        actionLoops: [2, 5],
        anims: [],
        chats: ['Cutting these into bows.', 'Fletching this whole load.'],
        weight: 5
    },
    {
        id: 'prayer',
        label: 'Burying bones',
        spots: [],
        stat: PlayerStat.PRAYER,
        actionTicks: [4, 8],
        actionLoops: [2, 6],
        anims: [],
        chats: ['Saving these bones for Prayer.', 'One bone at a time.'],
        weight: 3
    },
    {
        id: 'agility',
        label: 'Training on an agility obstacle',
        spots: [],
        stat: PlayerStat.AGILITY,
        actionTicks: [5, 10],
        actionLoops: [1, 3],
        anims: [],
        chats: ['Nearly made that cleanly.', 'Another lap.'],
        weight: 3
    },
    {
        id: 'crafting',
        label: 'Crafting leather at the bank',
        spots: [],
        stat: PlayerStat.CRAFTING,
        actionTicks: [5, 10],
        actionLoops: [2, 5],
        anims: [],
        chats: ['Making a few leather pieces.', 'I brought plenty of thread.'],
        weight: 4
    },
    {
        id: 'herblore',
        label: 'Mixing potions at the bank',
        spots: [],
        stat: PlayerStat.HERBLORE,
        actionTicks: [5, 10],
        actionLoops: [2, 5],
        anims: [],
        chats: ['Mixing another potion.', 'Careful with the ingredients.'],
        weight: 4
    },
    {
        id: 'runecraft',
        label: 'Binding rune essence',
        spots: [],
        stat: PlayerStat.RUNECRAFT,
        actionTicks: [5, 10],
        actionLoops: [1, 3],
        anims: [],
        chats: ['Binding this essence.', 'Another altar trip.'],
        weight: 5
    },
    {
        id: 'trading',
        label: 'Buying and selling supplies with other adventurers',
        spots: [],
        actionTicks: [5, 10],
        actionLoops: [1, 3],
        anims: [],
        chats: ['Buying skilling supplies.', 'Selling this bank load.', 'Anyone trading?'],
        weight: 5
    },
    {
        id: 'questing',
        label: 'Talking to locals and working on a quest',
        spots: [],
        actionTicks: [4, 9],
        actionLoops: [2, 5],
        anims: [],
        chats: ['Where was that quest NPC?', 'I need one more quest item.', 'Checking the next quest step.'],
        weight: 4
    },
    {
        id: 'travelling',
        label: 'Walking through town',
        spots: [],
        actionTicks: [4, 9],
        actionLoops: [1, 2],
        anims: [],
        chats: ['Running errands.', 'Heading across town.'],
        weight: 2
    }
];

const BANK_KEEP_ITEMS = new Set(['bronze_axe', 'bronze_pickaxe', 'net', 'fishing_rod', 'fly_fishing_rod', 'lobster_pot', 'harpoon', 'fishing_bait', 'feather', 'tinderbox', 'knife', 'hammer', 'needle', 'thread']);

const ACTIVITY_SUPPLIES: Partial<Record<LivingWorldActivity, BotItemStore>> = {
    woodcutting: { bronze_axe: 1 },
    fishing: { net: 1 },
    mining: { bronze_pickaxe: 1 },
    cooking: { raw_shrimp: 12 },
    smithing: { hammer: 1, bronze_bar: 12 },
    firemaking: { tinderbox: 1, logs: 12 },
    fletching: { knife: 1, logs: 12 },
    prayer: { bones: 12 },
    crafting: { needle: 1, thread: 20, leather: 12 },
    herblore: { vial_water: 12, guam_leaf: 12, eye_of_newt: 12 },
    runecraft: { blankrune: 24 }
};

function randomOf<T>(items: T[]): T {
    return items[Math.trunc(Math.random() * items.length)];
}

function randomDelay([min, max]: [number, number]): number {
    return min + Math.trunc(Math.random() * (max - min + 1));
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

function optionIndex(options: (string | null)[] | null, pattern: RegExp): number {
    return options?.findIndex(option => option !== null && pattern.test(option)) ?? -1;
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

function populationTargets(total: number): Map<string, number> {
    const targets = new Map<string, number>();
    const weightTotal = AREAS.reduce((sum, area) => sum + area.populationWeight, 0);
    const shares = AREAS.map(area => {
        const exact = total * (area.populationWeight / weightTotal);
        const base = Math.floor(exact);
        targets.set(area.id, base);
        return { area, fraction: exact - base };
    });
    let assigned = [...targets.values()].reduce((sum, count) => sum + count, 0);
    shares.sort((a, b) => b.fraction - a.fraction);
    for (let index = 0; assigned < total; index++, assigned++) {
        const area = shares[index % shares.length].area;
        targets.set(area.id, (targets.get(area.id) ?? 0) + 1);
    }
    return targets;
}

const BOT_DECISION_SLICES = 5;
const POPULATION_CHANGES_PER_MANAGE = 40;
const PROFILE_SAVE_INTERVAL = 500;

export default class WorldLifeDirector {
    private readonly world: LivingWorldHost;
    private readonly store: BotProfileStore;
    private readonly active = new Map<string, SimulatedPlayer>();
    private readonly runtime = new Map<string, BotRuntime>();
    private readonly locCatalog = new Map<string, Loc[]>();
    private readonly npcCatalog = new Map<string, Npc[]>();
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
        } else {
            this.nextManageTick = 0;
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
        const populatedAreas = new Set([...this.runtime.values()].map(runtime => runtime.areaId)).size;
        return `Living world ${this.enabled ? 'enabled' : 'disabled'}: ${this.active.size}/${Environment.node.livingWorld.maxBots} active bots across ${populatedAreas}/${AREAS.length} city hubs.`;
    }

    tick(): void {
        if (!this.enabled) {
            return;
        }

        let botIndex = 0;
        for (const bot of [...this.active.values()]) {
            if (!bot.isActive) {
                this.despawn(bot);
                continue;
            }

            let runtime = this.runtime.get(bot.profile.id);
            if (!runtime) {
                const area = this.nearestArea(bot);
                runtime = this.createRuntime(bot, area);
                this.runtime.set(bot.profile.id, runtime);
            }
            if (!runtime) {
                continue;
            }

            const runtimeAreaId = runtime.areaId;
            let area = AREAS.find(candidate => candidate.id === runtimeAreaId) ?? this.nearestArea(bot);
            if (bot.level !== area.center.level || distance(bot, area.center) > area.radius + 64) {
                area = this.nearestArea(bot);
                runtime = this.createRuntime(bot, area);
                this.runtime.set(bot.profile.id, runtime);
            }
            bot.touch(this.world.currentTick);
            if (botIndex++ % BOT_DECISION_SLICES === this.world.currentTick % BOT_DECISION_SLICES) {
                this.tickBot(bot, area);
            }
        }

        if (this.world.currentTick >= this.nextManageTick) {
            this.nextManageTick = this.world.currentTick + 2;
            this.ensurePopulation();
        }

        if (this.world.currentTick >= this.nextSaveTick) {
            this.nextSaveTick = this.world.currentTick + PROFILE_SAVE_INTERVAL;
            this.saveActiveProfiles();
            this.store.saveAll();
        }
    }

    private nearestArea(point: { level: number; x: number; z: number }): AreaDefinition {
        const sameLevel = AREAS.filter(area => area.center.level === point.level);
        const candidates = sameLevel.length > 0 ? sameLevel : AREAS;
        return candidates.reduce((closest, area) => (distance(point, area.center) < distance(point, closest.center) ? area : closest));
    }

    private ensurePopulation(): void {
        const desired = Environment.node.livingWorld.maxBots;
        const targets = populationTargets(desired);
        const buckets = new Map<string, SimulatedPlayer[]>(AREAS.map(area => [area.id, []]));
        let changes = 0;

        for (const bot of [...this.active.values()]) {
            const runtime = this.runtime.get(bot.profile.id);
            const bucket = runtime ? buckets.get(runtime.areaId) : undefined;
            if (!bucket) {
                this.despawn(bot);
                continue;
            }
            bucket.push(bot);
        }

        for (const area of AREAS) {
            const target = targets.get(area.id) ?? 0;
            const bots = buckets.get(area.id) ?? [];
            while (bots.length > target && changes < POPULATION_CHANGES_PER_MANAGE) {
                const bot = bots.pop();
                if (bot) {
                    this.despawn(bot);
                    changes++;
                }
            }
        }

        const activeIds = new Set(this.active.keys());
        for (const area of AREAS) {
            const target = targets.get(area.id) ?? 0;
            const bots = buckets.get(area.id) ?? [];
            while (bots.length < target && changes < POPULATION_CHANGES_PER_MANAGE) {
                const profile = this.store.checkout(activeIds);
                if (!profile) {
                    return;
                }

                const usableSpawns = area.spawnPoints.filter(spawn => this.isUsableDestination(spawn, area));
                const spawn = randomOf(usableSpawns.length > 0 ? usableSpawns : area.spawnPoints);
                profile.x = spawn.x;
                profile.z = spawn.z;
                profile.level = spawn.level;
                profile.activity = 'idle';
                profile.goal = `Arriving in ${area.id.replaceAll('_', ' ')}`;

                const bot = new SimulatedPlayer(profile);
                if (!this.world.addSimulatedPlayer(bot)) {
                    return;
                }
                this.initializeBotScripts(bot);

                if (Math.random() < 0.35) {
                    bot.say(randomOf(['Hello.', 'Anyone training here?', 'Busy world today.', 'Back to work.']));
                }
                activeIds.add(profile.id);
                bots.push(bot);
                this.active.set(profile.id, bot);
                this.runtime.set(profile.id, this.createRuntime(bot, area));
                changes++;
            }
        }
    }

    private createRuntime(bot: SimulatedPlayer, area: AreaDefinition): BotRuntime {
        const activity = this.chooseActivity(bot, area);
        const destination = this.destinationFor(activity, area);
        bot.profile.activity = activity.id;
        bot.profile.goal = activity.label;

        const runtime: BotRuntime = {
            areaId: area.id,
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
            lastZ: bot.z,
            target: null,
            op: -1,
            useItem: null,
            partnerId: null
        };
        this.retargetRuntime(bot, runtime, area);
        return runtime;
    }

    private chooseActivity(bot: SimulatedPlayer, area: AreaDefinition): ActivityDefinition {
        const inventory = bot.getInventory(InvType.INV);
        if (inventory && inventory.freeSlotCount <= 2) {
            return BANKING_ACTIVITY;
        }

        const localActivities = new Set(area.activities.map(activity => activity.id));
        const activities = [...area.activities, ...SHARED_ACTIVITIES.filter(activity => !localActivities.has(activity.id))];
        const candidates = activities.filter(activity => this.canRunActivity(bot, activity, area));
        return weightedActivity(candidates.length > 0 ? candidates : [SHARED_ACTIVITIES[SHARED_ACTIVITIES.length - 1]]);
    }

    private destinationFor(activity: ActivityDefinition, area: AreaDefinition): Coord {
        const spots = activity.id === 'banking' || activity.id === 'fletching' ? [area.bank, ...area.safePoints] : activity.spots.length > 0 ? activity.spots : area.safePoints;
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

        return true;
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

        if (this.handleBotDialog(bot)) {
            return;
        }

        if (runtime.activity.id === 'banking' && bot.containsModalInterface()) {
            this.performBanking(bot, runtime, area);
            return;
        }
        if (bot.containsModalInterface() && this.handleSkillInterface(bot, runtime, area)) {
            return;
        }

        if (bot.delayed || bot.protect || bot.activeScript || bot.hasInteraction() || bot.hasWaypoints()) {
            return;
        }

        const inventory = bot.getInventory(InvType.INV);
        if (runtime.activity.id !== 'banking' && inventory && inventory.freeSlotCount <= 1 && runtime.activity.id !== 'firemaking' && runtime.activity.id !== 'fletching' && runtime.activity.id !== 'prayer') {
            this.switchToBanking(bot, runtime, area);
            return;
        }
        if (runtime.activity.id !== 'banking' && !this.hasInventorySupplies(bot, runtime.activity)) {
            this.switchToBanking(bot, runtime, area);
            return;
        }

        if (runtime.target && !this.targetMatches(bot, runtime.activity, runtime.target)) {
            this.finishActivity(bot, runtime, area);
            return;
        }

        if (runtime.activity.id === 'trading' && runtime.partnerId) {
            const partner = this.active.get(runtime.partnerId);
            if (partner?.isActive && this.runtime.get(partner.profile.id)?.areaId === area.id) {
                runtime.destination = { level: partner.level, x: partner.x, z: partner.z };
            } else {
                this.retargetRuntime(bot, runtime, area);
            }
        }

        const currentDistance = distance(bot, runtime.target ?? runtime.destination);
        if (!runtime.target && currentDistance > 1) {
            if (!this.queuePathTo(bot, runtime.destination)) {
                this.recoverBot(bot, runtime, area);
            }
            return;
        }

        if (this.world.currentTick < runtime.nextActionTick) {
            return;
        }

        this.performActivity(bot, runtime, area);
    }

    private performActivity(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): void {
        if (runtime.actionsRemaining <= 0) {
            this.finishActivity(bot, runtime, area);
            return;
        }

        if (runtime.activity.id === 'banking') {
            if (runtime.target) {
                this.startTargetInteraction(bot, runtime);
            } else {
                this.performBanking(bot, runtime, area);
            }
            return;
        }

        let started = false;
        switch (runtime.activity.id) {
            case 'firemaking':
                started = this.runInventoryUse(bot, 'logs', 'tinderbox');
                break;
            case 'fletching':
                started = this.runInventoryUse(bot, 'logs', 'knife');
                break;
            case 'prayer':
                started = this.runHeldOption(bot, 'bones', 0);
                break;
            case 'crafting':
                started = this.runInventoryUse(bot, 'leather', 'needle');
                break;
            case 'herblore': {
                const guamVial = ObjType.getId('guamvial');
                const hasUnfinishedPotion = (bot.getInventory(InvType.INV)?.getItemCount(guamVial) ?? 0) > 0;
                started = hasUnfinishedPotion ? this.runInventoryUse(bot, 'guamvial', 'eye_of_newt') : this.runInventoryUse(bot, 'vial_water', 'guam_leaf');
                break;
            }
            case 'trading':
                started = this.performTrade(bot, runtime, area);
                break;
            case 'travelling':
                started = true;
                runtime.destination = this.destinationFor(runtime.activity, area);
                if (distance(bot, runtime.destination) > 1) {
                    this.queuePathTo(bot, runtime.destination);
                }
                break;
            default:
                started = this.startTargetInteraction(bot, runtime);
                break;
        }

        if (!started) {
            this.switchToBanking(bot, runtime, area);
            return;
        }

        runtime.actionsRemaining--;
        if (Math.random() < 0.08) {
            bot.say(randomOf(runtime.activity.chats));
        }

        runtime.nextActionTick = this.world.currentTick + randomDelay(runtime.activity.actionTicks);
    }

    private finishActivity(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): void {
        bot.stopAction();
        runtime.activity = this.chooseActivity(bot, area);
        runtime.destination = this.destinationFor(runtime.activity, area);
        runtime.nextActionTick = this.world.currentTick + randomDelay(runtime.activity.actionTicks);
        runtime.actionsRemaining = randomDelay(runtime.activity.actionLoops ?? [2, 6]);
        this.resetRuntimeTracking(bot, runtime);
        bot.profile.activity = runtime.activity.id;
        bot.profile.goal = runtime.activity.label;
        this.retargetRuntime(bot, runtime, area);
    }

    private initializeBotScripts(bot: SimulatedPlayer): void {
        const updateAll = ScriptProvider.getByName('[proc,update_all]');
        if (updateAll) {
            bot.executeScript(ScriptRunner.init(updateAll, bot, null, [-1]), true);
        }
    }

    private canRunActivity(bot: SimulatedPlayer, activity: ActivityDefinition, area: AreaDefinition): boolean {
        if (area.id === 'air_altar' && activity.id !== 'runecraft' && activity.id !== 'travelling') {
            return false;
        }
        if (!Environment.node.members && ['fletching', 'thieving', 'agility', 'herblore'].includes(activity.id)) {
            return false;
        }

        if (activity.id === 'travelling' || activity.id === 'trading') {
            return true;
        }

        const supplies = ACTIVITY_SUPPLIES[activity.id];
        if (supplies && !Object.keys(supplies).every(item => this.totalOwned(bot, item) >= 1)) {
            return false;
        }

        if (['firemaking', 'fletching', 'prayer', 'crafting', 'herblore'].includes(activity.id)) {
            return true;
        }

        return this.findTarget(bot, activity, area) !== null;
    }

    private totalOwned(bot: SimulatedPlayer, name: string): number {
        const id = ObjType.getId(name);
        if (id === -1) {
            return 0;
        }

        return (bot.getInventory(InvType.INV)?.getItemCount(id) ?? 0) + (bot.getInventory(InvType.getId('bank'))?.getItemCount(id) ?? 0) + (bot.getInventory(InvType.WORN)?.getItemCount(id) ?? 0);
    }

    private hasInventorySupplies(bot: SimulatedPlayer, activity: ActivityDefinition): boolean {
        const supplies = ACTIVITY_SUPPLIES[activity.id];
        if (!supplies) {
            return true;
        }

        const inventory = bot.getInventory(InvType.INV);
        const worn = bot.getInventory(InvType.WORN);
        if (activity.id === 'herblore') {
            const vial = ObjType.getId('vial_water');
            const guam = ObjType.getId('guam_leaf');
            const guamVial = ObjType.getId('guamvial');
            const eye = ObjType.getId('eye_of_newt');
            return ((inventory?.getItemCount(vial) ?? 0) > 0 && (inventory?.getItemCount(guam) ?? 0) > 0) || ((inventory?.getItemCount(guamVial) ?? 0) > 0 && (inventory?.getItemCount(eye) ?? 0) > 0);
        }

        return Object.keys(supplies).every(name => {
            const id = ObjType.getId(name);
            if (id === -1) {
                return false;
            }
            const carried = inventory?.getItemCount(id) ?? 0;
            const equipped = BANK_KEEP_ITEMS.has(name) ? (worn?.getItemCount(id) ?? 0) : 0;
            return carried + equipped >= 1;
        });
    }

    private getLocCatalog(area: AreaDefinition): Loc[] {
        const cached = this.locCatalog.get(area.id);
        if (cached) {
            return cached;
        }

        const locs: Loc[] = [];
        const minZoneX = (area.center.x - area.radius) >> 3;
        const maxZoneX = (area.center.x + area.radius) >> 3;
        const minZoneZ = (area.center.z - area.radius) >> 3;
        const maxZoneZ = (area.center.z + area.radius) >> 3;
        for (let zoneX = minZoneX; zoneX <= maxZoneX; zoneX++) {
            for (let zoneZ = minZoneZ; zoneZ <= maxZoneZ; zoneZ++) {
                const zone = this.world.gameMap.getZone(zoneX << 3, zoneZ << 3, area.center.level);
                for (const loc of zone.getAllLocsUnsafe()) {
                    if (distance(loc, area.center) <= area.radius) {
                        locs.push(loc);
                    }
                }
            }
        }
        this.locCatalog.set(area.id, locs);
        return locs;
    }

    private getNpcCatalog(area: AreaDefinition): Npc[] {
        const cached = this.npcCatalog.get(area.id);
        if (cached) {
            return cached;
        }

        const npcs = new Set<Npc>();
        const minZoneX = (area.center.x - area.radius) >> 3;
        const maxZoneX = (area.center.x + area.radius) >> 3;
        const minZoneZ = (area.center.z - area.radius) >> 3;
        const maxZoneZ = (area.center.z + area.radius) >> 3;
        for (let zoneX = minZoneX; zoneX <= maxZoneX; zoneX++) {
            for (let zoneZ = minZoneZ; zoneZ <= maxZoneZ; zoneZ++) {
                const zone = this.world.gameMap.getZone(zoneX << 3, zoneZ << 3, area.center.level);
                for (const npc of zone.getAllNpcsUnsafe()) {
                    npcs.add(npc);
                }
            }
        }
        const catalog = [...npcs];
        this.npcCatalog.set(area.id, catalog);
        return catalog;
    }

    private getTargetAction(bot: SimulatedPlayer, activity: ActivityDefinition, target: Loc | Npc): { op: number; useItem: string | null } | null {
        if (!target.isValid(bot.hash64)) {
            return null;
        }

        if (target instanceof Loc) {
            const type = LocType.get(target.type);
            let op = -1;
            let useItem: string | null = null;
            switch (activity.id) {
                case 'woodcutting':
                    op = optionIndex(type.op, /^(chop down|cut)$/i);
                    break;
                case 'mining':
                    op = optionIndex(type.op, /^mine$/i);
                    break;
                case 'thieving':
                    op = optionIndex(type.op, /^steal-from$/i);
                    break;
                case 'agility': {
                    const name = `${type.debugname ?? ''} ${type.name ?? ''}`;
                    if (!/(obstacle|agility|balance|rope|net|pipe|ledge|climb|monkey|stepping|log)/i.test(name)) {
                        return null;
                    }
                    op = optionIndex(type.op, /^(climb|climb-over|cross|balance|swing-on|squeeze-through|jump|walk-across)$/i);
                    break;
                }
                case 'cooking': {
                    const name = `${type.debugname ?? ''} ${type.name ?? ''}`;
                    if (!/(range|stove|cooking|fire|oven)/i.test(name)) {
                        return null;
                    }
                    useItem = 'raw_shrimp';
                    break;
                }
                case 'smithing':
                    if (!/(anvil)/i.test(`${type.debugname ?? ''} ${type.name ?? ''}`)) {
                        return null;
                    }
                    useItem = 'bronze_bar';
                    break;
                case 'runecraft':
                    op = optionIndex(type.op, /^craft-rune$/i);
                    break;
                case 'banking':
                    op = optionIndex(type.op, /^bank$/i);
                    break;
                default:
                    return null;
            }

            if (useItem) {
                const hasTrigger = ScriptProvider.getByTrigger(ServerTriggerType.APLOCU, type.id, type.category) || ScriptProvider.getByTrigger(ServerTriggerType.OPLOCU, type.id, type.category);
                return hasTrigger ? { op: -1, useItem } : null;
            }
            if (op === -1) {
                return null;
            }
            const trigger = ServerTriggerType.APLOC1 + op;
            return ScriptProvider.getByTrigger(trigger, type.id, type.category) || ScriptProvider.getByTrigger(trigger + 7, type.id, type.category) ? { op, useItem: null } : null;
        }

        const type = NpcType.get(target.type);
        let op = -1;
        switch (activity.id) {
            case 'fishing':
                op = optionIndex(type.op, /^(net|bait|lure|harpoon|cage)$/i);
                break;
            case 'combat':
                if (type.vislevel > Math.max(20, bot.combatLevel + 15)) {
                    return null;
                }
                op = optionIndex(type.op, /^attack$/i);
                break;
            case 'thieving':
                op = optionIndex(type.op, /^pickpocket$/i);
                break;
            case 'questing':
                op = optionIndex(type.op, /^talk-to$/i);
                break;
            case 'banking':
                op = optionIndex(type.op, /^bank$/i);
                break;
            default:
                return null;
        }
        if (op === -1) {
            return null;
        }
        const trigger = ServerTriggerType.APNPC1 + op;
        return ScriptProvider.getByTrigger(trigger, type.id, type.category) || ScriptProvider.getByTrigger(trigger + 7, type.id, type.category) ? { op, useItem: null } : null;
    }

    private findTarget(bot: SimulatedPlayer, activity: ActivityDefinition, area: AreaDefinition): Loc | Npc | null {
        const candidates: (Loc | Npc)[] = [];
        for (const loc of this.getLocCatalog(area)) {
            if (this.getTargetAction(bot, activity, loc)) {
                candidates.push(loc);
            }
        }
        for (const npc of this.getNpcCatalog(area)) {
            if (distance(npc, area.center) <= area.radius && this.getTargetAction(bot, activity, npc)) {
                candidates.push(npc);
            }
        }

        if (activity.id === 'banking') {
            const localBanks = candidates.filter(candidate => distance(candidate, area.bank) <= 48);
            localBanks.sort((a, b) => distance(area.bank, a) - distance(area.bank, b));
            const nearbyBanks = localBanks.slice(0, Math.min(8, localBanks.length));
            return nearbyBanks.length > 0 ? randomOf(nearbyBanks) : null;
        }

        candidates.sort((a, b) => distance(bot, a) - distance(bot, b));
        const nearby = candidates.slice(0, Math.min(16, candidates.length));
        return nearby.length > 0 ? randomOf(nearby) : null;
    }

    private targetMatches(bot: SimulatedPlayer, activity: ActivityDefinition, target: Loc | Npc): boolean {
        return this.getTargetAction(bot, activity, target) !== null;
    }

    private retargetRuntime(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): void {
        runtime.target = null;
        runtime.op = -1;
        runtime.useItem = null;
        runtime.partnerId = null;

        if (runtime.activity.id === 'travelling') {
            runtime.destination = this.destinationFor(runtime.activity, area);
            return;
        }

        if (runtime.activity.id === 'trading') {
            const partner = this.findTradePartner(bot, area);
            runtime.partnerId = partner?.profile.id ?? null;
            runtime.destination = partner ? { level: partner.level, x: partner.x, z: partner.z } : area.bank;
            return;
        }

        if (['firemaking', 'prayer'].includes(runtime.activity.id)) {
            runtime.destination = this.destinationFor(runtime.activity, area);
            return;
        }

        if (['fletching', 'crafting', 'herblore'].includes(runtime.activity.id)) {
            const banker = this.findTarget(bot, BANKING_ACTIVITY, area);
            runtime.destination = banker ? this.walkableTileNear(banker, area) : this.destinationFor(runtime.activity, area);
            return;
        }

        const target = this.findTarget(bot, runtime.activity, area);
        if (!target) {
            runtime.destination = this.destinationFor(runtime.activity, area);
            return;
        }

        const action = this.getTargetAction(bot, runtime.activity, target);
        if (!action) {
            return;
        }
        runtime.target = target;
        runtime.op = action.op;
        runtime.useItem = action.useItem;
        runtime.destination = { level: target.level, x: target.x, z: target.z };
    }

    private walkableTileNear(target: Loc | Npc, area: AreaDefinition): Coord {
        const candidates: Coord[] = [
            { level: target.level, x: target.x - 1, z: target.z },
            { level: target.level, x: target.x + target.width, z: target.z },
            { level: target.level, x: target.x, z: target.z - 1 },
            { level: target.level, x: target.x, z: target.z + target.length }
        ];
        return candidates.find(candidate => this.isUsableDestination(candidate, area)) ?? area.bank;
    }

    private startTargetInteraction(bot: SimulatedPlayer, runtime: BotRuntime): boolean {
        const target = runtime.target;
        if (!target) {
            return false;
        }

        let trigger: ServerTriggerType;
        if (target instanceof Loc) {
            if (runtime.useItem) {
                const id = ObjType.getId(runtime.useItem);
                const slot = bot.getInventory(InvType.INV)?.getItemIndex(id) ?? -1;
                if (id === -1 || slot === -1) {
                    return false;
                }
                bot.lastUseItem = id;
                bot.lastUseSlot = slot;
                trigger = ServerTriggerType.APLOCU;
            } else {
                trigger = ServerTriggerType.APLOC1 + runtime.op;
            }
        } else {
            trigger = ServerTriggerType.APNPC1 + runtime.op;
        }

        bot.clearPendingAction();
        return bot.setInteraction(Interaction.ENGINE, target, trigger);
    }

    private handleBotDialog(bot: SimulatedPlayer): boolean {
        const script = bot.activeScript;
        if (!script) {
            return false;
        }

        if (script.execution === ScriptState.PAUSEBUTTON && bot.resumeButtons.length > 0) {
            bot.lastCom = randomOf(bot.resumeButtons);
            bot.executeScript(script, true, true);
            return true;
        }
        if (script.execution === ScriptState.COUNTDIALOG) {
            script.lastInt = randomDelay([5, 12]);
            bot.executeScript(script, true, true);
            return true;
        }
        return false;
    }

    private handleSkillInterface(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): boolean {
        let component = -1;
        let trigger: ServerTriggerType;
        if (runtime.activity.id === 'crafting') {
            component = Component.getId('leather_crafting:com_115');
            trigger = ServerTriggerType.IF_BUTTON;
        } else if (runtime.activity.id === 'smithing') {
            component = Component.getId('smithing:column1');
            trigger = ServerTriggerType.INV_BUTTON2;
            bot.lastItem = ObjType.getId('bronze_dagger');
            bot.lastSlot = 0;
        } else {
            return false;
        }

        const script = component === -1 ? undefined : ScriptProvider.getByTriggerSpecific(trigger, component, -1);
        if (!script) {
            bot.closeModal();
            this.finishActivity(bot, runtime, area);
            return true;
        }

        bot.lastCom = component;
        bot.executeScript(ScriptRunner.init(script, bot), true);
        return true;
    }

    private findTradePartner(bot: SimulatedPlayer, area: AreaDefinition): SimulatedPlayer | null {
        const candidates: SimulatedPlayer[] = [];
        for (const candidate of this.active.values()) {
            if (candidate === bot || !candidate.isActive || candidate.level !== bot.level) {
                continue;
            }
            if (this.runtime.get(candidate.profile.id)?.areaId !== area.id) {
                continue;
            }
            if (distance(candidate, area.bank) <= 32 || distance(candidate, bot) <= 24) {
                candidates.push(candidate);
            }
        }
        candidates.sort((a, b) => distance(bot, a) - distance(bot, b));
        const nearby = candidates.slice(0, Math.min(12, candidates.length));
        return nearby.length > 0 ? randomOf(nearby) : null;
    }

    private performTrade(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): boolean {
        let partner = runtime.partnerId ? (this.active.get(runtime.partnerId) ?? null) : null;
        if (!partner?.isActive || this.runtime.get(partner.profile.id)?.areaId !== area.id) {
            partner = this.findTradePartner(bot, area);
            runtime.partnerId = partner?.profile.id ?? null;
        }

        if (!partner) {
            bot.say(randomOf(['Buying supplies!', 'Selling skilling loot!', 'Anyone trading here?']));
            return true;
        }

        if (distance(bot, partner) > 3) {
            runtime.destination = { level: partner.level, x: partner.x, z: partner.z };
            this.queuePathTo(bot, runtime.destination);
            return true;
        }

        bot.faceSquare(partner.x, partner.z);
        partner.faceSquare(bot.x, bot.z);

        const sellerFirst = Math.random() < 0.5;
        const trade = this.tradeItem(sellerFirst ? bot : partner, sellerFirst ? partner : bot) ?? this.tradeItem(sellerFirst ? partner : bot, sellerFirst ? bot : partner);
        if (!trade) {
            bot.say(randomOf(['Nothing I need right now.', 'Maybe after another bank trip.', 'Just price checking.']));
            return true;
        }

        bot.profile.goal = `Trading with ${partner.displayName}`;
        partner.profile.goal = `Trading with ${bot.displayName}`;
        bot.say(`${trade.count} ${trade.name} for ${trade.coins} coins?`);
        if (Math.random() < 0.6) {
            partner.say(randomOf(['Deal.', 'Thanks!', 'That works for me.']));
        }
        return true;
    }

    private tradeItem(seller: SimulatedPlayer, buyer: SimulatedPlayer): { name: string; count: number; coins: number } | null {
        const bankType = InvType.getId('bank');
        const sellerBank = seller.getInventory(bankType);
        const buyerBank = buyer.getInventory(bankType);
        const coinsId = ObjType.getId('coins');
        if (!sellerBank || !buyerBank || coinsId === -1) {
            return null;
        }

        const goods = sellerBank.itemsFiltered.filter(item => {
            const type = ObjType.get(item.id);
            return item.id !== coinsId && type.tradeable && type.certtemplate === -1 && Boolean(type.debugname) && !BANK_KEEP_ITEMS.has(type.debugname!);
        });
        if (goods.length === 0) {
            return null;
        }

        const item = randomOf(goods);
        const type = ObjType.get(item.id);
        const unitPrice = Math.max(1, Math.min(10_000, type.cost));
        const affordable = Math.trunc(buyerBank.getItemCount(coinsId) / unitPrice);
        const count = Math.min(item.count, affordable, randomDelay([1, 5]));
        if (count < 1) {
            return null;
        }

        const total = count * unitPrice;
        const removedCoins = buyerBank.remove(coinsId, total);
        if (removedCoins !== total) {
            buyerBank.add(coinsId, removedCoins);
            return null;
        }

        const removedItems = sellerBank.remove(item.id, count);
        if (removedItems !== count) {
            sellerBank.add(item.id, removedItems);
            buyerBank.add(coinsId, total);
            return null;
        }

        const addedItems = buyerBank.add(item.id, count);
        const addedCoins = sellerBank.add(coinsId, total);
        if (addedItems !== count || addedCoins !== total) {
            buyerBank.remove(item.id, addedItems);
            sellerBank.remove(coinsId, addedCoins);
            sellerBank.add(item.id, count);
            buyerBank.add(coinsId, total);
            return null;
        }

        return { name: type.name ?? type.debugname ?? 'items', count, coins: total };
    }

    private runHeldOption(bot: SimulatedPlayer, name: string, op: number): boolean {
        const id = ObjType.getId(name);
        const slot = bot.getInventory(InvType.INV)?.getItemIndex(id) ?? -1;
        if (id === -1 || slot === -1) {
            return false;
        }

        const type = ObjType.get(id);
        const script = ScriptProvider.getByTrigger(ServerTriggerType.OPHELD1 + op, type.id, type.category);
        if (!script) {
            return false;
        }
        bot.lastItem = id;
        bot.lastSlot = slot;
        bot.clearPendingAction();
        bot.executeScript(ScriptRunner.init(script, bot), true);
        return true;
    }

    private runInventoryUse(bot: SimulatedPlayer, targetName: string, useName: string): boolean {
        const inventory = bot.getInventory(InvType.INV);
        const targetId = ObjType.getId(targetName);
        const useId = ObjType.getId(useName);
        const targetSlot = inventory?.getItemIndex(targetId) ?? -1;
        const useSlot = inventory?.getItemIndex(useId) ?? -1;
        if (targetId === -1 || useId === -1 || targetSlot === -1 || useSlot === -1) {
            return false;
        }

        bot.lastItem = targetId;
        bot.lastSlot = targetSlot;
        bot.lastUseItem = useId;
        bot.lastUseSlot = useSlot;

        const targetType = ObjType.get(targetId);
        const useType = ObjType.get(useId);
        let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, targetType.id, -1);
        if (!script) {
            script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, useType.id, -1);
            [bot.lastItem, bot.lastUseItem] = [bot.lastUseItem, bot.lastItem];
            [bot.lastSlot, bot.lastUseSlot] = [bot.lastUseSlot, bot.lastSlot];
        }
        if (!script && targetType.category !== -1 && CategoryType.get(targetType.category)) {
            script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, targetType.category);
        }
        if (!script && useType.category !== -1 && CategoryType.get(useType.category)) {
            script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, useType.category);
            [bot.lastItem, bot.lastUseItem] = [bot.lastUseItem, bot.lastItem];
            [bot.lastSlot, bot.lastUseSlot] = [bot.lastUseSlot, bot.lastSlot];
        }
        if (!script) {
            return false;
        }

        bot.clearPendingAction();
        bot.executeScript(ScriptRunner.init(script, bot), true);
        return true;
    }

    private switchToBanking(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): void {
        bot.stopAction();
        runtime.activity = BANKING_ACTIVITY;
        runtime.destination = this.destinationFor(BANKING_ACTIVITY, area);
        runtime.nextActionTick = this.world.currentTick + 2;
        runtime.actionsRemaining = 1;
        bot.profile.activity = 'banking';
        bot.profile.goal = BANKING_ACTIVITY.label;
        this.retargetRuntime(bot, runtime, area);
    }

    private performBanking(bot: SimulatedPlayer, runtime: BotRuntime, area: AreaDefinition): void {
        const inventory = bot.getInventory(InvType.INV);
        const bank = bot.getInventory(InvType.getId('bank'));
        if (!inventory || !bank) {
            this.finishActivity(bot, runtime, area);
            return;
        }

        for (let slot = 0; slot < inventory.capacity; slot++) {
            const item = inventory.get(slot);
            if (!item) {
                continue;
            }
            const moved = bank.add(item.id, item.count);
            if (moved >= item.count) {
                inventory.delete(slot);
            } else if (moved > 0) {
                inventory.set(slot, { id: item.id, count: item.count - moved });
            }
        }

        bot.closeModal();
        this.finishActivity(bot, runtime, area);
        this.withdrawSupplies(bot, runtime.activity);
        if (Math.random() < 0.35) {
            bot.say(randomOf(BANKING_ACTIVITY.chats));
        }
    }

    private withdrawSupplies(bot: SimulatedPlayer, activity: ActivityDefinition): void {
        const supplies = ACTIVITY_SUPPLIES[activity.id];
        const inventory = bot.getInventory(InvType.INV);
        const bank = bot.getInventory(InvType.getId('bank'));
        if (!supplies || !inventory || !bank) {
            return;
        }

        for (const [name, desired] of Object.entries(supplies)) {
            const id = ObjType.getId(name);
            if (id === -1) {
                continue;
            }
            const missing = Math.max(0, desired - inventory.getItemCount(id) - (BANK_KEEP_ITEMS.has(name) ? (bot.getInventory(InvType.WORN)?.getItemCount(id) ?? 0) : 0));
            const available = Math.min(missing, bank.getItemCount(id));
            const moved = inventory.add(id, available);
            if (moved > 0) {
                bank.remove(id, moved);
            }
        }
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
