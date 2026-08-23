import type { ClientPlugin, ClientPluginContext, MenuEntry } from '#/plugins/PluginApi.js';
import { stripMenuTags } from '#/plugins/PluginApi.js';

export default class PickpocketLeftClickPlugin implements ClientPlugin {
    readonly id: string = 'pickpocket-left-click';
    readonly name: string = 'Pickpocket Left-Click';
    readonly enabledByDefault: boolean = false;

    onBuildMenu(_ctx: ClientPluginContext, entries: MenuEntry[]): void {
        if (entries.length < 3 || this.hasActiveUseOrTarget(entries)) {
            return;
        }

        let pickpocketIndex: number = -1;
        for (let i = 0; i < entries.length; i++) {
            if (this.optionName(entries[i]) === 'pickpocket') {
                pickpocketIndex = i;
            }
        }

        if (pickpocketIndex === -1 || pickpocketIndex === entries.length - 1) {
            return;
        }

        const pickpocket: MenuEntry = entries.splice(pickpocketIndex, 1)[0];
        entries.push(pickpocket);
    }

    private optionName(entry: MenuEntry): string {
        return stripMenuTags(entry.option).split(' ')[0]?.toLowerCase() ?? '';
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
