import type { ClientPlugin, ClientPluginContext, MenuEntry } from '#/plugins/PluginApi.js';
import { stripMenuTags } from '#/plugins/PluginApi.js';

const PREFERRED_ACTIONS = ['bank', 'use-quickly', 'exchange', 'collect'];

export default class MenuEntrySwapperPlugin implements ClientPlugin {
    readonly id: string = 'menu-entry-swapper';
    readonly name: string = 'Menu Entry Swapper';

    onBuildMenu(_ctx: ClientPluginContext, entries: MenuEntry[]): void {
        if (entries.length < 3 || this.hasActiveUseOrTarget(entries)) {
            return;
        }

        let preferredIndex: number = -1;
        for (let i: number = 0; i < entries.length; i++) {
            if (this.isPreferred(entries[i])) {
                preferredIndex = i;
            }
        }

        if (preferredIndex === -1 || preferredIndex === entries.length - 1) {
            return;
        }

        const preferred: MenuEntry = entries.splice(preferredIndex, 1)[0];
        entries.push(preferred);
    }

    private isPreferred(entry: MenuEntry): boolean {
        const option: string = stripMenuTags(entry.option).toLowerCase();
        for (const action of PREFERRED_ACTIONS) {
            if (option === action || option.startsWith(action + ' ')) {
                return true;
            }
        }

        return false;
    }

    private hasActiveUseOrTarget(entries: MenuEntry[]): boolean {
        const top: MenuEntry | undefined = entries[entries.length - 1];
        if (!top) {
            return false;
        }

        const option: string = stripMenuTags(top.option).toLowerCase();
        return option.includes(' with ') || option.startsWith('cast ');
    }
}
