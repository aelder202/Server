import type { ClientPlugin, ClientPluginContext, LocalPlayerPluginState } from '#/plugins/PluginApi.js';

export default class TrueTilePlugin implements ClientPlugin {
    readonly id: string = 'true-tile';
    readonly name: string = 'True Tile';

    onDrawScene(ctx: ClientPluginContext): void {
        const player: LocalPlayerPluginState | null = ctx.getLocalPlayer();
        if (!player) {
            return;
        }

        ctx.drawTileOutline(player.tileX, player.tileZ, player.level, 0x00ffff);
    }
}
