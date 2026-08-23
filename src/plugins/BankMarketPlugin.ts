import type { ClientPlugin, ClientPluginContext, MenuEntry } from '#/plugins/PluginApi.js';
import { stripMenuTags } from '#/plugins/PluginApi.js';

const MARKET_ACTION = 10_001;
const MARKET_MESSAGE_PREFIX = '__BANK_MARKET__';
const MAX_AMOUNT = 10_000;

type MarketResult = {
    type: 'result';
    id: number;
    name: string;
    buyPrice: number;
    sellPrice: number;
    samples: number;
};

type MarketPayload =
    | { type: 'open' }
    | { type: 'clear'; query: string }
    | MarketResult
    | { type: 'done'; count: number; total: number }
    | { type: 'notice'; success: boolean; message: string };

export default class BankMarketPlugin implements ClientPlugin {
    readonly id: string = 'bank-market';
    readonly name: string = 'Bank Market';

    private ctx: ClientPluginContext | null = null;
    private overlay: HTMLDivElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private amountInput: HTMLInputElement | null = null;
    private results: HTMLDivElement | null = null;
    private status: HTMLDivElement | null = null;
    private searchTimer: ReturnType<typeof setTimeout> | null = null;
    private currentQuery: string = '';
    private resultCount: number = 0;

    onStart(ctx: ClientPluginContext): void {
        this.ctx = ctx;
        this.installUi();
    }

