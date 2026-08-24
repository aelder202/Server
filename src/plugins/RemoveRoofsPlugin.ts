import type { ClientPlugin, ClientPluginContext } from '#/plugins/PluginApi.js';

export default class RemoveRoofsPlugin implements ClientPlugin {
    readonly id: string = 'remove-roofs';
    readonly name: string = 'Remove Roofs';
    readonly enabledByDefault: boolean = false;

    onStart(ctx: ClientPluginContext): void {
        ctx.setRemoveRoofsEnabled(true);
    }

    onStop(ctx: ClientPluginContext): void {
        ctx.setRemoveRoofsEnabled(false);
    }
}
