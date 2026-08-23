import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import SimulatedPlayer from '#/engine/entity/SimulatedPlayer.js';
import { BotItemStore } from '#/engine/living/BotProfileStore.js';

type PendingBotTrade = {
    bot: SimulatedPlayer;
    expiresAt: number;
};

type StockEntry = {
    debugname: string;
    displayName: string;
    count: number;
    objId: number;
    unitPrice: number;
};

const TRADE_DISTANCE = 12;
const OFFER_LIFETIME_MS = 60_000;
const pendingTrades = new WeakMap<Player, PendingBotTrade>();

function distance(a: Player, b: Player): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

function displayItemName(type: ObjType, fallback: string): string {
    return (type.name ?? fallback.replaceAll('_', ' ')).toLowerCase();
}

function availableCount(bot: SimulatedPlayer, debugname: string): number {
    return (bot.profile.inventory[debugname] ?? 0) + (bot.profile.bank[debugname] ?? 0);
}

function removeFromStore(store: BotItemStore, debugname: string, count: number): number {
    const removed = Math.min(store[debugname] ?? 0, count);
    const remaining = (store[debugname] ?? 0) - removed;
    if (remaining > 0) {
        store[debugname] = remaining;
    } else {
        delete store[debugname];
    }
    return removed;
}

function removeStock(bot: SimulatedPlayer, debugname: string, count: number): void {
    const fromInventory = removeFromStore(bot.profile.inventory, debugname, count);
    removeFromStore(bot.profile.bank, debugname, count - fromInventory);
}

function addToStore(store: BotItemStore, debugname: string, count: number): void {
    store[debugname] = (store[debugname] ?? 0) + count;
}

function stockFor(bot: SimulatedPlayer): StockEntry[] {
    const names = new Set([...Object.keys(bot.profile.inventory), ...Object.keys(bot.profile.bank)]);
    const entries: StockEntry[] = [];

    for (const debugname of names) {
        if (debugname === 'coins') {
            continue;
        }

        const objId = ObjType.getId(debugname);
        if (objId === -1) {
            continue;
        }

        const type = ObjType.get(objId);
        const count = availableCount(bot, debugname);
        if (!type.tradeable || count <= 0) {
            continue;
        }

        entries.push({
            debugname,
            displayName: displayItemName(type, debugname),
            count,
            objId,
            unitPrice: Math.max(1, type.cost)
        });
    }

    return entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function getPendingTrade(player: Player): PendingBotTrade | null {
    const pending = pendingTrades.get(player);
    if (!pending || pending.expiresAt < Date.now() || !pending.bot.isActive || pending.bot.level !== player.level || distance(player, pending.bot) > TRADE_DISTANCE) {
        pendingTrades.delete(player);
        return null;
    }
    return pending;
}

export function showBotStock(player: Player, bot: SimulatedPlayer): void {
    player.faceSquare(bot.x, bot.z);
    bot.faceSquare(player.x, player.z);
    const stock = stockFor(bot);
    if (stock.length === 0) {
        bot.say('I need to gather another load first.');
        player.messageGame(`${bot.displayName} has no resources for sale right now.`);
        pendingTrades.delete(player);
        return;
    }

    pendingTrades.set(player, { bot, expiresAt: Date.now() + OFFER_LIFETIME_MS });
    bot.say('Take a look at what I gathered.');
    player.messageGame(`Trading with ${bot.displayName}:`);
    for (const entry of stock.slice(0, 6)) {
        player.messageGame(`${entry.debugname} x${entry.count} - ${entry.unitPrice} coins each.`);
    }
    if (stock.length > 6) {
        player.messageGame(`...and ${stock.length - 6} more resource types.`);
    }
    player.messageGame('Buy with ::botbuy <item> <amount>; use ::botstock to refresh.');
}

export function talkToBot(player: Player, bot: SimulatedPlayer): void {
    player.faceSquare(bot.x, bot.z);
    bot.faceSquare(player.x, player.z);
    bot.say(`I'm ${bot.profile.goal.toLowerCase()}.`);
    player.messageGame(`${bot.displayName} is a ${bot.profile.role.replaceAll('_', ' ')} currently ${bot.profile.goal.toLowerCase()}.`);
    player.messageGame('Use Trade with to buy the resources they have collected.');
}

export function handleBotCommand(player: Player, cmd: string, args: string[]): boolean {
    if (cmd !== 'botstock' && cmd !== 'botbuy') {
        return false;
    }

    const pending = getPendingTrade(player);
    if (!pending) {
        player.messageGame('Trade with a nearby adventurer bot first.');
        return true;
    }

    if (cmd === 'botstock') {
        showBotStock(player, pending.bot);
        return true;
    }

    if (args.length < 1) {
        player.messageGame('Usage: ::botbuy <item> <amount>');
        return true;
    }

    const requestedName = args[0].replaceAll(' ', '_');
    const entry = stockFor(pending.bot).find(candidate => candidate.debugname === requestedName || candidate.displayName.replaceAll(' ', '_') === requestedName);
    if (!entry) {
        player.messageGame(`${pending.bot.displayName} is not selling '${requestedName}'. Use ::botstock.`);
        return true;
    }

    const requestedAmount = args.length > 1 ? Number.parseInt(args[1], 10) : 1;
    if (!Number.isSafeInteger(requestedAmount) || requestedAmount < 1 || requestedAmount > 10_000) {
        player.messageGame('Amount must be between 1 and 10000.');
        return true;
    }

    const coinsId = ObjType.getId('coins');
    if (coinsId === -1) {
        player.messageGame('The coin object is unavailable; this trade cannot be completed.');
        return true;
    }

    const coinsHeld = player.invTotal(InvType.INV, coinsId);
    const affordable = Math.floor(coinsHeld / entry.unitPrice);
    const amount = Math.min(requestedAmount, entry.count, affordable);
    if (amount < 1) {
        player.messageGame(`You need ${entry.unitPrice} coins for one ${entry.displayName}.`);
        return true;
    }

    const added = player.invAdd(InvType.INV, entry.objId, amount);
    if (added < 1) {
        player.messageGame('You do not have enough inventory space.');
        return true;
    }

    const totalPrice = added * entry.unitPrice;
    const removedCoins = player.invDel(InvType.INV, coinsId, totalPrice);
    if (removedCoins !== totalPrice) {
        player.invDel(InvType.INV, entry.objId, added);
        player.messageGame('The trade could not be completed.');
        return true;
    }

    removeStock(pending.bot, entry.debugname, added);
    addToStore(pending.bot.profile.bank, 'coins', totalPrice);
    pending.expiresAt = Date.now() + OFFER_LIFETIME_MS;
    pending.bot.say('Pleasure doing business.');
    player.messageGame(`Bought ${added} x ${entry.displayName} from ${pending.bot.displayName} for ${totalPrice} coins.`);
    return true;
}
