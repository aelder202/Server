import { type ClientPlugin, ClientPluginContext, type MenuEntry, type PluginSummary } from '#/plugins/PluginApi.js';

interface RegisteredPlugin {
    plugin: ClientPlugin;
    enabled: boolean;
    started: boolean;
}

export default class PluginManager {
    private readonly plugins: Map<string, RegisteredPlugin> = new Map();

    constructor(private readonly ctx: ClientPluginContext) {}

    register(...plugins: ClientPlugin[]): void {
        for (const plugin of plugins) {
            if (this.plugins.has(plugin.id)) {
                throw new Error(`Duplicate plugin id: ${plugin.id}`);
            }

            this.plugins.set(plugin.id, {
                plugin,
                enabled: this.readEnabled(plugin),
                started: false
            });
        }
    }

    startAll(): void {
        for (const plugin of this.plugins.values()) {
            if (plugin.enabled) {
                this.start(plugin);
            }
        }
    }

    get(id: string): ClientPlugin | null {
        return this.plugins.get(id)?.plugin ?? null;
    }

    find(query: string): ClientPlugin | null {
        const normalizedQuery: string = this.normalizeLookup(query);
        if (!normalizedQuery) {
            return null;
        }

        const plugins: ClientPlugin[] = Array.from(this.plugins.values(), plugin => plugin.plugin);
        const exact: ClientPlugin | undefined = plugins.find(plugin => plugin.id.toLowerCase() === query.toLowerCase())
            ?? plugins.find(plugin => this.normalizeLookup(plugin.id) === normalizedQuery || this.normalizeLookup(plugin.name) === normalizedQuery);

        if (exact) {
            return exact;
        }

        const prefixMatches: ClientPlugin[] = plugins.filter(plugin => (
            this.normalizeLookup(plugin.id).startsWith(normalizedQuery) ||
            this.normalizeLookup(plugin.name).startsWith(normalizedQuery)
        ));

        if (prefixMatches.length === 1) {
            return prefixMatches[0];
        }

        const containsMatches: ClientPlugin[] = plugins.filter(plugin => (
            this.normalizeLookup(plugin.id).includes(normalizedQuery) ||
            this.normalizeLookup(plugin.name).includes(normalizedQuery)
        ));

        return containsMatches.length === 1 ? containsMatches[0] : null;
    }

    summaries(): PluginSummary[] {
        return Array.from(this.plugins.values(), plugin => ({
            id: plugin.plugin.id,
            name: plugin.plugin.name,
            enabled: plugin.enabled
        }));
    }

    setEnabled(id: string, enabled: boolean): boolean | null {
        const plugin: RegisteredPlugin | undefined = this.plugins.get(id);
        if (!plugin) {
            return null;
        }

        if (plugin.enabled === enabled) {
            return plugin.enabled;
        }

        plugin.enabled = enabled;
        this.writeEnabled(plugin.plugin.id, enabled);

        if (enabled) {
            this.start(plugin);
        } else {
            this.stop(plugin);
        }

        return plugin.enabled;
    }

    toggle(id: string): boolean | null {
        const plugin: RegisteredPlugin | undefined = this.plugins.get(id);
        if (!plugin) {
            return null;
        }

        return this.setEnabled(id, !plugin.enabled);
    }

    onGameTick(): void {
        this.eachEnabled(plugin => plugin.onGameTick?.(this.ctx));
    }

    onBuildMenu(entries: MenuEntry[]): void {
        this.eachEnabled(plugin => plugin.onBuildMenu?.(this.ctx, entries));
    }

    onBeforeAction(entry: MenuEntry): boolean {
        for (const plugin of this.plugins.values()) {
            if (!plugin.enabled || !plugin.started || !plugin.plugin.onBeforeAction) {
                continue;
            }

            try {
                if (plugin.plugin.onBeforeAction(this.ctx, entry) === false) {
                    return false;
                }
            } catch (e) {
                console.warn(`Plugin ${plugin.plugin.id} failed in onBeforeAction`, e);
            }
        }

        return true;
    }

    onDrawScene(): void {
        this.eachEnabled(plugin => plugin.onDrawScene?.(this.ctx));
    }

    onDrawOverlay(): void {
        this.eachEnabled(plugin => plugin.onDrawOverlay?.(this.ctx));
    }

    onKeyDown(ch: number, event: KeyboardEvent): number | null {
        return this.mapKey(ch, event, (plugin, input) => plugin.onKeyDown?.(this.ctx, input, event));
    }

    onKeyUp(ch: number, event: KeyboardEvent): number | null {
        return this.mapKey(ch, event, (plugin, input) => plugin.onKeyUp?.(this.ctx, input, event));
    }

    getChatInputHint(): string | null {
        for (const plugin of this.plugins.values()) {
            if (!plugin.enabled || !plugin.started || !plugin.plugin.getChatInputHint) {
                continue;
            }

            try {
                const hint: string | null = plugin.plugin.getChatInputHint(this.ctx);
                if (hint) {
                    return hint;
                }
            } catch (e) {
                console.warn(`Plugin ${plugin.plugin.id} failed in getChatInputHint`, e);
            }
        }

        return null;
    }

    private start(plugin: RegisteredPlugin): void {
        if (plugin.started) {
            return;
        }

        plugin.started = true;
        try {
            plugin.plugin.onStart?.(this.ctx);
        } catch (e) {
            console.warn(`Plugin ${plugin.plugin.id} failed in onStart`, e);
        }
    }

    private stop(plugin: RegisteredPlugin): void {
        if (!plugin.started) {
            return;
        }

        plugin.started = false;
        try {
            plugin.plugin.onStop?.(this.ctx);
        } catch (e) {
            console.warn(`Plugin ${plugin.plugin.id} failed in onStop`, e);
        }
    }

    private eachEnabled(fn: (plugin: ClientPlugin) => void): void {
        for (const plugin of this.plugins.values()) {
            if (!plugin.enabled || !plugin.started) {
                continue;
            }

            try {
                fn(plugin.plugin);
            } catch (e) {
                console.warn(`Plugin ${plugin.plugin.id} failed`, e);
            }
        }
    }

    private mapKey(ch: number, event: KeyboardEvent, fn: (plugin: ClientPlugin, input: number) => number | null | void): number | null {
        let mapped: number | null = ch;
        for (const plugin of this.plugins.values()) {
            if (!plugin.enabled || !plugin.started || mapped === null) {
                continue;
            }

            try {
                const next: number | null | void = fn(plugin.plugin, mapped);
                if (typeof next === 'number' || next === null) {
                    mapped = next;
                }
            } catch (e) {
                console.warn(`Plugin ${plugin.plugin.id} failed in key handler`, e);
            }
        }

        return mapped;
    }

    private readEnabled(plugin: ClientPlugin): boolean {
        const fallback: boolean = plugin.enabledByDefault !== false;

        try {
            const stored: string | null = globalThis.localStorage?.getItem(this.storageKey(plugin.id)) ?? null;
            if (stored === null) {
                return fallback;
            }

            return stored === 'true';
        } catch (_e) {
            return fallback;
        }
    }

    private writeEnabled(id: string, enabled: boolean): void {
        try {
            globalThis.localStorage?.setItem(this.storageKey(id), enabled ? 'true' : 'false');
        } catch (_e) {
            // localStorage can be unavailable in restricted browser modes.
        }
    }

    private storageKey(id: string): string {
        return `lostcity.plugin.${id}.enabled`;
    }

    private normalizeLookup(text: string): string {
        return text.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
}
