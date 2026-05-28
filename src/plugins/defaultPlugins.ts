import type { ClientPlugin } from '#/plugins/PluginApi.js';
import ExtendedInactivityTimerPlugin from '#/plugins/ExtendedInactivityTimerPlugin.js';
import KeyRemappingPlugin from '#/plugins/KeyRemappingPlugin.js';
import MenuEntrySwapperPlugin from '#/plugins/MenuEntrySwapperPlugin.js';
import TrueTilePlugin from '#/plugins/TrueTilePlugin.js';

export function createDefaultPlugins(): ClientPlugin[] {
    return [new ExtendedInactivityTimerPlugin(), new TrueTilePlugin(), new MenuEntrySwapperPlugin(), new KeyRemappingPlugin()];
}
