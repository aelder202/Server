import type { ClientPlugin, ClientPluginContext } from '#/plugins/PluginApi.js';

export default class ExtendedCameraZoomPlugin implements ClientPlugin {
    readonly id: string = 'extended-camera-zoom';
    readonly name: string = 'Extended Camera Zoom';

    onStop(ctx: ClientPluginContext): void {
        ctx.resetCameraZoom();
    }

    onMouseWheel(ctx: ClientPluginContext, event: WheelEvent): boolean {
        if (event.deltaY === 0) {
            return false;
        }

        ctx.adjustExtendedCameraZoom(event.deltaY);
        return true;
    }
}
