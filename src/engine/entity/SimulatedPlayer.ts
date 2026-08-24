import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import SeqType from '#/cache/config/SeqType.js';
import { BlockWalk } from '#/engine/entity/BlockWalk.js';
import { MoveStrategy } from '#/engine/entity/MoveStrategy.js';
import Player, { getLevelByExp } from '#/engine/entity/Player.js';
import { ChatModePrivate, ChatModeTradeDuel } from '#/engine/entity/ChatModes.js';
import { BotProfile } from '#/engine/living/BotProfileStore.js';
import { WealthEventParams } from '#/engine/entity/tracking/WealthEvent.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import { toBase37 } from '#/util/JString.js';

const BASE_ANIMS = {
    ready: 'human_ready',
    turn: 'human_turnonspot',
    walk: 'human_walk_f',
    walkBack: 'human_walk_b',
    walkLeft: 'human_walk_l',
    walkRight: 'human_walk_r',
    run: 'human_running'
};

function seq(name: string): number {
    return SeqType.getId(name);
}

export default class SimulatedPlayer extends Player {
    readonly isBot = true;
    readonly profile: BotProfile;

    constructor(profile: BotProfile) {
        const username37 = toBase37(profile.username);
        super(profile.username, username37, username37);

        this.profile = profile;
        this.session = `bot:${profile.id}`;
        this.blockWalk = BlockWalk.NONE;
        this.moveStrategy = MoveStrategy.SMART;
        this.privateChat = ChatModePrivate.OFF;
        this.tradeDuel = ChatModeTradeDuel.OFF;
        this.x = profile.x;
        this.z = profile.z;
        this.level = profile.level;
        this.gender = profile.gender;
        this.body = [...profile.body];
        this.colors = [...profile.colors];
        this.applyProfileWorn();
        this.applyProfileInventory(InvType.INV, profile.inventory);
        this.applyProfileInventory(InvType.getId('bank'), profile.bank);

        for (let i = 0; i < this.stats.length; i++) {
            this.stats[i] = profile.stats[i] ?? 0;
            this.baseLevels[i] = getLevelByExp(this.stats[i]);
            this.levels[i] = profile.levels[i] ?? this.baseLevels[i];
        }

        this.combatLevel = this.getCombatLevel();
        this.applyHumanBaseAnimations();
    }

    private applyProfileInventory(invType: number, store: Record<string, number>): void {
        const inventory = this.getInventory(invType);
        if (!inventory) {
            return;
        }

        inventory.removeAll();
        for (const [name, count] of Object.entries(store)) {
            const id = ObjType.getId(name);
            if (id !== -1 && count > 0) {
                inventory.add(id, Math.trunc(count));
            }
        }
    }

    private syncProfileInventory(invType: number): Record<string, number> {
        const store: Record<string, number> = {};
        const inventory = this.getInventory(invType);
        if (!inventory) {
            return store;
        }

        for (const item of inventory.itemsFiltered) {
            const name = ObjType.get(item.id).debugname;
            if (name) {
                store[name] = (store[name] ?? 0) + item.count;
            }
        }
        return store;
    }

    private applyProfileWorn(): void {
        const worn = this.getInventory(InvType.WORN);
        if (!worn) {
            return;
        }

        worn.removeAll();

        for (const name of this.profile.worn) {
            const id = ObjType.getId(name);
            if (id === -1) {
                continue;
            }

            const config = ObjType.get(id);
            if (config.wearpos === -1) {
                continue;
            }

            worn.set(config.wearpos, { id, count: 1 });
        }
    }

    applyHumanBaseAnimations(): void {
        this.readyanim = seq(BASE_ANIMS.ready);
        this.turnanim = seq(BASE_ANIMS.turn);
        this.walkanim = seq(BASE_ANIMS.walk);
        this.walkanim_b = seq(BASE_ANIMS.walkBack);
        this.walkanim_l = seq(BASE_ANIMS.walkLeft);
        this.walkanim_r = seq(BASE_ANIMS.walkRight);
        this.runanim = seq(BASE_ANIMS.run);
        this.buildAppearance(InvType.WORN);
    }

    addSimulatedXp(stat: number, xp: number): boolean {
        if (xp <= 0) {
            return false;
        }

        const previousLevel = this.baseLevels[stat] ?? 1;
        this.stats[stat] = Math.min((this.stats[stat] ?? 0) + xp, 2000000000);

        const nextLevel = getLevelByExp(this.stats[stat]);
        this.baseLevels[stat] = nextLevel;
        this.levels[stat] = nextLevel;

        const nextCombatLevel = this.getCombatLevel();
        if (this.combatLevel !== nextCombatLevel) {
            this.combatLevel = nextCombatLevel;
            this.buildAppearance(InvType.WORN);
        }

        return nextLevel > previousLevel;
    }

    touch(tick: number): void {
        this.lastConnected = tick;
        this.lastResponse = tick;
        this.profile.ticksActive++;
        this.profile.lastSeenTick = tick;
    }

    syncProfile(tick: number): void {
        this.profile.x = this.x;
        this.profile.z = this.z;
        this.profile.level = this.level;
        this.profile.gender = this.gender;
        this.profile.body = [...this.body];
        this.profile.colors = [...this.colors];
        this.profile.stats = Array.from(this.stats);
        this.profile.levels = Array.from(this.levels);
        this.profile.inventory = this.syncProfileInventory(InvType.INV);
        this.profile.bank = this.syncProfileInventory(InvType.getId('bank'));
        this.profile.lastSeenTick = tick;
    }

    override addSessionLog(_event_type: LoggerEventType, _message: string, ..._args: string[]): void {
        // Bot progress is persisted to the bot profile store, not the player session logger.
    }

    override addWealthEvent(_event: WealthEventParams): void {
        // Bot inventories are simulated separately from the real economy in v1.
    }
}

export function isSimulatedPlayer(player: Player | null | undefined): player is SimulatedPlayer {
    return player instanceof SimulatedPlayer || Boolean((player as { isBot?: boolean } | null | undefined)?.isBot);
}
