import fs from 'node:fs';
import path from 'node:path';

import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import { WealthEventItem, WealthTransactionEvent } from '#/engine/entity/tracking/WealthEvent.js';
import { WealthEventType } from '#/server/logger/WealthEventType.js';

const MARKET_MESSAGE_PREFIX = '__BANK_MARKET__';
const PRICE_HISTORY_SIZE = 5;
const MIN_MARKET_TRADES = 3;
const MAX_SEARCH_RESULTS = 40;
const MAX_TRANSACTION_AMOUNT = 10_000;
const MAX_TRANSACTION_VALUE = 2_000_000_000;

type PriceHistoryFile = Record<string, number[]>;

type MarketQuote = {
    id: number;
    name: string;
    buyPrice: number;
    sellPrice: number;
    samples: number;
};

type ItemSide = {
    coins: number;
    items: WealthEventItem[];
};

class BankMarketService {
    private readonly historyPath: string = path.resolve('data/market/prices.json');
    private readonly prices: Map<number, number[]> = new Map();

    constructor() {
        this.load();
    }

    handleCommand(player: Player, command: string, args: string[]): boolean {
        if (command === 'botbuy' || command === 'botstock') {
            player.messageGame('Adventure bot trading has moved to the Bank Market. Right-click any Banker and choose Market.');
            return true;
        }

        if (command !== 'market') {
            return false;
        }

        const action: string = args.shift() ?? 'search';
        if (action === 'search') {
            this.search(player, args.join(' '));
            return true;
        }

        if (action !== 'buy' && action !== 'sell') {
            this.notice(player, false, 'Choose an item from the Bank Market.');
            return true;
        }

        const objId: number = Number.parseInt(args[0] ?? '', 10);
        const amount: number = Number.parseInt(args[1] ?? '', 10);
        if (!Number.isSafeInteger(objId) || !Number.isSafeInteger(amount) || amount < 1 || amount > MAX_TRANSACTION_AMOUNT) {
            this.notice(player, false, `Amount must be between 1 and ${MAX_TRANSACTION_AMOUNT}.`);
            return true;
        }

        const type: ObjType | null = this.getTradeableItem(objId);
        if (!type) {
            this.notice(player, false, 'That item cannot be traded on the Bank Market.');
            return true;
        }

        if (action === 'buy') {
            this.buy(player, type, amount);
        } else {
            this.sell(player, type, amount);
        }
        return true;
    }

    open(player: Player): void {
        this.send(player, { type: 'open' });
    }

    recordPlayerTrade(event: WealthTransactionEvent): void {
        if (event.event_type !== WealthEventType.TRADE || !event.recipient_items) {
            return;
        }

        const coinsId: number = ObjType.getId('coins');
        if (coinsId === -1) {
            return;
        }

        const account: ItemSide = this.splitTradeSide(event.account_items, coinsId);
        const recipient: ItemSide = this.splitTradeSide(event.recipient_items, coinsId);

        if (account.coins > 0 && account.items.length === 0 && recipient.coins === 0 && recipient.items.length === 1) {
            this.recordPrice(recipient.items[0], account.coins);
        } else if (recipient.coins > 0 && recipient.items.length === 0 && account.coins === 0 && account.items.length === 1) {
            this.recordPrice(account.items[0], recipient.coins);
        }
    }

    private search(player: Player, rawQuery: string): void {
        const query: string = rawQuery.trim().toLowerCase().slice(0, 48);
        const matches: { quote: MarketQuote; rank: number }[] = [];

        for (let id: number = 0; id < ObjType.count; id++) {
            const type: ObjType | null = this.getTradeableItem(id);
            if (!type) {
                continue;
            }

            const name: string = type.name!.toLowerCase();
            const debugname: string = type.debugname!.toLowerCase();
            if (query && !name.includes(query) && !debugname.includes(query)) {
                continue;
            }

            let rank: number = 3;
            if (!query) {
                rank = this.prices.has(id) ? 0 : 3;
            } else if (name === query || debugname === query) {
                rank = 0;
            } else if (name.startsWith(query) || debugname.startsWith(query)) {
                rank = 1;
            } else {
                rank = 2;
            }
            matches.push({ quote: this.quote(type), rank });
        }

        matches.sort((a, b) => a.rank - b.rank || b.quote.samples - a.quote.samples || a.quote.name.localeCompare(b.quote.name));
        this.send(player, { type: 'clear', query });
        for (const match of matches.slice(0, MAX_SEARCH_RESULTS)) {
            this.send(player, { type: 'result', ...match.quote });
        }
        this.send(player, { type: 'done', count: Math.min(matches.length, MAX_SEARCH_RESULTS), total: matches.length });
    }

