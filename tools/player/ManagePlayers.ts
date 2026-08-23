import fs from 'fs';
import path from 'path';

import * as bcrypt from 'bcrypt-ts';

import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import type PlayerType from '#/engine/entity/Player.js';
import { PlayerStatMap, PlayerStatNameMap } from '#/engine/entity/PlayerStat.js';
import World from '#/engine/World.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import { hasLocalAccountPassword, normalizeLocalUsername, removeLocalAccountPassword, setLocalAccountPassword } from '#/server/login/LocalAccountStore.js';

// Import World first to preserve the engine's normal module initialization
// order, then load the player codec after its circular dependencies are ready.
void World;
const { getLevelByExp } = await import('#/engine/entity/Player.js');
const { PlayerLoading } = await import('#/engine/entity/PlayerLoading.js');

const profile = Environment.node.profile;
const playerDir = path.join('data', 'players', profile);

function usage(): never {
    console.error(`Usage:
  player:manage verify-file <path>
  player:manage inspect <username>
  player:manage password-status <username>
  player:manage set-password <username> <password>
  player:manage remove-password <username>
  player:manage set-level <username> <skill> <level>
  player:manage set-xp <username> <skill> <xp>
  player:manage set-position <username> <x> <z> <plane>
  player:manage add-item <username> <inventory> <item> <amount>
  player:manage remove-item <username> <inventory> <item> <amount>
  player:manage clear-inventory <username> <inventory>`);
    process.exit(1);
}

function validateUsername(username: string): string {
    const normalized = normalizeLocalUsername(username).replaceAll(' ', '_');
    if (!/^[a-z0-9_]{1,12}$/.test(normalized)) {
        throw new Error('Character names must be 1-12 characters using letters, numbers, or underscores.');
    }
    return normalized;
}

function getPlayerPath(username: string): string {
    return path.join(playerDir, `${validateUsername(username)}.sav`);
}

function verifyBytes(bytes: Buffer, label: string): void {
    if (!PlayerLoading.verify(new Packet(bytes))) {
        throw new Error(`${label} is not a valid revision ${PlayerLoading.SAV_VERSION} character save.`);
    }
}

function loadPlayer(username: string) {
    const normalized = validateUsername(username);
    const filename = getPlayerPath(normalized);
    if (!fs.existsSync(filename)) {
        throw new Error(`Character '${normalized}' does not exist in profile '${profile}'.`);
    }

    const bytes = fs.readFileSync(filename);
    verifyBytes(bytes, filename);
    return { normalized, filename, player: PlayerLoading.load(normalized, new Packet(bytes), null) };
}

function savePlayer(filename: string, player: PlayerType): void {
    fs.copyFileSync(filename, `${filename}.bak`);
    fs.writeFileSync(filename, player.save());
}

function parseInteger(value: string | undefined, label: string, minimum: number, maximum: number): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw new Error(`${label} must be a whole number from ${minimum} to ${maximum}.`);
    }
    return parsed;
}

function resolveStat(value: string | undefined): number {
    const stat = PlayerStatMap.get((value ?? '').toUpperCase());
    if (typeof stat === 'undefined') {
        throw new Error(`Unknown skill '${value ?? ''}'.`);
    }
    return stat;
}

function resolveInventory(value: string | undefined): number {
    if (!value) throw new Error('Inventory is required. Try inv, bank, or worn.');
    const numeric = Number(value);
    const id = Number.isSafeInteger(numeric) ? numeric : InvType.getId(value.toLowerCase());
    const type = InvType.get(id);
    if (id < 0 || !type || type.scope !== InvType.SCOPE_PERM) {
        throw new Error(`Unknown or non-persistent inventory '${value}'. Try inv, bank, or worn.`);
    }
    return id;
}

function resolveObject(value: string | undefined): number {
    if (!value) throw new Error('Item is required.');
    const numeric = Number(value);
    const id = Number.isSafeInteger(numeric) ? numeric : ObjType.getId(value.toLowerCase());
    if (id < 0 || id >= ObjType.count) {
        throw new Error(`Unknown item '${value}'. Use its config name or numeric ID.`);
    }
    return id;
}

function initializeConfigs(): void {
    ParamType.load('data/pack');
    VarPlayerType.load('data/pack');
    InvType.load('data/pack');
    ObjType.load('data/pack');
}

