import type { ClientPlugin, ClientPluginContext } from '#/plugins/PluginApi.js';

const EXTENDED_IDLE_LOGOUT_DELAY_MS = 24 * 60 * 60 * 1000;

export default class ExtendedInactivityTimerPlugin implements ClientPlugin {
    readonly id: string = 'extended-inactivity-timer';
    readonly name: string = 'Extended Inactivity Timer';

    onStart(ctx: ClientPluginContext): void {
        ctx.setIdleLogoutDelayMs(EXTENDED_IDLE_LOGOUT_DELAY_MS);
    }

    onStop(ctx: ClientPluginContext): void {
        ctx.resetIdleLogoutDelayMs();
    }
}