    onStop(_ctx: ClientPluginContext): void {
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
            this.searchTimer = null;
        }
        this.overlay?.remove();
        this.overlay = null;
        this.ctx = null;
    }

    onBuildMenu(_ctx: ClientPluginContext, entries: MenuEntry[]): void {
        if (entries.some(entry => entry.action === MARKET_ACTION)) {
            return;
        }

        let bankIndex: number = -1;
        for (let i: number = 0; i < entries.length; i++) {
            const option: string = stripMenuTags(entries[i].option).toLowerCase();
            if (option.startsWith('bank ') && option.includes('banker')) {
                bankIndex = i;
            }
        }
        if (bankIndex === -1) {
            return;
        }

        const bank: MenuEntry = entries[bankIndex];
        entries.splice(bankIndex, 0, {
            option: bank.option.replace(/^Bank\b/i, 'Market'),
            action: MARKET_ACTION,
            paramA: bank.paramA,
            paramB: bank.paramB,
            paramC: bank.paramC
        });
    }

    onBeforeAction(_ctx: ClientPluginContext, entry: MenuEntry): boolean {
        if (entry.action !== MARKET_ACTION) {
            return true;
        }

        this.open();
        return false;
    }

    onGameMessage(_ctx: ClientPluginContext, message: string): boolean {
        if (!message.startsWith(MARKET_MESSAGE_PREFIX)) {
            return false;
        }

        try {
            const payload: MarketPayload = JSON.parse(message.substring(MARKET_MESSAGE_PREFIX.length));
            this.handlePayload(payload);
        } catch (error) {
            console.warn('Unable to read Bank Market response', error);
        }
        return true;
    }

    private installUi(): void {
        if (document.getElementById('lostcity-bank-market')) {
            return;
        }

        const style: HTMLStyleElement = document.createElement('style');
        style.textContent = `
            #lostcity-bank-market { position: fixed; inset: 0; z-index: 10020; display: none; place-items: center; background: rgba(0,0,0,.72); font: 14px Arial,sans-serif; color: #f2e8ca; }
            #lostcity-bank-market.open { display: grid; }
            #lostcity-bank-market .market-card { width: min(760px, calc(100vw - 32px)); max-height: min(720px, calc(100vh - 32px)); display: flex; flex-direction: column; overflow: hidden; border: 2px solid #7d6948; border-radius: 8px; background: #201b15; box-shadow: 0 16px 60px #000; }
            #lostcity-bank-market .market-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #30271d; border-bottom: 1px solid #6b583d; }
            #lostcity-bank-market h2 { margin: 0; flex: 1; font-size: 20px; color: #ffd76a; }
            #lostcity-bank-market button { border: 1px solid #8b754f; border-radius: 4px; background: #443722; color: #fff2c8; padding: 7px 11px; cursor: pointer; }
            #lostcity-bank-market button:hover { background: #5a482c; }
            #lostcity-bank-market .market-controls { display: grid; grid-template-columns: 1fr 125px; gap: 10px; padding: 12px 16px; }
            #lostcity-bank-market input { box-sizing: border-box; width: 100%; border: 1px solid #7d6948; border-radius: 4px; background: #100e0b; color: white; padding: 9px 10px; }
            #lostcity-bank-market .market-help, #lostcity-bank-market .market-status { padding: 0 16px 10px; color: #c7b997; }
            #lostcity-bank-market .market-results { overflow: auto; padding: 0 12px 14px; }
            #lostcity-bank-market .market-row { display: grid; grid-template-columns: minmax(170px,1fr) 115px 115px 72px 72px; align-items: center; gap: 8px; padding: 9px 4px; border-top: 1px solid #413625; }
            #lostcity-bank-market .market-name { font-weight: bold; color: #fff; }
            #lostcity-bank-market .market-source { display: block; margin-top: 2px; font-size: 11px; font-weight: normal; color: #a99673; }
            #lostcity-bank-market .market-price { text-align: right; color: #ffd76a; }
            #lostcity-bank-market .market-notice-ok { color: #8fe38f; }
            #lostcity-bank-market .market-notice-error { color: #ff9990; }
            @media (max-width: 650px) { #lostcity-bank-market .market-row { grid-template-columns: 1fr 1fr; } #lostcity-bank-market .market-price { text-align: left; } }
        `;
        document.head.appendChild(style);

        this.overlay = document.createElement('div');
        this.overlay.id = 'lostcity-bank-market';
        this.overlay.innerHTML = `
            <section class="market-card" role="dialog" aria-modal="true" aria-label="Bank Market">
                <header class="market-head"><h2>Bank Market</h2><button type="button" data-market-close>Close</button></header>
                <div class="market-controls">
                    <input type="search" data-market-search placeholder="Search all tradeable items…" maxlength="48" aria-label="Search market items">
                    <input type="number" data-market-amount min="1" max="${MAX_AMOUNT}" value="1" aria-label="Trade amount">
                </div>
                <div class="market-help">Prices use the last five direct player trades after three sales are recorded; until then they use the original 2004 item value.</div>
                <div class="market-status" aria-live="polite">Search for an item to begin.</div>
                <div class="market-results"></div>
            </section>
        `;
        document.body.appendChild(this.overlay);

        this.searchInput = this.overlay.querySelector('[data-market-search]');
        this.amountInput = this.overlay.querySelector('[data-market-amount]');
        this.results = this.overlay.querySelector('.market-results');
        this.status = this.overlay.querySelector('.market-status');

        this.overlay.querySelector('[data-market-close]')?.addEventListener('click', () => this.close());
        this.overlay.addEventListener('mousedown', event => {
            if (event.target === this.overlay) {
                this.close();
            }
        });
        this.searchInput?.addEventListener('input', () => this.queueSearch());
        this.overlay.addEventListener('click', event => this.handleClick(event));
        this.overlay.addEventListener('keydown', event => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
            }
        });
    }

    private open(): void {
        this.installUi();
        this.overlay?.classList.add('open');
        this.searchInput?.focus();
        this.search();
    }

    private close(): void {
        this.overlay?.classList.remove('open');
    }

    private queueSearch(): void {
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
        }
        this.searchTimer = setTimeout(() => this.search(), 180);
    }

    private search(): void {
        this.searchTimer = null;
        this.currentQuery = this.searchInput?.value.trim() ?? '';
        this.resultCount = 0;
        if (this.results) {
            this.results.replaceChildren();
        }
        this.setStatus('Searching…');
        this.ctx?.sendServerCommand(`market search ${this.currentQuery}`.trim());
    }

    private handleClick(event: Event): void {
        const target: HTMLElement | null = event.target instanceof HTMLElement ? event.target.closest('[data-market-action]') : null;
        if (!target) {
            return;
        }

        const action: string | undefined = target.dataset.marketAction;
        const id: number = Number.parseInt(target.dataset.marketId ?? '', 10);
        const amount: number = Math.max(1, Math.min(MAX_AMOUNT, Number.parseInt(this.amountInput?.value ?? '1', 10) || 1));
        if ((action === 'buy' || action === 'sell') && Number.isSafeInteger(id)) {
            this.setStatus(`${action === 'buy' ? 'Buying' : 'Selling'}…`);
            this.ctx?.sendServerCommand(`market ${action} ${id} ${amount}`);
        }
    }

    private handlePayload(payload: MarketPayload): void {
        if (payload.type === 'open') {
            this.open();
            return;
        }
        if (payload.type === 'clear') {
            this.currentQuery = payload.query;
            this.resultCount = 0;
            this.results?.replaceChildren();
            return;
        }
        if (payload.type === 'result') {
            this.appendResult(payload);
            return;
        }
        if (payload.type === 'done') {
            this.setStatus(payload.total > payload.count ? `Showing ${payload.count} of ${payload.total} matches. Refine your search for more.` : `${payload.count} item${payload.count === 1 ? '' : 's'} found.`);
            return;
        }
        if (payload.type === 'notice') {
            this.setStatus(payload.message, payload.success);
            if (payload.success) {
                setTimeout(() => this.search(), 250);
            }
        }
    }

    private appendResult(result: MarketResult): void {
        if (!this.results) {
            return;
        }

        this.resultCount++;
        const row: HTMLDivElement = document.createElement('div');
        row.className = 'market-row';
        const source: string = result.samples >= 3 ? `average of ${result.samples} recent trades` : `2004 value · ${result.samples}/3 trades recorded`;
        row.innerHTML = `
            <div class="market-name"></div>
            <div class="market-price">Buy: ${this.formatCoins(result.buyPrice)} gp</div>
            <div class="market-price">Sell: ${this.formatCoins(result.sellPrice)} gp</div>
            <button type="button" data-market-action="buy" data-market-id="${result.id}">Buy</button>
            <button type="button" data-market-action="sell" data-market-id="${result.id}">Sell</button>
        `;
        const name: HTMLElement = row.querySelector('.market-name')!;
        name.textContent = result.name;
        const sourceNode: HTMLSpanElement = document.createElement('span');
        sourceNode.className = 'market-source';
        sourceNode.textContent = source;
        name.appendChild(sourceNode);
        this.results.appendChild(row);
    }

    private setStatus(message: string, success?: boolean): void {
        if (!this.status) {
            return;
        }
        this.status.textContent = message;
        this.status.className = 'market-status';
        if (success === true) {
            this.status.classList.add('market-notice-ok');
        } else if (success === false) {
            this.status.classList.add('market-notice-error');
        }
    }

    private formatCoins(value: number): string {
        return new Intl.NumberFormat('en-US').format(value);
    }
}