    private buy(player: Player, type: ObjType, requestedAmount: number): void {
        const coinsId: number = ObjType.getId('coins');
        const price: number = this.quote(type).buyPrice;
        const affordable: number = Math.floor(player.invTotal(InvType.INV, coinsId) / price);
        const amount: number = Math.min(requestedAmount, affordable);
        if (amount < 1) {
            this.notice(player, false, `You need ${price} coins for one ${type.name}.`);
            return;
        }

        const added: number = player.invAdd(InvType.INV, type.id, amount);
        if (added < 1) {
            this.notice(player, false, 'You do not have enough inventory space.');
            return;
        }

        const total: number = added * price;
        if (total > MAX_TRANSACTION_VALUE || player.invDel(InvType.INV, coinsId, total) !== total) {
            player.invDel(InvType.INV, type.id, added);
            this.notice(player, false, 'The purchase could not be completed.');
            return;
        }

        player.addWealthEvent({
            event_type: WealthEventType.SHOP_BUY,
            account_items: [{ id: type.id, name: type.debugname, count: added }],
            account_value: total
        });
        this.notice(player, true, `Bought ${added} x ${type.name} for ${total} coins.`);
    }

    private sell(player: Player, type: ObjType, requestedAmount: number): void {
        const coinsId: number = ObjType.getId('coins');
        const price: number = this.quote(type).sellPrice;
        const amount: number = Math.min(requestedAmount, player.invTotal(InvType.INV, type.id));
        if (amount < 1) {
            this.notice(player, false, `You do not have any ${type.name} to sell.`);
            return;
        }

        const total: number = amount * price;
        if (total > MAX_TRANSACTION_VALUE) {
            this.notice(player, false, 'That transaction is too large.');
            return;
        }

        const removed: number = player.invDel(InvType.INV, type.id, amount);
        if (removed < 1) {
            this.notice(player, false, 'The sale could not be completed.');
            return;
        }

        const value: number = removed * price;
        if (player.invAdd(InvType.INV, coinsId, value) !== value) {
            player.invAdd(InvType.INV, type.id, removed);
            this.notice(player, false, 'You do not have enough inventory space for the coins.');
            return;
        }

        player.addWealthEvent({
            event_type: WealthEventType.SHOP_SELL,
            account_items: [{ id: type.id, name: type.debugname, count: removed }],
            account_value: value
        });
        this.notice(player, true, `Sold ${removed} x ${type.name} for ${value} coins.`);
    }

    private quote(type: ObjType): MarketQuote {
        const samples: number[] = this.prices.get(type.id) ?? [];
        const marketPrice: number = samples.length >= MIN_MARKET_TRADES
            ? Math.max(1, Math.round(samples.reduce((sum, price) => sum + price, 0) / samples.length))
            : Math.max(1, type.cost);

        return {
            id: type.id,
            name: type.name!,
            buyPrice: marketPrice,
            sellPrice: marketPrice,
            samples: samples.length
        };
    }

    private getTradeableItem(id: number): ObjType | null {
        if (id < 0 || id >= ObjType.count) {
            return null;
        }

        const type: ObjType = ObjType.get(id);
        if (!type.name || !type.debugname || !type.tradeable || type.certtemplate !== -1 || type.id === ObjType.getId('coins')) {
            return null;
        }
        return type;
    }

    private splitTradeSide(items: WealthEventItem[], coinsId: number): ItemSide {
        let coins: number = 0;
        const tradeItems: WealthEventItem[] = [];
        for (const item of items) {
            if (item.id === coinsId || item.name === 'coins') {
                coins += item.count;
            } else if (item.id !== undefined && item.count > 0) {
                tradeItems.push(item);
            }
        }
        return { coins, items: tradeItems };
    }

    private recordPrice(item: WealthEventItem, coins: number): void {
        if (item.id === undefined || item.count < 1 || coins < 1 || !this.getTradeableItem(item.id)) {
            return;
        }

        const unitPrice: number = Math.max(1, Math.round(coins / item.count));
        const samples: number[] = this.prices.get(item.id) ?? [];
        samples.push(unitPrice);
        if (samples.length > PRICE_HISTORY_SIZE) {
            samples.splice(0, samples.length - PRICE_HISTORY_SIZE);
        }
        this.prices.set(item.id, samples);
        this.save();
    }

    private load(): void {
        try {
            const data: PriceHistoryFile = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
            for (const [id, samples] of Object.entries(data)) {
                const objId: number = Number.parseInt(id, 10);
                const valid: number[] = samples.filter(price => Number.isSafeInteger(price) && price > 0).slice(-PRICE_HISTORY_SIZE);
                if (Number.isSafeInteger(objId) && valid.length > 0) {
                    this.prices.set(objId, valid);
                }
            }
        } catch (_error) {
            // A fresh market intentionally starts with 2004 object values.
        }
    }

    private save(): void {
        const data: PriceHistoryFile = {};
        for (const [id, samples] of this.prices) {
            data[id] = samples;
        }
        fs.mkdirSync(path.dirname(this.historyPath), { recursive: true });
        fs.writeFileSync(this.historyPath, JSON.stringify(data, null, 2) + '\n');
    }

    private notice(player: Player, success: boolean, message: string): void {
        this.send(player, { type: 'notice', success, message });
        player.messageGame(message);
    }

    private send(player: Player, payload: object): void {
        player.messageGame(MARKET_MESSAGE_PREFIX + JSON.stringify(payload));
    }
}

export const bankMarketService = new BankMarketService();
