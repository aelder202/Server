import fs from 'node:fs';
import path from 'node:path';

import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import { WealthEventType } from '#/server/logger/WealthEventType.js';

const MARKET_MESSAGE_PREFIX = '__BANK_MARKET__';
const MARKET_ORIGIN = 'https://markets.lostcity.rs';
const PRICE_HISTORY_SIZE = 5;
const MIN_MARKET_TRADES = 3;
const QUOTE_CACHE_MS = 10 * 60 * 1000;
const MAX_TRANSACTION_AMOUNT = 10_000;
const MAX_TRANSACTION_VALUE = 2_000_000_000;

type QuoteSource = 'market-sales' | 'market-value';

type MarketQuote = {
    id: number;
    name: string;
    buyPrice: number;
    sellPrice: number;
    samples: number;
    source: QuoteSource;
};

type RemoteItem = {
    id: number;
    game_id: number;
    name: string;
    slug: string;
    cost: number;
    isSet: boolean;
};

type RemoteOfferItem = {
    quantity?: number;
    item?: {
        game_id?: number;
    } | null;
};

type RemoteListing = {
    price?: number | null;
    soldAt?: string | null;
    offers?: Array<{
        items?: RemoteOfferItem[];
    }>;
};

type StoredQuote = MarketQuote & {
    fetchedAt: number;
    marketId: number;
    slug: string;
    marketCost: number;
};

type MarketCacheFile = {
    version: 1;
    quotes: Record<string, StoredQuote>;
};

class BankMarketService {
    private readonly cachePath: string = path.resolve('data/market/market-cache.json');
    private readonly quotes: Map<number, StoredQuote> = new Map();

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
            void this.search(player, args.join(' '));
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

