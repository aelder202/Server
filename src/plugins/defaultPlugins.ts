import type { ClientPlugin } from '#/plugins/PluginApi.js';
import ExtendedCameraZoomPlugin from '#/plugins/ExtendedCameraZoomPlugin.js';
import ExtendedInactivityTimerPlugin from '#/plugins/ExtendedInactivityTimerPlugin.js';
import KeyRemappingPlugin from '#/plugins/KeyRemappingPlugin.js';
import MenuEntrySwapperPlugin from '#/plugins/MenuEntrySwapperPlugin.js';
import PickpocketLeftClickPlugin from '#/plugins/PickpocketLeftClickPlugin.js';
import TrueTilePlugin from '#/plugins/TrueTilePlugin.js';

export function createDefaultPlugins(): ClientPlugin[] {
    return [new ExtendedInactivityTimerPlugin(), new ExtendedCameraZoomPlugin(), new TrueTilePlugin(), new MenuEntrySwapperPlugin(), new PickpocketLeftClickPlugin(), new KeyRemappingPlugin()];
}
