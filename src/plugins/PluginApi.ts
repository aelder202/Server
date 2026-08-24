import Pix2D from '#/graphics/Pix2D.js';

export interface ScreenPoint {
    x: number;
    y: number;
}

export interface LocalPlayerPluginState {
    sceneX: number;
    sceneZ: number;
    tileX: number;
    tileZ: number;
    worldX: number;
    worldZ: number;
    level: number;
}

export interface MenuEntry {
    option: string;
    action: number;
    paramA: number;
    paramB: number;
    paramC: number;
}

export interface PluginSummary {
    id: string;
    name: string;
    enabled: boolean;
}

export interface ClientPlugin {
    id: string;
    name: string;
    enabledByDefault?: boolean;

    onStart?(ctx: ClientPluginContext): void;
    onStop?(ctx: ClientPluginContext): void;
    onGameTick?(ctx: ClientPluginContext): void;
    onBuildMenu?(ctx: ClientPluginContext, entries: MenuEntry[]): void;
    onBeforeAction?(ctx: ClientPluginContext, entry: MenuEntry): boolean | void;
    onDrawScene?(ctx: ClientPluginContext): void;
    onDrawOverlay?(ctx: ClientPluginContext): void;
    onKeyDown?(ctx: ClientPluginContext, ch: number, event: KeyboardEvent): number | null | void;
    onKeyUp?(ctx: ClientPluginContext, ch: number, event: KeyboardEvent): number | null | void;
    onMouseWheel?(ctx: ClientPluginContext, event: WheelEvent): boolean | void;
    onGameMessage?(ctx: ClientPluginContext, message: string): boolean | void;
    getChatInputHint?(ctx: ClientPluginContext): string | null;
}

export interface PluginClient {
    getPluginLocalPlayer(): LocalPlayerPluginState | null;
    projectPluginScenePoint(sceneX: number, sceneZ: number, height: number, level: number): ScreenPoint | null;
    setIdleLogoutDelayMs(delayMs: number): void;
    resetIdleLogoutDelayMs(): void;
    isChatInputRemappingAvailable(): boolean;
    getChatInputText(): string;
    clearChatInput(): void;
    requestRedrawChatback(): void;
    clearCameraInput(): void;
    adjustExtendedCameraZoom(deltaY: number): void;
    resetCameraZoom(): void;
    setRemoveRoofsEnabled(enabled: boolean): void;
    sendPluginServerCommand(command: string): void;
}

export function stripMenuTags(text: string): string {
    return text.replace(/@[a-z0-9]{3}@/gi, '').trim();
}

export class ClientPluginContext {
    constructor(private readonly client: PluginClient) {}

    getLocalPlayer(): LocalPlayerPluginState | null {
        return this.client.getPluginLocalPlayer();
    }

    projectScenePoint(sceneX: number, sceneZ: number, height: number, level: number): ScreenPoint | null {
        return this.client.projectPluginScenePoint(sceneX, sceneZ, height, level);
    }

    setIdleLogoutDelayMs(delayMs: number): void {
        this.client.setIdleLogoutDelayMs(delayMs);
    }

    resetIdleLogoutDelayMs(): void {
        this.client.resetIdleLogoutDelayMs();
    }

    isChatInputRemappingAvailable(): boolean {
        return this.client.isChatInputRemappingAvailable();
    }

    getChatInputText(): string {
        return this.client.getChatInputText();
    }

    clearChatInput(): void {
        this.client.clearChatInput();
    }

    requestRedrawChatback(): void {
        this.client.requestRedrawChatback();
    }

    clearCameraInput(): void {
        this.client.clearCameraInput();
    }

    adjustExtendedCameraZoom(deltaY: number): void {
        this.client.adjustExtendedCameraZoom(deltaY);
    }

    resetCameraZoom(): void {
        this.client.resetCameraZoom();
    }

    setRemoveRoofsEnabled(enabled: boolean): void {
        this.client.setRemoveRoofsEnabled(enabled);
    }

    sendServerCommand(command: string): void {
        this.client.sendPluginServerCommand(command);
    }

    drawTileOutline(tileX: number, tileZ: number, level: number, rgb: number, inset: number = 2): boolean {
        const minX: number = (tileX << 7) + inset;
        const minZ: number = (tileZ << 7) + inset;
        const maxX: number = ((tileX + 1) << 7) - inset;
        const maxZ: number = ((tileZ + 1) << 7) - inset;

        const nw: ScreenPoint | null = this.projectScenePoint(minX, minZ, 0, level);
        const ne: ScreenPoint | null = this.projectScenePoint(maxX, minZ, 0, level);
        const se: ScreenPoint | null = this.projectScenePoint(maxX, maxZ, 0, level);
        const sw: ScreenPoint | null = this.projectScenePoint(minX, maxZ, 0, level);

        if (!nw || !ne || !se || !sw) {
            return false;
        }

        this.drawLine(nw.x, nw.y, ne.x, ne.y, rgb);
        this.drawLine(ne.x, ne.y, se.x, se.y, rgb);
        this.drawLine(se.x, se.y, sw.x, sw.y, rgb);
        this.drawLine(sw.x, sw.y, nw.x, nw.y, rgb);
        return true;
    }

    drawLine(x0: number, y0: number, x1: number, y1: number, rgb: number): void {
        if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
            return;
        }

        x0 |= 0;
        y0 |= 0;
        x1 |= 0;
        y1 |= 0;

        const dx: number = Math.abs(x1 - x0);
        const dy: number = Math.abs(y1 - y0);
        if (dx > 4096 || dy > 4096) {
            return;
        }

        const sx: number = x0 < x1 ? 1 : -1;
        const sy: number = y0 < y1 ? 1 : -1;
        let err: number = dx - dy;

        for (;;) {
            if (x0 >= Pix2D.clipMinX && x0 < Pix2D.clipMaxX && y0 >= Pix2D.clipMinY && y0 < Pix2D.clipMaxY) {
                Pix2D.pixels[x0 + y0 * Pix2D.width] = rgb;
            }

            if (x0 === x1 && y0 === y1) {
                break;
            }

            const e2: number = err << 1;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }
}