        const transaction: Promise<void> = action === 'buy' ? this.buy(player, type, amount) : this.sell(player, type, amount);
        void transaction.catch(() => this.notice(player, false, 'Lost City Markets could not provide a price. Try again in a moment.'));
        return true;
    }

    open(player: Player): void {
        this.send(player, { type: 'open' });
    }

    private async search(player: Player, rawQuery: string): Promise<void> {
        const query: string = rawQuery.trim().slice(0, 48);
        this.send(player, { type: 'clear', query });
        if (!query) {
            this.send(player, { type: 'done', count: 0, total: 0 });
            return;
        }

        try {
            const remoteItems: RemoteItem[] = await this.fetchItems(query);
            const quoteTasks: Promise<MarketQuote>[] = [];
            for (const remote of remoteItems) {
                const type: ObjType | null = this.getTradeableItem(remote.game_id);
                if (!type || remote.isSet) {
                    continue;
                }
                quoteTasks.push(this.quote(type, remote));
            }

            const settled: PromiseSettledResult<MarketQuote>[] = await Promise.allSettled(quoteTasks);
            const results: MarketQuote[] = settled
                .filter((result): result is PromiseFulfilledResult<MarketQuote> => result.status === 'fulfilled')
                .map(result => result.value);
            if (quoteTasks.length > 0 && results.length === 0) {
                throw new Error('Lost City Markets did not return any usable prices');
            }

            for (const quote of results) {
                this.send(player, { type: 'result', ...quote });
            }
            this.send(player, { type: 'done', count: results.length, total: results.length });
        } catch (_error) {
            this.notice(player, false, 'Lost City Markets could not be reached. Try again in a moment.');
        }
    }

    private async buy(player: Player, type: ObjType, requestedAmount: number): Promise<void> {
        const coinsId: number = ObjType.getId('coins');
        const price: number = (await this.quoteForType(type)).buyPrice;
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

    private async sell(player: Player, type: ObjType, requestedAmount: number): Promise<void> {
        const coinsId: number = ObjType.getId('coins');
        const price: number = (await this.quoteForType(type)).sellPrice;
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

    private async quoteForType(type: ObjType): Promise<MarketQuote> {
        const cached: StoredQuote | undefined = this.quotes.get(type.id);
        if (cached) {
            const remote: RemoteItem = {
                id: cached.marketId,
                game_id: type.id,
                name: cached.name,
                slug: cached.slug,
                cost: cached.marketCost,
                isSet: false
            };
            return this.quote(type, remote);
        }

        const matches: RemoteItem[] = await this.fetchItems(type.name ?? type.debugname ?? '');
        const remote: RemoteItem | undefined = matches.find(item => item.game_id === type.id && !item.isSet);
        if (!remote) {
            throw new Error(`Item ${type.id} was not found on Lost City Markets`);
        }
        return this.quote(type, remote);
    }

    private async quote(type: ObjType, remote: RemoteItem): Promise<MarketQuote> {
        const cached: StoredQuote | undefined = this.quotes.get(type.id);
        if (cached && Date.now() - cached.fetchedAt < QUOTE_CACHE_MS) {
            return this.publicQuote(cached);
        }

        try {
            const listings: RemoteListing[] = await this.fetchSoldListings(remote.slug);
            const prices: number[] = this.cleanSalePrices(listings);
            const usesSales: boolean = prices.length >= MIN_MARKET_TRADES;
            const marketPrice: number = usesSales
                ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length)
                : remote.cost;
            const price: number = Math.max(1, Math.min(MAX_TRANSACTION_VALUE, marketPrice));
            const stored: StoredQuote = {
                id: type.id,
                name: type.name!,
                buyPrice: price,
                sellPrice: price,
                samples: prices.length,
                source: usesSales ? 'market-sales' : 'market-value',
                fetchedAt: Date.now(),
                marketId: remote.id,
                slug: remote.slug,
                marketCost: remote.cost
            };
            this.quotes.set(type.id, stored);
            this.save();
            return this.publicQuote(stored);
        } catch (error) {
            if (cached) {
                return this.publicQuote(cached);
            }
            throw error;
        }
    }

    private async fetchItems(query: string): Promise<RemoteItem[]> {
        const url: URL = new URL('/api/items', MARKET_ORIGIN);
        url.searchParams.set('q', query);
        url.searchParams.set('include_unlisted', 'true');
        const response: Response = await this.marketFetch(url);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('Unexpected Lost City Markets item response');
        }

        return data.filter((item): item is RemoteItem => {
            if (!item || typeof item !== 'object') {
                return false;
            }
            const candidate: Partial<RemoteItem> = item;
            return Number.isSafeInteger(candidate.id) && Number.isSafeInteger(candidate.game_id) && typeof candidate.name === 'string' &&
                typeof candidate.slug === 'string' && Number.isSafeInteger(candidate.cost) && typeof candidate.isSet === 'boolean';
        });
    }

    private async fetchSoldListings(slug: string): Promise<RemoteListing[]> {
        const response: Response = await this.marketFetch(new URL(`/items/${encodeURIComponent(slug)}`, MARKET_ORIGIN));
        const html: string = await response.text();
        const match: RegExpMatchArray | null = html.match(/data-page="([^"]+)"/);
        if (!match) {
            throw new Error('Lost City Markets item page did not contain price data');
        }

        const encoded: string = match[1]
            .replaceAll('&quot;', '"')
            .replaceAll('&#039;', "'")
            .replaceAll('&#39;', "'")
            .replaceAll('&apos;', "'")
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>')
            .replaceAll('&amp;', '&');
        const page: unknown = JSON.parse(encoded);
        if (!page || typeof page !== 'object') {
            throw new Error('Unexpected Lost City Markets item page');
        }

        const props: unknown = (page as { props?: unknown }).props;
        const soldListings: unknown = props && typeof props === 'object' ? (props as { soldListings?: unknown }).soldListings : null;
        const data: unknown = soldListings && typeof soldListings === 'object' ? (soldListings as { data?: unknown }).data : null;
        if (!Array.isArray(data)) {
            throw new Error('Lost City Markets item page did not contain completed sales');
        }
        return data as RemoteListing[];
    }

    private async marketFetch(url: URL): Promise<Response> {
        const response: Response = await fetch(url, {
            headers: {
                accept: 'application/json, text/html;q=0.9',
                'user-agent': 'LostCity-Local-Bank-Market/1.0'
            },
            signal: AbortSignal.timeout(8_000)
        });
        if (!response.ok) {
            throw new Error(`Lost City Markets returned ${response.status}`);
        }
        return response;
    }

    private cleanSalePrices(listings: RemoteListing[]): number[] {
        const prices: number[] = [];
        for (const listing of listings) {
            if (!listing.soldAt) {
                continue;
            }

            let price: number | null = Number.isSafeInteger(listing.price) && (listing.price ?? 0) > 0 ? listing.price! : null;
            if (price === null && listing.offers?.length === 1) {
                const items: RemoteOfferItem[] = listing.offers[0].items ?? [];
                if (items.length === 1 && items[0].item?.game_id === ObjType.getId('coins') && Number.isSafeInteger(items[0].quantity) && (items[0].quantity ?? 0) > 0) {
                    price = items[0].quantity!;
                }
            }

            if (price !== null) {
                prices.push(price);
                if (prices.length === PRICE_HISTORY_SIZE) {
                    break;
                }
            }
        }
        return prices;
    }

    private publicQuote(quote: StoredQuote): MarketQuote {
        return {
            id: quote.id,
            name: quote.name,
            buyPrice: quote.buyPrice,
            sellPrice: quote.sellPrice,
            samples: quote.samples,
            source: quote.source
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

    private load(): void {
        try {
            const data: MarketCacheFile = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
            if (data.version !== 1 || !data.quotes) {
                return;
            }
            for (const [id, quote] of Object.entries(data.quotes)) {
                const objId: number = Number.parseInt(id, 10);
                if (Number.isSafeInteger(objId) && quote.id === objId && quote.buyPrice > 0 && quote.sellPrice > 0 && quote.fetchedAt > 0) {
                    this.quotes.set(objId, quote);
                }
            }
        } catch (_error) {
            // The first successful Lost City Markets lookup creates the local cache.
        }
    }

    private save(): void {
        const quotes: Record<string, StoredQuote> = {};
        for (const [id, quote] of this.quotes) {
            quotes[id] = quote;
        }
        const data: MarketCacheFile = { version: 1, quotes };
        fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
        fs.writeFileSync(this.cachePath, JSON.stringify(data, null, 2) + '\n');
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
