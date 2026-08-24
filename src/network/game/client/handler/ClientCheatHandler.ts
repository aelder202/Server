import v8 from 'node:v8';

import { Visibility } from '#/network/rsbuf/index.js';
import { LocAngle, LocShape } from '#/engine/routefinder/index.js';

import Component from '#/cache/config/Component.js';
import IdkType from '#/cache/config/IdkType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

import { CoordGrid } from '#/engine/CoordGrid.js';
import World from '#/engine/World.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Loc from '#/engine/entity/Loc.js';
import { MoveStrategy } from '#/engine/entity/MoveStrategy.js';
import { isClientConnected } from '#/engine/entity/NetworkPlayer.js';
import Npc from '#/engine/entity/Npc.js';
import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import { PlayerStat, PlayerStatEnabled, PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { bankMarketService } from '#/engine/market/BankMarketService.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';

import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

import { LoggerEventType } from '#/server/logger/LoggerEventType.js';

import Environment from '#/util/Environment.js';
import { printDebug } from '#/util/Logger.js';
import { tryParseInt } from '#/util/TryParse.js';

type TeleportFavorite = {
    name: string;
    level: number;
    x: number;
    z: number;
};

const NORMAL_WORLD_TICKRATE = 600;

const TELEPORT_FAVORITES: Record<string, TeleportFavorite> = {
    home: { name: 'Lumbridge', level: 0, x: (50 << 6) + 22, z: (50 << 6) + 22 },
    lumby: { name: 'Lumbridge', level: 0, x: (50 << 6) + 22, z: (50 << 6) + 22 },
    lumbridge: { name: 'Lumbridge', level: 0, x: (50 << 6) + 22, z: (50 << 6) + 22 },
    varrock: { name: 'Varrock', level: 0, x: (50 << 6) + 13, z: (53 << 6) + 31 },
    fally: { name: 'Falador', level: 0, x: (46 << 6) + 21, z: (52 << 6) + 51 },
    falador: { name: 'Falador', level: 0, x: (46 << 6) + 21, z: (52 << 6) + 51 },
    draynor: { name: 'Draynor Village', level: 0, x: (48 << 6) + 8, z: (50 << 6) + 50 },
    portsarim: { name: 'Port Sarim', level: 0, x: (47 << 6) + 19, z: (50 << 6) + 25 },
    rimmington: { name: 'Rimmington', level: 0, x: (46 << 6) + 12, z: (50 << 6) + 10 },
    alkharid: { name: 'Al Kharid', level: 0, x: (51 << 6) + 28, z: (49 << 6) + 47 },
    seers: { name: "Seers' Village", level: 0, x: (42 << 6) + 44, z: (54 << 6) + 29 },
    camelot: { name: 'Camelot', level: 0, x: (43 << 6) + 28, z: (54 << 6) + 59 },
    ardy: { name: 'Ardougne', level: 0, x: (41 << 6) + 39, z: (51 << 6) + 38 },
    ardougne: { name: 'Ardougne', level: 0, x: (41 << 6) + 39, z: (51 << 6) + 38 },
    entrana: { name: 'Entrana', level: 0, x: (44 << 6) + 11, z: (52 << 6) + 16 },
    brimhaven: { name: 'Brimhaven', level: 0, x: (43 << 6) + 50, z: (49 << 6) + 41 },
    duel: { name: 'Duel Arena', level: 0, x: (52 << 6) + 42, z: (51 << 6) + 4 },
    pvp: { name: 'Wilderness', level: 0, x: (52 << 6) + 37, z: (60 << 6) + 37 }
};

const TELEPORT_FAVORITE_NAMES = [...new Set(Object.values(TELEPORT_FAVORITES).map(favorite => favorite.name))].join(', ');

function teleportToFavorite(player: Player, favorite: TeleportFavorite): boolean {
    player.closeModal();

    if (!player.canAccess()) {
        player.messageGame('Please finish what you are doing first.');
        return false;
    }

    player.clearInteraction();
    player.unsetMapFlag();
    player.teleJump(favorite.x, favorite.z, favorite.level);
    player.messageGame(`Teleported to ${favorite.name}.`);
    return true;
}

export default class ClientCheatHandler extends ClientGameMessageHandler<ClientCheat> {
    handle(message: ClientCheat, player: Player): boolean {
        if (message.input.length > 80) {
            return false;
        }

        const { input: cheat } = message;

        const args: string[] = cheat.toLowerCase().split(' ');
        const cmd: string | undefined = args.shift();
        if (cmd === undefined || cmd.length <= 0) {
            return false;
        }

        // The bank market is available to every account and intentionally sits
        // outside the staff command gates. Its commands are sent by the client UI.
        if (bankMarketService.handleCommand(player, cmd, args)) {
            return true;
        }

        // Keep the safe Lumbridge return available to regular players. Other
        // teleport favorites remain staff-only below.
        if (cmd === 'home' || cmd === 'lumby' || cmd === 'lumbridge') {
            return teleportToFavorite(player, TELEPORT_FAVORITES[cmd]);
        }

        if (player.staffModLevel >= 2) {
            player.addSessionLog(LoggerEventType.MODERATOR, 'Ran cheat', cheat);
        }

        if (!Environment.node.production && player.staffModLevel >= 4) {
            // developer commands

            if (cmd[0] === Environment.node.debugProcChar) {
                // debugprocs are NOT allowed on live ;)
                const script = ScriptProvider.getByName(`[debugproc,${cmd.slice(1)}]`);
                if (!script) {
                    return false;
                }

                const params = new Array(script.info.parameterTypes.length).fill(-1);
                for (let i = 0; i < script.info.parameterTypes.length; i++) {
                    const type = script.info.parameterTypes[i];

                    try {
                        switch (type) {
                            case ScriptVarType.STRING: {
                                const value = args.shift();
                                params[i] = value ?? '';
                                break;
                            }
                            case ScriptVarType.INT: {
                                const value = args.shift();
                                params[i] = parseInt(value ?? '0', 10) | 0;
                                break;
                            }
                            case ScriptVarType.OBJ:
                            case ScriptVarType.NAMEDOBJ: {
                                const name = args.shift();
                                params[i] = ObjType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.NPC: {
                                const name = args.shift();
                                params[i] = NpcType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.LOC: {
                                const name = args.shift();
                                params[i] = LocType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.SEQ: {
                                const name = args.shift();
                                params[i] = SeqType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.STAT: {
                                const name = args.shift() ?? '';
                                params[i] = PlayerStatMap.get(name.toUpperCase());
                                break;
                            }
                            case ScriptVarType.INV: {
                                const name = args.shift();
                                params[i] = InvType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.COORD: {
                                const args2 = cheat.split('_');

                                const level = parseInt(args2[0].slice(6));
                                const mx = parseInt(args2[1]);
                                const mz = parseInt(args2[2]);
                                const lx = parseInt(args2[3]);
                                const lz = parseInt(args2[4]);

                                params[i] = CoordGrid.packCoord(level, (mx << 6) + lx, (mz << 6) + lz);
                                break;
                            }
                            case ScriptVarType.INTERFACE: {
                                const name = args.shift();
                                params[i] = Component.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.SPOTANIM: {
                                const name = args.shift();
                                params[i] = SpotanimType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.IDKIT: {
                                const name = args.shift();
                                params[i] = IdkType.getId(name ?? '');
                                break;
                            }
                        }
                    } catch (_) {
                        // invalid arguments
                        return false;
                    }
                }

                player.executeScript(ScriptRunner.init(script, player, null, params), false);
            } else if (cmd === 'reload') {
                World.reload();
            } else if (cmd === 'rebuild') {
                player.messageGame('Rebuilding scripts...');
                World.rebuild();
            } else if (cmd === 'speed') {
                if (args.length < 1) {
                    player.messageGame('Usage: ::speed <ms>');
                    return false;
                }

                const speed: number = tryParseInt(args.shift(), 20);
                if (speed < 20) {
                    player.messageGame('::speed input was too low.');
                    return false;
                }

                player.messageGame(`World speed was changed to ${speed}ms`);
                World.tickRate = speed;
            } else if (cmd === 'fly') {
                if (player.moveStrategy === MoveStrategy.FLY) {
                    player.moveStrategy = MoveStrategy.SMART;
                } else {
                    player.moveStrategy = MoveStrategy.FLY;
                }

                player.messageGame(`Changed move strategy: ${player.moveStrategy === MoveStrategy.FLY ? 'fly' : 'smart'}`);
            } else if (cmd === 'naive') {
                if (player.moveStrategy === MoveStrategy.NAIVE) {
                    player.moveStrategy = MoveStrategy.SMART;
                } else {
                    player.moveStrategy = MoveStrategy.NAIVE;
                }

                player.messageGame(`Naive move strategy: ${player.moveStrategy === MoveStrategy.NAIVE ? 'naive' : 'smart'}`);
            } else if (cmd === 'random') {
                player.afkEventReady = true;
            }
        }

        if (player.staffModLevel >= 3) {
            // admin commands (potentially destructive for a live economy)

            if (cmd === 'xprate') {
                if (args.length < 1) {
                    player.messageGame(`Current XP rate is ${Environment.node.xpRate}x. Usage: ::xprate <rate>`);
                    return true;
                }

                const rate = tryParseInt(args[0], -1);
                if (rate < 1 || rate > 1000) {
                    player.messageGame('Usage: ::xprate <rate> where rate is 1-1000.');
                    return false;
                }

                Environment.node.xpRate = rate;
                World.broadcastMes(`XP rate has been changed to ${rate}x.`);
            } else if (cmd === 'infstock') {
                if (args.length === 0 || args[0] === 'status') {
                    player.messageGame(`Infinite shop stock is ${World.infiniteShopStock ? 'enabled' : 'disabled'}. Usage: ::infstock [on|off|status]`);
                    return true;
                }
                if (args.length !== 1 || (args[0] !== 'on' && args[0] !== 'off')) {
                    player.messageGame('Usage: ::infstock [on|off|status]');
                    return false;
                }

                World.infiniteShopStock = args[0] === 'on';
                World.broadcastMes(`Infinite shop stock has been ${World.infiniteShopStock ? 'enabled' : 'disabled'}.`);
            } else if (cmd === 'thievloot') {
                if (args.length === 0 || args[0] === 'status') {
                    player.messageGame(`Multiplied thieving loot is ${World.multipliedThievingLoot ? 'enabled' : 'disabled'} (${Environment.node.xpRate}x). Usage: ::thievloot [on|off|status]`);
                    return true;
                }
                if (args.length !== 1 || (args[0] !== 'on' && args[0] !== 'off')) {
                    player.messageGame('Usage: ::thievloot [on|off|status]');
                    return false;
                }

                World.multipliedThievingLoot = args[0] === 'on';
                World.broadcastMes(`Multiplied thieving loot has been ${World.multipliedThievingLoot ? 'enabled' : 'disabled'} (${Environment.node.xpRate}x).`);
            } else if (cmd === 'life' || cmd === 'livingworld') {
                if (args.length === 0 || args[0] === 'status') {
                    player.messageGame(World.lifeDirector.getStatus());
                    return true;
                }
                if (args[0] !== 'on' && args[0] !== 'off') {
                    player.messageGame('Usage: ::life [on|off|status]');
                    return false;
                }
                World.lifeDirector.setEnabled(args[0] === 'on');
                player.messageGame(World.lifeDirector.getStatus());
            } else if (cmd === 'botcount') {
                if (args.length < 1) {
                    player.messageGame(`${World.lifeDirector.getStatus()} Usage: ::botcount <0-1000>`);
                    return true;
                }
                const maxBots = tryParseInt(args[0], -1);
                if (maxBots < 0 || maxBots > 1000) {
                    player.messageGame('Usage: ::botcount <0-1000>');
                    return false;
                }
                World.lifeDirector.setMaxBots(maxBots);
                player.messageGame(`Living-world population target set to ${maxBots}.`);
            } else if (cmd === 'infrun' || cmd === 'infiniterun') {
                if (args.length > 0 && args[0] !== 'on' && args[0] !== 'off') {
                    player.messageGame('Usage: ::infrun [on|off].');
                    return false;
                }

                player.infiniteRunEnergy = args.length > 0 ? args[0] === 'on' : !player.infiniteRunEnergy;
                if (player.infiniteRunEnergy) {
                    player.runenergy = 10000;
                    player.lastRunEnergy = -1;
                }
                player.messageGame(`Infinite run energy ${player.infiniteRunEnergy ? 'enabled' : 'disabled'}.`);
            } else if (cmd === 'god' || cmd === 'godmode') {
                if (args.length > 0 && args[0] !== 'on' && args[0] !== 'off') {
                    player.messageGame('Usage: ::god [on|off].');
                    return false;
                }

                player.godMode = args.length > 0 ? args[0] === 'on' : !player.godMode;
                if (player.godMode) {
                    player.levels[PlayerStat.HITPOINTS] = player.baseLevels[PlayerStat.HITPOINTS];
                }
                player.messageGame(`God mode ${player.godMode ? 'enabled' : 'disabled'}.`);
            } else if (cmd === 'runspeed') {
                if (args.length < 1) {
                    if (World.tickRate === NORMAL_WORLD_TICKRATE) {
                        World.tickRate = NORMAL_WORLD_TICKRATE / 2;
                    } else {
                        World.tickRate = NORMAL_WORLD_TICKRATE;
                    }
                } else if (args[0] === 'off' || args[0] === 'normal') {
                    World.tickRate = NORMAL_WORLD_TICKRATE;
                } else {
                    const multiplier = tryParseInt(args[0], -1);
                    if (multiplier < 1 || multiplier > 10) {
                        player.messageGame('Usage: ::runspeed [multiplier|off] where multiplier is 1-10.');
                        return false;
                    }

                    World.tickRate = Math.max(20, (NORMAL_WORLD_TICKRATE / multiplier) | 0);
                }

                player.messageGame(`Run speed is now ${(NORMAL_WORLD_TICKRATE / World.tickRate).toFixed(1)}x.`);
            } else if (cmd === 'setvar') {
                // authentic
                if (args.length < 2) {
                    // ::setvar <variable> <value>
                    // Sets variable to specified value
                    return false;
                }

                const debugname = args[0];
                const value = Math.max(-0x80000000, Math.min(tryParseInt(args[1], 0), 0x7fffffff));

                let varp: VarPlayerType | null = null;
                const varbit = VarBitType.getByName(debugname);
                if (varbit) {
                    varp = VarPlayerType.get(varbit.basevar);

                    if (varp.protect) {
                        player.closeModal();

                        if (!player.canAccess()) {
                            player.messageGame('Please finish what you are doing first.');
                            return false;
                        }

                        player.clearInteraction();
                        player.unsetMapFlag();
                    }
                } else {
                    varp = VarPlayerType.getByName(debugname);
                }

                if (!varp) {
                    return false;
                }

                if (varp.protect) {
                    player.closeModal();

                    if (!player.canAccess()) {
                        player.messageGame('Please finish what you are doing first.');
                        return false;
                    }

                    player.clearInteraction();
                    player.unsetMapFlag();
                }

                if (varbit) {
                    player.setVarBit(varbit.id, value);
                    player.messageGame('set ' + varbit.debugname + ': to ' + value);
                } else {
                    player.setVar(varp.id, value);
                    player.messageGame('set ' + varp.debugname + ': to ' + value);
                }
            } else if (cmd === 'setvarother' && Environment.node.production) {
                // custom
                if (args.length < 3) {
                    // ::setvarother <username> <name> <value>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const varp = VarPlayerType.getByName(args[1]);
                if (!varp) {
                    return false;
                }

                if (varp.protect) {
                    other.closeModal();

                    if (!other.canAccess()) {
                        player.messageGame(`${args[0]} is busy right now.`);
                        return false;
                    }

                    other.clearInteraction();
                    other.unsetMapFlag();
                }

                const value = Math.max(-0x80000000, Math.min(tryParseInt(args[2], 0), 0x7fffffff));
                other.setVar(varp.id, value);
                player.messageGame('set ' + args[1] + ': to ' + value + ' on ' + other.username);
            } else if (cmd === 'getvar') {
                // authentic
                if (args.length < 1) {
                    // ::getvar <variable>
                    // Displays value of specified variable
                    return false;
                }

                const debugname = args[0];

                let varp: VarPlayerType | null = null;
                const varbit = VarBitType.getByName(debugname);
                if (varbit) {
                    varp = VarPlayerType.get(varbit.basevar);

                    if (varp.protect) {
                        player.closeModal();

                        if (!player.canAccess()) {
                            player.messageGame('Please finish what you are doing first.');
                            return false;
                        }

                        player.clearInteraction();
                        player.unsetMapFlag();
                    }
                } else {
                    varp = VarPlayerType.getByName(debugname);
                }

                if (!varp) {
                    return false;
                }

                if (varbit) {
                    const value = player.getVarBit(varbit.id);
                    player.messageGame('get ' + varbit.debugname + ': ' + value);
                } else {
                    const value = player.getVar(varp.id);
                    player.messageGame('get ' + varp.debugname + ': ' + value);
                }
            } else if (cmd === 'getvarother' && Environment.node.production) {
                // custom
                if (args.length < 2) {
                    // ::getvarother <username> <variable>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const varp = VarPlayerType.getByName(args[1]);
                if (!varp) {
                    return false;
                }

                const value = other.getVar(varp.id);
                player.messageGame('get ' + varp.debugname + ': ' + value + ' on ' + other.username);
            } else if (cmd === 'give') {
                // authentic
                if (args.length < 1) {
                    // ::give <item> (amount)
                    // Adds the items(s) to your inventory
                    return false;
                }

                const obj = ObjType.getId(args[0]);
                if (obj === -1) {
                    return false;
                }

                const count = Math.max(1, Math.min(tryParseInt(args[1], 1), 0x7fffffff));
                player.invAdd(InvType.INV, obj, count);
            } else if (cmd === 'giveother' && Environment.node.production) {
                // custom
                if (args.length < 2) {
                    // ::giveother <username> <item> (amount)
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const obj = ObjType.getId(args[1]);
                if (obj === -1) {
                    return false;
                }

                const count = Math.max(1, Math.min(tryParseInt(args[2], 1), 0x7fffffff));
                other.invAdd(InvType.INV, obj, count);
            } else if (cmd === 'givecrap') {
                // authentic (we don't know the exact specifics of this...)

                // Fills your inventory with random items
                for (let i = 0; i < 28; i++) {
                    let random = -1;
                    while (random === -1) {
                        random = Math.trunc(Math.random() * ObjType.count);
                        const obj = ObjType.get(random);
                        if ((!Environment.node.members && obj.members) || obj.dummyitem !== 0 || obj.certtemplate !== -1) {
                            random = -1;
                        }
                    }

                    player.invAdd(InvType.INV, random, 1);
                }
            } else if (cmd === 'givemany') {
                // authentic
                if (args.length < 1) {
                    // ::givemany <item>
                    // Adds up to 1000 of the item to your inventory
                    return false;
                }

                const obj = ObjType.getId(args[0]);
                if (obj === -1) {
                    return false;
                }

                player.invAdd(InvType.INV, obj, 1000);
            } else if (cmd === 'broadcast' && Environment.node.production) {
                // custom
                if (args.length < 0) {
                    return false;
                }

                World.broadcastMes(cheat.substring(cmd.length + 1));
            } else if (cmd === 'reboot' && Environment.node.production) {
                // semi-authentic - we actually just shut down for maintenance

                // Reboots the game world, applying packed changes
                World.rebootTimer(0);
            } else if (cmd === 'slowreboot' && Environment.node.production) {
                // semi-authentic - we actually just shut down for maintenance
                if (args.length < 1) {
                    // ::slowreboot <seconds>
                    // Reboots the game world, with a timer
                    return false;
                }

                World.rebootTimer(Math.ceil((tryParseInt(args[0], 30) * 1000) / 600));
            } else if (cmd === 'serverdrop') {
                // testing reconnection behavior
                player.terminate();
            } else if (cmd === 'teleother' && Environment.node.production) {
                // custom
                if (args.length < 1) {
                    // ::teleother <username>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                other.closeModal();

                if (!other.canAccess()) {
                    player.messageGame(`${args[0]} is busy right now.`);
                    return false;
                }

                other.clearInteraction();
                other.unsetMapFlag();

                other.teleJump(player.x, player.z, player.level);
            } else if (cmd === 'setstat') {
                // authentic
                if (args.length < 2) {
                    // ::setstat <skill> <level>
                    // Sets the skill to specified level
                    return false;
                }

                const stat = PlayerStatMap.get(args[0].toUpperCase());
                if (typeof stat === 'undefined') {
                    return false;
                }

                player.setLevel(stat, parseInt(args[1]));
            } else if (cmd === 'advancestat') {
                // authentic
                if (args.length < 1) {
                    // ::advancestat <skill> <level>
                    // Advances skill to specified level, generates level up message etc.
                    return false;
                }

                const stat = PlayerStatMap.get(args[0].toUpperCase());
                if (typeof stat === 'undefined') {
                    return false;
                }

                player.stats[stat] = 0;
                player.baseLevels[stat] = 1;
                player.levels[stat] = 1;
                player.addXp(stat, getExpByLevel(parseInt(args[1])), false);
            } else if (cmd === 'minme') {
                // like maxme debugproc, but in engine because xp goes down
                for (let i = 0; i < PlayerStatEnabled.length; i++) {
                    if (i === PlayerStat.HITPOINTS) {
                        player.setLevel(i, 10);
                    } else {
                        player.setLevel(i, 1);
                    }
                }
            } else if (cmd === 'locadd') {
                // authentic - https://youtu.be/E6tQ3b3vzro?t=3194
                if (args.length < 1) {
                    return false;
                }
                const name: string = args[0];
                const type: LocType | null = LocType.getByName(name);
                if (!type) {
                    return false;
                }
                World.addLoc(new Loc(player.level, player.x, player.z, type.width, type.length, EntityLifeCycle.DESPAWN, type.id, LocShape.CENTREPIECE_STRAIGHT, LocAngle.WEST), 500);
                player.messageGame(`Loc Added: ${name} (ID: ${type.id})`);
            } else if (cmd === 'npcadd') {
                // authentic - https://youtu.be/E6tQ3b3vzro?t=3412
                if (args.length < 1) {
                    return false;
                }
                const name: string = args[0];
                const type: NpcType | null = NpcType.getByName(name);
                if (!type) {
                    return false;
                }
                World.addNpc(new Npc(player.level, player.x, player.z, type.size, type.size, EntityLifeCycle.DESPAWN, World.getNextNid(), type.id, type.blockwalk), 500);
            } else if (cmd === 'openmain') {
                if (args.length < 1) {
                    return false;
                }

                const name: string = args[0];
                const type: Component | null = Component.getByName(name);

                if (!type || type.rootLayer !== type.id) {
                    return false;
                }

                player.openMainModal(type.id);
            } else if (cmd === 'openoverlay') {
                if (args.length < 1) {
                    return false;
                }

                const name: string = args[0];
                const type: Component | null = Component.getByName(name);

                if (!type || type.rootLayer !== type.id) {
                    return false;
                }

                player.openMainOverlay(type.id);
            } else if (cmd === 'closeoverlay') {
                player.openMainOverlay(-1);
            } else if (cmd === 'snapshot') {
                const heap = v8.writeHeapSnapshot();
                printDebug(`Heap snapshot written to: ${heap}`);
            }
        }

        if (player.staffModLevel >= 2) {
            // "super-moderator" commands (similar to a jmod but we don't know their command capabilities on live)

            if (cmd === 'getcoord') {
                // authentic

                // Displays current coordinate
                player.messageGame(CoordGrid.formatString(player.level, player.x, player.z, ','));
            } else if (cmd === 'teles') {
                player.messageGame(`Teleport favorites: ${TELEPORT_FAVORITE_NAMES}.`);
            } else if (cmd === 'telefav' || cmd === 'tp') {
                if (args.length < 1) {
                    player.messageGame(`Usage: ::${cmd} <name>. Favorites: ${TELEPORT_FAVORITE_NAMES}.`);
                    return false;
                }

                const favorite = TELEPORT_FAVORITES[args[0]];
                if (!favorite) {
                    player.messageGame(`Unknown teleport favorite '${args[0]}'. Use ::teles for options.`);
                    return false;
                }

                return teleportToFavorite(player, favorite);
            } else if (TELEPORT_FAVORITES[cmd]) {
                return teleportToFavorite(player, TELEPORT_FAVORITES[cmd]);
            } else if (cmd === 'tele') {
                // authentic - https://youtu.be/60Y3y375VYA?t=980
                if (args.length < 1) {
                    // ::tele x,xx,xx[,xx,xx]
                    // Teleports you to the coordinate. In order, the parts are level, horizontal map square, vertical map square, horizontal tile, vertical tile.
                    return false;
                }

                const coord = args[0].split(',');
                if (coord.length < 3) {
                    return false;
                }

                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                player.clearInteraction();
                player.unsetMapFlag();

                const level = tryParseInt(coord[0], 0);
                const mx = tryParseInt(coord[1], 50);
                const mz = tryParseInt(coord[2], 50);
                const lx = tryParseInt(coord[3], 32);
                const lz = tryParseInt(coord[4], 32);

                if (level < 0 || level > 3 || mx < 0 || mx > 255 || mz < 0 || mz > 255 || lx < 0 || lx > 63 || lz < 0 || lz > 63) {
                    return false;
                }

                player.teleJump((mx << 6) + lx, (mz << 6) + lz, level);
            } else if (cmd === 'teleto' && Environment.node.production) {
                // custom
                if (args.length < 1) {
                    return false;
                }

                // ::teleto <username>
                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                player.clearInteraction();
                player.unsetMapFlag();

                player.teleJump(other.x, other.z, other.level);
            } else if (cmd === 'setvis' && Environment.node.production) {
                // authentic
                if (args.length < 1) {
                    // ::setvis <level>
                    return false;
                }

                switch (args[0]) {
                    case '0':
                        player.setVisibility(Visibility.DEFAULT);
                        break;
                    case '1':
                        player.setVisibility(Visibility.SOFT);
                        break;
                    case '2':
                        player.setVisibility(Visibility.HARD);
                        break;
                    default:
                        return false;
                }
            } else if (cmd === 'ban' && Environment.node.production) {
                // custom
                if (args.length < 2) {
                    // ::ban <username> <minutes>
                    player.messageGame('Usage: ::ban <username> <minutes>');
                    return false;
                }

                const username = args[0];
                const minutes = Math.max(0, tryParseInt(args[1], 60));

                World.notifyPlayerBan(player.username, username, Date.now() + minutes * 60 * 1000);
                player.messageGame(`Player '${args[0]}' has been banned for ${minutes} minutes.`);
            } else if (cmd === 'mute' && Environment.node.production) {
                // custom
                if (args.length < 2) {
                    // ::mute <username> <minutes>
                    player.messageGame('Usage: ::mute <username> <minutes>');
                    return false;
                }

                const username = args[0];
                const minutes = Math.max(0, tryParseInt(args[1], 60));

                World.notifyPlayerMute(player.username, username, Date.now() + minutes * 60 * 1000);
                player.messageGame(`Player '${args[0]}' has been muted for ${minutes} minutes.`);
            } else if (cmd === 'kick' && Environment.node.production) {
                // custom
                if (args.length < 1) {
                    // ::kick <username>
                    player.messageGame('Usage: ::kick <username>');
                    return false;
                }

                const username = args[0];

                const other = World.getPlayerByUsername(username);
                if (other) {
                    other.loggingOut = true;
                    if (isClientConnected(other)) {
                        other.logout();
                        other.client.close();
                    }
                    player.messageGame(`Player '${args[0]}' has been kicked from the game.`);
                } else {
                    player.messageGame(`Player '${args[0]}' does not exist or is not logged in.`);
                }
            }
        }

        return true;
    }
}
