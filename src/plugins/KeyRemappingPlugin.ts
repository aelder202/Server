import type { ClientPlugin, ClientPluginContext } from '#/plugins/PluginApi.js';

const KEY_ENTER = 10;
const KEY_ESCAPE = 27;
const KEY_BACKSPACE = 8;
const KEY_ARROW_LEFT = 1;
const KEY_ARROW_RIGHT = 2;
const KEY_ARROW_UP = 3;
const KEY_ARROW_DOWN = 4;

const WASD_CAMERA_KEYS: Map<number, number> = new Map([
    ['a'.charCodeAt(0), KEY_ARROW_LEFT],
    ['A'.charCodeAt(0), KEY_ARROW_LEFT],
    ['d'.charCodeAt(0), KEY_ARROW_RIGHT],
    ['D'.charCodeAt(0), KEY_ARROW_RIGHT],
    ['w'.charCodeAt(0), KEY_ARROW_UP],
    ['W'.charCodeAt(0), KEY_ARROW_UP],
    ['s'.charCodeAt(0), KEY_ARROW_DOWN],
    ['S'.charCodeAt(0), KEY_ARROW_DOWN]
]);

export default class KeyRemappingPlugin implements ClientPlugin {
    readonly id: string = 'key-remapping';
    readonly name: string = 'WASD Camera / Enter to Chat';

    private chatUnlocked: boolean = false;
    private readonly heldCameraRemaps: Set<number> = new Set();

    onStart(ctx: ClientPluginContext): void {
        this.chatUnlocked = false;
        this.heldCameraRemaps.clear();
        ctx.requestRedrawChatback();
    }

    onStop(ctx: ClientPluginContext): void {
        this.chatUnlocked = false;
        this.heldCameraRemaps.clear();
        ctx.clearCameraInput();
        ctx.requestRedrawChatback();
    }

    onKeyDown(ctx: ClientPluginContext, ch: number, _event: KeyboardEvent): number | null {
        if (!ctx.isChatInputRemappingAvailable()) {
            return ch;
        }

        if (this.chatUnlocked) {
            if (ch === KEY_ENTER && ctx.getChatInputText().length === 0) {
                this.lockChat(ctx);
                return null;
            }

            if (ch === KEY_ENTER && ctx.getChatInputText().length > 0) {
                this.lockChat(ctx);
            } else if (ch === KEY_ESCAPE) {
                this.lockChat(ctx);
                return null;
            }

            return ch;
        }

        if (ch === KEY_ENTER) {
            this.chatUnlocked = true;
            ctx.requestRedrawChatback();
            return null;
        }

        const cameraKey: number | undefined = WASD_CAMERA_KEYS.get(ch);
        if (cameraKey !== undefined) {
            this.heldCameraRemaps.add(cameraKey);
            return cameraKey;
        }

        if (this.isChatInputKey(ch)) {
            return null;
        }

        return ch;
    }

    onKeyUp(ctx: ClientPluginContext, ch: number, _event: KeyboardEvent): number | null {
        const cameraKey: number | undefined = WASD_CAMERA_KEYS.get(ch);
        if (cameraKey !== undefined && this.heldCameraRemaps.has(cameraKey)) {
            this.heldCameraRemaps.delete(cameraKey);
            return cameraKey;
        }

        if (!ctx.isChatInputRemappingAvailable()) {
            return ch;
        }

        if (!this.chatUnlocked && this.isChatInputKey(ch)) {
            return null;
        }

        return ch;
    }

    getChatInputHint(ctx: ClientPluginContext): string | null {
        if (!ctx.isChatInputRemappingAvailable() || this.chatUnlocked) {
            return null;
        }

        return 'Press Enter to chat...';
    }

    private lockChat(ctx: ClientPluginContext): void {
        this.chatUnlocked = false;
        ctx.requestRedrawChatback();
    }

    private isChatInputKey(ch: number): boolean {
        return (ch >= 32 && ch <= 126) || ch === KEY_BACKSPACE;
    }
}
