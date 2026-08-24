import type { ClientPlugin, ClientPluginContext, MenuEntry } from '#/plugins/PluginApi.js';
import { stripMenuTags } from '#/plugins/PluginApi.js';

export type ShopBuyQuantity = 1 | 5 | 10;

const STORAGE_KEY = 'lostcity.plugin.shop-left-click.quantity';

export default class ShopLeftClickPlugin implements ClientPlugin {
    readonly id: string = 'shop-left-click';
    readonly name: string = 'Shop Left-Click';
    readonly enabledByDefault: boolean = true;

    private quantity: ShopBuyQuantity = 1;

    onStart(_ctx: ClientPluginContext): void {
        try {
            const stored: number = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) ?? '', 10);
            if (this.isQuantity(stored)) {
                this.quantity = stored;
            }
        } catch (_e) {
            // Storage can be unavailable in privacy-restricted browser contexts.
        }
    }

    onBuildMenu(_ctx: ClientPluginContext, entries: MenuEntry[]): void {
        if (entries.length < 3 || this.hasActiveUseOrTarget(entries)) {
            return;
        }

        const desiredAction: string = `buy ${this.quantity}`;
        let desiredIndex: number = -1;
        for (let i: number = 0; i < entries.length; i++) {
            if (this.optionName(entries[i]) === desiredAction) {
                desiredIndex = i;
            }
        }

        if (desiredIndex === -1 || desiredIndex === entries.length - 1) {
            return;
        }

        const desired: MenuEntry = entries.splice(desiredIndex, 1)[0];
        entries.push(desired);
    }

    getQuantity(): ShopBuyQuantity {
        return this.quantity;
    }

    setQuantity(quantity: number): quantity is ShopBuyQuantity {
        if (!this.isQuantity(quantity)) {
            return false;
        }

        this.quantity = quantity;
        try {
            window.localStorage.setItem(STORAGE_KEY, String(quantity));
        } catch (_e) {
            // Keep the preference for this session when persistent storage fails.
        }
        return true;
    }

    private optionName(entry: MenuEntry): string {
        return stripMenuTags(entry.option).toLowerCase().split(/\s+/).slice(0, 2).join(' ');
    }

    private hasActiveUseOrTarget(entries: MenuEntry[]): boolean {
        const top: MenuEntry | undefined = entries[entries.length - 1];
        if (!top) {
            return false;
        }

        const option: string = stripMenuTags(top.option).toLowerCase();
        return option.includes(' with ') || option.startsWith('cast ');
    }

    private isQuantity(quantity: number): quantity is ShopBuyQuantity {
        return quantity === 1 || quantity === 5 || quantity === 10;
    }
}