function setPassword(username: string, password: string): void {
    const normalized = validateUsername(username);
    const adminUsername = normalizeLocalUsername(Environment.node.adminUsername);
    if (normalized !== adminUsername) {
        setLocalAccountPassword(normalized, password);
        console.log(`Password changed for '${normalized}'.`);
        return;
    }

    if (password.length < 1 || password.length > 20) {
        throw new Error('Passwords must contain between 1 and 20 characters.');
    }

    const configPath = path.join('data', 'config', 'world.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.node.adminPasswordHash = bcrypt.hashSync(password.toLowerCase(), 10);
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 4)}\n`);
    fs.writeFileSync(path.join('data', 'config', 'admin-password.txt'), `${password}\n`, { mode: 0o600 });
    console.log(`Administrator password changed for '${normalized}'. Restart the server to apply it.`);
}

function inspect(username: string): void {
    initializeConfigs();
    const { normalized, player } = loadPlayer(username);
    console.log(`Character: ${normalized}`);
    console.log(`Position: ${player.x}, ${player.z}, plane ${player.level}`);
    console.log(`Playtime ticks: ${player.playtime}`);
    console.log('Skills:');
    for (let index = 0; index < player.stats.length; index++) {
        const name = PlayerStatNameMap.get(index);
        if (name && !name.startsWith('STAT')) {
            console.log(`  ${name.toLowerCase()}: level ${player.baseLevels[index]}, xp ${player.stats[index]}`);
        }
    }
    console.log('Persistent inventories:');
    for (const [inventoryId, inventory] of player.invs) {
        const inventoryName = InvType.get(inventoryId)?.debugname ?? String(inventoryId);
        const items = inventory.itemsFiltered.map(item => `${ObjType.get(item.id)?.debugname ?? item.id} x${item.count}`);
        console.log(`  ${inventoryName}: ${items.length > 0 ? items.join(', ') : '(empty)'}`);
    }
}

async function main(): Promise<void> {
    const [command, ...args] = process.argv.slice(2);
    if (!command) usage();

    if (command === 'verify-file') {
        const filename = args[0];
        if (!filename || !fs.existsSync(filename)) throw new Error('Save file does not exist.');
        verifyBytes(fs.readFileSync(filename), filename);
        console.log('Save file is valid.');
        return;
    }
    if (command === 'password-status') {
        const username = validateUsername(args[0] ?? '');
        const isAdmin = username === normalizeLocalUsername(Environment.node.adminUsername);
        console.log(isAdmin || hasLocalAccountPassword(username) ? 'set' : 'unclaimed');
        return;
    }
    if (command === 'set-password') {
        setPassword(args[0] ?? '', args[1] ?? '');
        return;
    }
    if (command === 'remove-password') {
        const username = validateUsername(args[0] ?? '');
        if (username === normalizeLocalUsername(Environment.node.adminUsername)) {
            throw new Error('The administrator password cannot be removed. Change it instead.');
        }
        console.log(removeLocalAccountPassword(username) ? `Password removed for '${username}'.` : `No password was set for '${username}'.`);
        return;
    }
    if (command === 'inspect') {
        inspect(args[0] ?? '');
        return;
    }

    initializeConfigs();
    const { normalized, filename, player } = loadPlayer(args[0] ?? '');
    if (command === 'set-level') {
        const stat = resolveStat(args[1]);
        const level = parseInteger(args[2], 'Level', 1, 99);
        player.setLevel(stat, level);
        savePlayer(filename, player);
        console.log(`Set ${normalized}'s ${PlayerStatNameMap.get(stat)?.toLowerCase()} level to ${level}.`);
    } else if (command === 'set-xp') {
        const stat = resolveStat(args[1]);
        const xp = parseInteger(args[2], 'XP', 0, 2_000_000_000);
        const level = Math.max(1, Math.min(99, getLevelByExp(xp)));
        player.stats[stat] = xp;
        player.baseLevels[stat] = level;
        player.levels[stat] = level;
        savePlayer(filename, player);
        console.log(`Set ${normalized}'s ${PlayerStatNameMap.get(stat)?.toLowerCase()} XP to ${xp} (level ${level}).`);
    } else if (command === 'set-position') {
        player.x = parseInteger(args[1], 'X', 0, 65535);
        player.z = parseInteger(args[2], 'Z', 0, 65535);
        player.level = parseInteger(args[3], 'Plane', 0, 3);
        savePlayer(filename, player);
        console.log(`Moved ${normalized} to ${player.x}, ${player.z}, plane ${player.level}.`);
    } else if (command === 'add-item' || command === 'remove-item') {
        const inventoryId = resolveInventory(args[1]);
        const objectId = resolveObject(args[2]);
        const amount = parseInteger(args[3], 'Amount', 1, 2_147_483_647);
        const changed = command === 'add-item' ? player.invAdd(inventoryId, objectId, amount) : player.invDel(inventoryId, objectId, amount);
        savePlayer(filename, player);
        console.log(`${command === 'add-item' ? 'Added' : 'Removed'} ${ObjType.get(objectId).debugname ?? objectId} x${changed} ${command === 'add-item' ? 'to' : 'from'} ${normalized}.`);
    } else if (command === 'clear-inventory') {
        const inventoryId = resolveInventory(args[1]);
        player.invClear(inventoryId);
        savePlayer(filename, player);
        console.log(`Cleared ${InvType.get(inventoryId).debugname ?? inventoryId} for ${normalized}.`);
    } else {
        usage();
    }
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
