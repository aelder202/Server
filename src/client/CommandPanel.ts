import type { PluginSummary } from '#/plugins/PluginApi.js';

export interface CommandPanelHost {
    listPlugins(): PluginSummary[];
    runCommand(input: string): Promise<boolean>;
}

type CommandButton = {
    label: string;
    command: string;
    description: string;
    mode: 'run' | 'fill';
    tags?: string[];
};

const WASD_CAMERA_PLUGIN_ID = 'key-remapping';

const CLIENT_COMMANDS: CommandButton[] = [
    { label: 'List plugins', command: '::plugins', description: 'Show plugin states in chat.', mode: 'run' },
    { label: 'WASD camera on', command: `::plugin ${WASD_CAMERA_PLUGIN_ID} on`, description: 'Use WASD for the camera and Enter to focus chat.', mode: 'run', tags: ['camera', 'chat', 'qol'] },
    { label: 'WASD camera off', command: `::plugin ${WASD_CAMERA_PLUGIN_ID} off`, description: 'Restore the original always-ready chat controls.', mode: 'run', tags: ['camera', 'chat', 'qol'] },
    { label: 'FPS on', command: '::fpson', description: 'Show the FPS counter.', mode: 'run' },
    { label: 'FPS off', command: '::fpsoff', description: 'Hide the FPS counter.', mode: 'run' },
    { label: 'Set FPS target', command: '::fps <target>', description: 'Set the client target framerate.', mode: 'fill' },
    { label: 'Client drop', command: '::clientdrop', description: 'Force a client reconnect test.', mode: 'run', tags: ['staff 2'] },
    { label: 'Prefetch music', command: '::prefetchmusic', description: 'Queue all music files for prefetch.', mode: 'run', tags: ['staff 2'] },
    { label: 'Lag stats', command: '::lag', description: 'Print client timing diagnostics to the console.', mode: 'run', tags: ['staff 2'] }
];

const SERVER_COMMANDS: CommandButton[] = [
    { label: 'Bot stock', command: '::botstock', description: 'Refresh the nearby adventurer bot resource list.', mode: 'run', tags: ['living world'] },
    { label: 'Buy from bot', command: '::botbuy <item> <amount>', description: 'Buy gathered resources from the adventurer bot you traded with.', mode: 'fill', tags: ['living world'] },
    { label: 'Get coord', command: '::getcoord', description: 'Display your current coordinate.', mode: 'fill', tags: ['staff 2'] },
    { label: 'Teleport list', command: '::teles', description: 'Show teleport favorites.', mode: 'fill', tags: ['staff 2'] },
    { label: 'Teleport favorite', command: '::telefav <name>', description: 'Teleport to a named favorite.', mode: 'fill', tags: ['staff 2'] },
    { label: 'Teleport favorite alias', command: '::tp <name>', description: 'Teleport to a named favorite.', mode: 'fill', tags: ['staff 2'] },
    { label: 'Teleport coordinate', command: '::tele <level,mapX,mapZ[,tileX,tileZ]>', description: 'Teleport to an explicit coordinate.', mode: 'fill', tags: ['staff 2'] },
    { label: 'Teleport to player', command: '::teleto <username>', description: 'Teleport to another player.', mode: 'fill', tags: ['staff 2', 'production'] },
    { label: 'Teleport other', command: '::teleother <username>', description: 'Teleport another player to you.', mode: 'fill', tags: ['staff 3', 'production'] },
    { label: 'Set visibility', command: '::setvis <0|1|2>', description: 'Set staff visibility level.', mode: 'fill', tags: ['staff 2', 'production'] },
    { label: 'Ban', command: '::ban <username> <minutes>', description: 'Temporarily ban a player.', mode: 'fill', tags: ['staff 2', 'production'] },
    { label: 'Mute', command: '::mute <username> <minutes>', description: 'Temporarily mute a player.', mode: 'fill', tags: ['staff 2', 'production'] },
    { label: 'Kick', command: '::kick <username>', description: 'Kick a player from the game.', mode: 'fill', tags: ['staff 2', 'production'] },
    { label: 'XP rate', command: '::xprate <rate>', description: 'Set the world XP multiplier.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Living world', command: '::life [on|off|status]', description: 'Enable, disable, or inspect adventurer bots.', mode: 'fill', tags: ['staff 3', 'living world'] },
    { label: 'Bot population', command: '::botcount <0-1000>', description: 'Set the active adventurer bot population target.', mode: 'fill', tags: ['staff 3', 'living world'] },
    { label: 'Infinite run', command: '::infrun [on|off]', description: 'Toggle infinite run energy.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Infinite run alias', command: '::infiniterun [on|off]', description: 'Toggle infinite run energy.', mode: 'fill', tags: ['staff 3'] },
    { label: 'God mode', command: '::god [on|off]', description: 'Toggle god mode.', mode: 'fill', tags: ['staff 3'] },
    { label: 'God mode alias', command: '::godmode [on|off]', description: 'Toggle god mode.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Run speed', command: '::runspeed [multiplier|off]', description: 'Change world run speed.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Set var', command: '::setvar <variable> <value>', description: 'Set a player variable or varbit.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Set var other', command: '::setvarother <username> <variable> <value>', description: 'Set another player variable.', mode: 'fill', tags: ['staff 3', 'production'] },
    { label: 'Get var', command: '::getvar <variable>', description: 'Read a player variable or varbit.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Get var other', command: '::getvarother <username> <variable>', description: 'Read another player variable.', mode: 'fill', tags: ['staff 3', 'production'] },
    { label: 'Give item', command: '::give <item> [amount]', description: 'Add an item to your inventory.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Give item other', command: '::giveother <username> <item> [amount]', description: 'Add an item to another inventory.', mode: 'fill', tags: ['staff 3', 'production'] },
    { label: 'Give random inventory', command: '::givecrap', description: 'Fill inventory with random items.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Give many', command: '::givemany <item>', description: 'Add up to 1000 of an item.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Broadcast', command: '::broadcast <message>', description: 'Broadcast a world message.', mode: 'fill', tags: ['staff 3', 'production'] },
    { label: 'Reboot', command: '::reboot', description: 'Reboot the world.', mode: 'fill', tags: ['staff 3', 'production'] },
    { label: 'Slow reboot', command: '::slowreboot <seconds>', description: 'Schedule a world reboot.', mode: 'fill', tags: ['staff 3', 'production'] },
    { label: 'Server drop', command: '::serverdrop', description: 'Terminate your server session.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Set stat', command: '::setstat <skill> <level>', description: 'Set a skill level.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Advance stat', command: '::advancestat <skill> <level>', description: 'Advance a skill and trigger level-up behavior.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Min stats', command: '::minme', description: 'Set stats to minimum values.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Add location', command: '::locadd <loc>', description: 'Spawn a location at your tile.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Add NPC', command: '::npcadd <npc>', description: 'Spawn an NPC at your tile.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Open main interface', command: '::openmain <interface>', description: 'Open a main modal interface.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Open overlay', command: '::openoverlay <interface>', description: 'Open a main overlay interface.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Close overlay', command: '::closeoverlay', description: 'Close the main overlay.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Heap snapshot', command: '::snapshot', description: 'Write a V8 heap snapshot.', mode: 'fill', tags: ['staff 3'] },
    { label: 'Reload world', command: '::reload', description: 'Reload world data.', mode: 'fill', tags: ['staff 4', 'dev'] },
    { label: 'Rebuild scripts', command: '::rebuild', description: 'Rebuild scripts.', mode: 'fill', tags: ['staff 4', 'dev'] },
    { label: 'World speed', command: '::speed <ms>', description: 'Set world tick speed.', mode: 'fill', tags: ['staff 4', 'dev'] },
    { label: 'Fly movement', command: '::fly', description: 'Toggle fly movement strategy.', mode: 'fill', tags: ['staff 4', 'dev'] },
    { label: 'Naive movement', command: '::naive', description: 'Toggle naive movement strategy.', mode: 'fill', tags: ['staff 4', 'dev'] },
    { label: 'Random event ready', command: '::random', description: 'Mark your account ready for random events.', mode: 'fill', tags: ['staff 4', 'dev'] }
];

const TELEPORT_FAVORITES: CommandButton[] = [
    'home', 'lumby', 'lumbridge', 'varrock', 'fally', 'falador', 'draynor', 'portsarim', 'rimmington', 'alkharid', 'seers', 'camelot', 'ardy', 'ardougne', 'entrana', 'brimhaven', 'duel', 'pvp'
].map(name => ({
    label: name,
    command: `::${name}`,
    description: 'Teleport favorite shortcut.',
    mode: 'fill',
    tags: ['staff 2', 'teleport']
}));

const DEBUG_SCRIPT_NAMES: string[] = [
    '1hp', '1pray', 'add_locs', 'addobj', 'addobj2', 'addxp', 'alkharid', 'alleast', 'allnorth', 'allsouth', 'allwest', 'anim', 'antilog', 'ardy', 'atele', 'bank', 'bank_f2p', 'bank_preset', 'both_heropoints', 'brimhaven', 'busy', 'c', 'c3a', 'c4a', 'cannon_hit', 'cat', 'checkskull', 'clearbank', 'clearinv', 'clearskull', 'close', 'com_vars', 'completemc', 'completequests', 'coord', 'coordclues', 'cq', 'cr', 'damage', 'dangerous_requeue', 'death', 'debug_murph', 'delay', 'dgc', 'door_test', 'dragslay', 'dragslaybank', 'dragslaystart', 'draynor', 'drop_feathers', 'drop_items', 'duel', 'dueloffer', 'duelwinnings', 'east', 'elvarg', 'energy', 'entrana', 'error', 'falador', 'findhero', 'fishtest', 'fletchbank', 'fm', 'fmbank', 'fmtest', 'foodbank', 'gang', 'gb', 'gc_test', 'getmaze', 'getpp', 'getppm', 'gf_test', 'giants', 'giveclues', 'givemc', 'giverunes', 'givetrawler', 'godbab', 'gold_test', 'greenland', 'hasmc', 'hed', 'help', 'hero', 'heu', 'hit', 'home', 'huntall_primary', 'huntall_secondary', 'ikd', 'iku', 'imp', 'inv_dropitem_delayed', 'itele', 'itest', 'jf', 'kbd', 'killme', 'kq', 'kqstun', 'kqtele', 'kqtest1', 'kqtest2', 'kqtest3', 'kqtest4', 'kqtest5', 'kqtest6', 'lag', 'lb', 'lf', 'lg', 'lgem', 'lineofwalk', 'loc', 'loc_add_del', 'loc_add_dynamic', 'loc_add_static', 'loc_anim', 'loc_change_back', 'loc_change_dynamic', 'loc_change_error', 'loc_change_inactive', 'loc_del_change', 'loc_del_event', 'loc_findallzone1', 'lockalltracks', 'longqueue', 'lv', 'lw', 'ma', 'macro_event', 'magicbank', 'map_blocked', 'map_findsquare', 'map_playercount', 'maxme', 'maze', 'mazeend', 'mc', 'mctele', 'members', 'minstat', 'north', 'npc', 'npc_anim', 'npc_change_dynamic', 'npc_change_static', 'npc_del_change', 'npc_del_change_static', 'npc_find', 'npc_find1', 'npc_find2', 'npc_findall', 'npc_findallany', 'npc_findallany2', 'npc_hasop', 'npc_hunt1', 'npc_huntall', 'npc_huntall_secondary', 'npc_los1', 'npc_spawn_ci', 'npc_spawn_player', 'obj_findallzone1', 'objbox', 'open', 'pcs', 'players', 'poison', 'portsarim', 'pos', 'pp1', 'pp2', 'pp3', 'pp4', 'pt', 'pvp', 'pvpstun1', 'pvpstun2', 'quest', 'quests', 'queue', 'random', 'random_event', 'reset', 'resetquests', 'rimmington', 'rq', 'sa', 'seers', 'seq', 'setpp', 'setppm', 'setup_druidic_ritual', 'setup_dwarf_cannon', 'setup_monks_friend', 'setup_sheep_herder', 'setup_temple_of_ikov', 'setup_waterfall_quest', 'setup_witches_house', 'singles', 'skull', 'slqb', 'south', 'specweps', 'spotanim', 'stat_boost', 'stat_drain', 'stunned', 'tc', 'test_sail', 'testloc2', 'testmaze', 'testpuz', 'tew', 'trawler', 'trawler_loot', 'unlockalltracks', 'upb', 'upd', 'upr', 'upu', 'varrock', 'west', 'wildy', 'wptest', 'wtb', 'wtd', 'wtu', 'zone', 'zqb', 'zqd', 'zqr', 'zqu'
];

const DEBUG_SCRIPT_COMMANDS: CommandButton[] = DEBUG_SCRIPT_NAMES.map(name => ({
    label: name,
    command: `::~${name}`,
    description: 'Debug script command.',
    mode: 'fill',
    tags: ['staff 4', 'dev', 'debugproc']
}));

type CommandTab = 'common' | 'teleport' | 'plugins' | 'staff' | 'debug';

const COMMAND_TABS: { id: CommandTab; label: string }[] = [
    { id: 'common', label: 'Common' },
    { id: 'teleport', label: 'Teleports' },
    { id: 'plugins', label: 'Plugins' },
    { id: 'staff', label: 'Staff' },
    { id: 'debug', label: 'Debug' }
];

const COMMON_TELEPORTS: Set<string> = new Set(['home', 'lumbridge', 'varrock', 'falador', 'draynor', 'portsarim', 'alkharid']);
const SERVER_TELEPORT_COMMANDS: CommandButton[] = SERVER_COMMANDS.filter(item => item.command === '::teles' || item.command.startsWith('::tele') || item.command.startsWith('::tp '));
const TELEPORT_COMMANDS: CommandButton[] = [...SERVER_TELEPORT_COMMANDS, ...TELEPORT_FAVORITES];
const STAFF_COMMANDS: CommandButton[] = [
    ...CLIENT_COMMANDS.filter(hasStaffTag),
    ...SERVER_COMMANDS.filter(item => !SERVER_TELEPORT_COMMANDS.includes(item))
];
const COMMON_COMMANDS: CommandButton[] = [
    ...CLIENT_COMMANDS.filter(item => ['::plugins', '::fpson', '::fpsoff', '::fps <target>'].includes(item.command) || item.command.startsWith(`::plugin ${WASD_CAMERA_PLUGIN_ID}`)),
    ...SERVER_COMMANDS.filter(item => ['::botstock', '::botbuy <item> <amount>', '::getcoord', '::teles', '::telefav <name>', '::tele <level,mapX,mapZ[,tileX,tileZ]>'].includes(item.command)),
    ...TELEPORT_FAVORITES.filter(item => COMMON_TELEPORTS.has(item.label))
];
const SEARCH_COMMANDS: CommandButton[] = [...CLIENT_COMMANDS, ...SERVER_COMMANDS, ...TELEPORT_FAVORITES, ...DEBUG_SCRIPT_COMMANDS];

export function installCommandPanel(host: CommandPanelHost): void {
    if (document.getElementById('lostcity-command-panel')) {
        return;
    }

    installCommandPanelStyles();

    const controls: HTMLElement | null = document.getElementById('controls');
    const triggers: HTMLButtonElement[] = [];
    const wasdToggles: HTMLButtonElement[] = [];
    const createTrigger = (id: string): HTMLButtonElement => {
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.textContent = 'Commands';
        triggers.push(button);
        return button;
    };

    const syncWasdToggles = (): void => {
        const plugin = host.listPlugins().find(item => item.id === WASD_CAMERA_PLUGIN_ID);
        const enabled = plugin?.enabled === true;
        for (const button of wasdToggles) {
            button.textContent = `WASD Camera: ${enabled ? 'On' : 'Off'}`;
            button.classList.toggle('enabled', enabled);
            button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
            button.title = enabled ? 'WASD moves the camera. Press Enter to chat.' : 'Enable WASD camera controls and press Enter to chat.';
        }
    };

    const createWasdToggle = (id: string): HTMLButtonElement => {
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.addEventListener('click', async event => {
            event.preventDefault();
            event.stopPropagation();
            button.disabled = true;
            try {
                await host.runCommand(`::plugin ${WASD_CAMERA_PLUGIN_ID} toggle`);
                syncWasdToggles();
            } finally {
                button.disabled = false;
            }
        });
        wasdToggles.push(button);
        return button;
    };

    const trigger = createTrigger('lostcity-command-panel-trigger');
    const wasdToggle = createWasdToggle('lostcity-wasd-camera-toggle');

    if (controls) {
        controls.append(' | ');
        controls.appendChild(trigger);
        controls.append(' | ');
        controls.appendChild(wasdToggle);

        const floatingTrigger = createTrigger('lostcity-command-panel-floating-trigger');
        floatingTrigger.classList.add('floating');
        document.body.appendChild(floatingTrigger);

        const floatingWasdToggle = createWasdToggle('lostcity-wasd-camera-floating-toggle');
        floatingWasdToggle.classList.add('floating');
        document.body.appendChild(floatingWasdToggle);

        const syncFloatingTrigger = (): void => {
            const controlsVisible = getComputedStyle(controls).display !== 'none';
            floatingTrigger.hidden = controlsVisible;
            floatingWasdToggle.hidden = controlsVisible;
        };
        syncFloatingTrigger();
        new MutationObserver(syncFloatingTrigger).observe(controls, { attributes: true, attributeFilter: ['style', 'class'] });
    } else {
        trigger.classList.add('floating');
        document.body.appendChild(trigger);
        wasdToggle.classList.add('floating');
        document.body.appendChild(wasdToggle);
    }
    syncWasdToggles();

    const panel = document.createElement('div');
    panel.id = 'lostcity-command-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Commands');
    panel.setAttribute('aria-modal', 'false');
    panel.hidden = true;

    const header = document.createElement('div');
    header.className = 'lostcity-command-panel-header';

    const title = document.createElement('strong');
    title.textContent = 'Commands';

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.className = 'lostcity-command-panel-close';
    close.setAttribute('aria-label', 'Close commands');

    header.append(title, close);

    const search = document.createElement('input');
    search.className = 'lostcity-command-panel-search';
    search.type = 'search';
    search.placeholder = 'Search commands or plugins';
    search.autocomplete = 'off';
    search.setAttribute('aria-label', 'Search commands or plugins');

    const tabs = document.createElement('div');
    tabs.className = 'lostcity-command-panel-tabs';
    tabs.setAttribute('role', 'tablist');

    let activeTab: CommandTab = 'common';
    const tabButtons: { id: CommandTab; button: HTMLButtonElement }[] = COMMAND_TABS.map(tab => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = tab.label;
        button.className = 'lostcity-command-panel-tab';
        button.setAttribute('role', 'tab');
        button.addEventListener('click', () => {
            activeTab = tab.id;
            render();
        });
        tabs.appendChild(button);
        return { id: tab.id, button };
    });

    const results = document.createElement('div');
    results.className = 'lostcity-command-panel-results';

    const rawForm = document.createElement('form');
    rawForm.className = 'lostcity-command-panel-raw';

    const rawInput = document.createElement('input');
    rawInput.type = 'text';
    rawInput.value = '::';
    rawInput.autocomplete = 'off';
    rawInput.spellcheck = false;
    rawInput.setAttribute('aria-label', 'Command input');

    const rawButton = document.createElement('button');
    rawButton.type = 'submit';
    rawButton.textContent = 'Run';

    rawForm.append(rawInput, rawButton);

    const status = document.createElement('div');
    status.className = 'lostcity-command-panel-status';

    panel.append(header, search, tabs, results, rawForm, status);
    document.body.appendChild(panel);

    const setOpen = (open: boolean): void => {
        panel.hidden = !open;
        for (const item of triggers) {
            item.classList.toggle('open', open);
        }
        if (open) {
            render();
            search.focus();
            search.select();
        }
    };

    const run = async (input: string, closeOnHandled: boolean = true): Promise<void> => {
        const command = normalizeCommandInput(input);
        if (!command) {
            status.textContent = 'Enter a command.';
            return;
        }

        status.textContent = `Running ${command}`;
        const handled = await host.runCommand(command);
        status.textContent = handled ? `Ran ${command}` : `Not handled: ${command}`;
        render();
        syncWasdToggles();

        if (handled && closeOnHandled) {
            setOpen(false);
        }
    };

    const matches = (values: string[], query: string): boolean => {
        if (!query) {
            return true;
        }

        return values.some(value => value.toLowerCase().includes(query));
    };

    const matchesCommand = (item: CommandButton, query: string): boolean => matches([item.label, item.command, item.description, ...(item.tags ?? [])], query);
    const matchesPlugin = (plugin: PluginSummary, query: string): boolean => matches([plugin.id, plugin.name, plugin.enabled ? 'on enabled' : 'off disabled'], query);

    const renderCommandSection = (title: string, commands: CommandButton[], query: string): number => {
        const visibleCommands: CommandButton[] = commands.filter(item => matchesCommand(item, query));
        if (visibleCommands.length === 0) {
            return 0;
        }

        const section = createSection(title, visibleCommands.length);
        for (const item of visibleCommands) {
            section.list.appendChild(createCommandRow(item, run, rawInput, status));
        }
        results.appendChild(section.root);
        return visibleCommands.length;
    };

    const renderPluginSection = (query: string): number => {
        const plugins: PluginSummary[] = host.listPlugins().filter(plugin => matchesPlugin(plugin, query));
        if (plugins.length === 0) {
            return 0;
        }

        const section = createSection('Plugins', plugins.length);
        for (const plugin of plugins) {
            section.list.appendChild(createPluginRow(plugin, run));
        }
        results.appendChild(section.root);
        return plugins.length;
    };

    const render = (): void => {
        const query: string = search.value.trim().toLowerCase();
        for (const tab of tabButtons) {
            const selected = tab.id === activeTab;
            tab.button.classList.toggle('active', selected);
            tab.button.setAttribute('aria-selected', selected ? 'true' : 'false');
        }

        results.replaceChildren();
        let visible = 0;

        if (query) {
            visible += renderCommandSection('Command matches', SEARCH_COMMANDS, query);
            visible += renderPluginSection(query);
        } else if (activeTab === 'common') {
            visible += renderCommandSection('Common commands', COMMON_COMMANDS, query);
            visible += renderPluginSection(query);
        } else if (activeTab === 'teleport') {
            visible += renderCommandSection('Teleport commands', TELEPORT_COMMANDS, query);
        } else if (activeTab === 'plugins') {
            visible += renderCommandSection('Plugin commands', CLIENT_COMMANDS.filter(item => item.command === '::plugins'), query);
            visible += renderPluginSection(query);
        } else if (activeTab === 'staff') {
            visible += renderCommandSection('Staff commands', STAFF_COMMANDS, query);
        } else if (activeTab === 'debug') {
            visible += renderCommandSection('Debug script commands', DEBUG_SCRIPT_COMMANDS, query);
        }

        if (visible === 0) {
            const empty = document.createElement('div');
            empty.className = 'lostcity-command-panel-empty';
            empty.textContent = query ? 'No matching commands or plugins.' : 'No commands in this category.';
            results.appendChild(empty);
        }
    };

    for (const item of triggers) {
        item.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(panel.hidden);
        });
    }

    close.addEventListener('click', () => setOpen(false));
    search.addEventListener('input', render);
    rawForm.addEventListener('submit', event => {
        event.preventDefault();
        void run(rawInput.value);
    });

    document.addEventListener('pointerdown', event => {
        if (panel.hidden || !(event.target instanceof Node)) {
            return;
        }

        if (panel.contains(event.target) || triggers.some(item => item.contains(event.target as Node))) {
            return;
        }

        setOpen(false);
    });

    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            setOpen(panel.hidden);
            return;
        }

        if (event.key === 'Escape' && !panel.hidden) {
            event.preventDefault();
            setOpen(false);
        }
    });
}

function hasStaffTag(item: CommandButton): boolean {
    return (item.tags ?? []).some(tag => tag.startsWith('staff'));
}

function createSection(titleText: string, count: number): { root: HTMLElement; list: HTMLElement } {
    const root = document.createElement('div');
    root.className = 'lostcity-command-panel-section';

    const title = document.createElement('div');
    title.className = 'lostcity-command-panel-section-title';
    title.textContent = `${titleText} (${count})`;

    const list = document.createElement('div');
    list.className = 'lostcity-command-panel-list';

    root.append(title, list);
    return { root, list };
}

function normalizeCommandInput(input: string): string {
    const text = input.trim();
    if (!text) {
        return '';
    }

    return text.startsWith('::') ? text : `::${text.replace(/^:+/, '')}`;
}

function createCommandRow(
    item: CommandButton,
    run: (input: string) => Promise<void>,
    rawInput: HTMLInputElement,
    status: HTMLElement
): HTMLElement {
    const row = document.createElement('div');
    row.className = `lostcity-command-panel-command lostcity-command-panel-command-${item.mode}`;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'lostcity-command-panel-command-main';

    const label = document.createElement('span');
    label.className = 'lostcity-command-panel-command-label';
    label.textContent = item.label;

    const meta = document.createElement('span');
    meta.className = 'lostcity-command-panel-command-meta';

    const command = document.createElement('code');
    command.textContent = item.command;

    const tags = document.createElement('span');
    tags.className = 'lostcity-command-panel-command-tags';
    for (const tag of item.tags ?? []) {
        const chip = document.createElement('span');
        chip.textContent = tag;
        tags.appendChild(chip);
    }

    const description = document.createElement('span');
    description.className = 'lostcity-command-panel-command-description';
    description.textContent = item.description;

    meta.append(command, tags);
    main.append(label, meta, description);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'lostcity-command-panel-command-action';
    action.textContent = item.mode === 'run' ? 'Run' : 'Use';

    const fill = (): void => {
        rawInput.value = item.command;
        rawInput.focus();
        status.textContent = `Selected ${item.command}`;
    };

    main.addEventListener('click', () => {
        if (item.mode === 'run') {
            void run(item.command);
        } else {
            fill();
        }
    });

    action.addEventListener('click', () => {
        if (item.mode === 'run') {
            void run(item.command);
        } else {
            fill();
        }
    });

    row.append(main, action);
    return row;
}

function createPluginRow(plugin: PluginSummary, run: (input: string, closeOnHandled?: boolean) => Promise<void>): HTMLElement {
    const row = document.createElement('label');
    row.className = 'lostcity-command-panel-plugin';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = plugin.enabled;
    checkbox.addEventListener('change', () => {
        const mode = checkbox.checked ? 'on' : 'off';
        void run(`::plugin ${plugin.id} ${mode}`, false);
    });

    const text = document.createElement('span');
    text.className = 'lostcity-command-panel-plugin-name';
    text.textContent = plugin.name;

    const meta = document.createElement('code');
    meta.textContent = plugin.id;

    const state = document.createElement('span');
    state.className = 'lostcity-command-panel-plugin-state';
    state.textContent = plugin.enabled ? 'on' : 'off';

    row.append(checkbox, text, meta, state);
    return row;
}

function installCommandPanelStyles(): void {
    if (document.getElementById('lostcity-command-panel-style')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'lostcity-command-panel-style';
    style.textContent = `
        #lostcity-command-panel-trigger,
        #lostcity-command-panel-floating-trigger,
        #lostcity-wasd-camera-toggle,
        #lostcity-wasd-camera-floating-toggle {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            color: #04A800;
            background: transparent;
            border: 0;
            padding: 0;
            cursor: pointer;
        }

        #lostcity-command-panel-trigger.open,
        #lostcity-command-panel-floating-trigger.open,
        #lostcity-command-panel-trigger:hover,
        #lostcity-command-panel-floating-trigger:hover,
        #lostcity-wasd-camera-toggle:hover,
        #lostcity-wasd-camera-floating-toggle:hover {
            text-decoration: underline;
        }

        #lostcity-wasd-camera-toggle.enabled,
        #lostcity-wasd-camera-floating-toggle.enabled {
            color: #7CFC00;
        }

        #lostcity-command-panel-trigger.floating,
        #lostcity-command-panel-floating-trigger.floating,
        #lostcity-wasd-camera-toggle.floating,
        #lostcity-wasd-camera-floating-toggle.floating {
            position: fixed;
            bottom: 12px;
            z-index: 10000;
            padding: 5px 8px;
            border: 1px solid #04A800;
            background: #000;
        }

        #lostcity-command-panel-trigger.floating,
        #lostcity-command-panel-floating-trigger.floating {
            right: 12px;
        }

        #lostcity-wasd-camera-toggle.floating,
        #lostcity-wasd-camera-floating-toggle.floating {
            right: 92px;
        }

        #lostcity-command-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(580px, calc(100vw - 24px));
            height: min(60vh, 520px);
            max-height: calc(100vh - 24px);
            box-sizing: border-box;
            display: grid;
            grid-template-rows: auto auto auto minmax(0, 1fr) auto auto;
            gap: 8px;
            overflow: hidden;
            z-index: 10000;
            padding: 10px;
            text-align: left;
            color: #fff;
            background: #050505;
            border: 1px solid #04A800;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.75);
            font: 12px/1.35 Arial, Helvetica, sans-serif;
        }

        #lostcity-command-panel[hidden] {
            display: none;
        }

        .lostcity-command-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .lostcity-command-panel-close,
        .lostcity-command-panel-raw button,
        .lostcity-command-panel-tab,
        .lostcity-command-panel-command-main,
        .lostcity-command-panel-command-action {
            color: #04A800;
            background: #101010;
            border: 1px solid #2b2b2b;
            cursor: pointer;
            font: inherit;
        }

        .lostcity-command-panel-close {
            padding: 3px 8px;
        }

        .lostcity-command-panel-close:hover,
        .lostcity-command-panel-raw button:hover,
        .lostcity-command-panel-tab:hover,
        .lostcity-command-panel-command-main:hover,
        .lostcity-command-panel-command-action:hover {
            border-color: #04A800;
        }

        .lostcity-command-panel-search,
        .lostcity-command-panel-raw input {
            width: 100%;
            box-sizing: border-box;
            color: #fff;
            background: #111;
            border: 1px solid #333;
            padding: 6px 7px;
            font: 12px/1.35 Arial, Helvetica, sans-serif;
        }

        .lostcity-command-panel-tabs {
            display: flex;
            gap: 4px;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 1px;
            min-height: 27px;
        }

        .lostcity-command-panel-tab {
            flex: 0 0 auto;
            padding: 4px 8px;
            color: #bdbdbd;
        }

        .lostcity-command-panel-tab.active {
            color: #fff;
            border-color: #04A800;
            background: #061206;
        }

        .lostcity-command-panel-results {
            min-height: 0;
            overflow-y: auto;
            padding-right: 2px;
            display: grid;
            align-content: start;
            gap: 8px;
        }

        .lostcity-command-panel-section {
            display: grid;
            gap: 5px;
        }

        .lostcity-command-panel-section-title {
            color: #bdbdbd;
            font-weight: 700;
        }

        .lostcity-command-panel-list {
            display: grid;
            gap: 5px;
        }

        .lostcity-command-panel-command {
            width: 100%;
            min-height: 34px;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: stretch;
            gap: 5px;
        }

        .lostcity-command-panel-command-main {
            min-width: 0;
            display: grid;
            grid-template-columns: minmax(92px, 0.45fr) minmax(0, 1fr);
            grid-template-areas:
                "label meta"
                "description description";
            align-items: center;
            gap: 2px 8px;
            padding: 5px 7px;
            text-align: left;
        }

        .lostcity-command-panel-plugin {
            width: 100%;
            min-height: 30px;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: minmax(110px, 1fr) auto;
            align-items: center;
            gap: 8px;
            padding: 5px 7px;
            text-align: left;
        }

        .lostcity-command-panel-command-label {
            grid-area: label;
            color: #fff;
        }

        .lostcity-command-panel-command-description {
            grid-area: description;
            color: #8f8f8f;
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .lostcity-command-panel-command-meta {
            grid-area: meta;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 5px;
        }

        .lostcity-command-panel-command code,
        .lostcity-command-panel-plugin code {
            color: #bdbdbd;
            font-family: Consolas, Monaco, monospace;
            font-size: 11px;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .lostcity-command-panel-command-tags {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            flex-wrap: wrap;
            gap: 4px;
        }

        .lostcity-command-panel-command-tags span {
            color: #bdbdbd;
            background: #151515;
            border: 1px solid #333;
            padding: 2px 4px;
            font-size: 10px;
            white-space: nowrap;
        }

        .lostcity-command-panel-command-action {
            width: 44px;
            padding: 0 5px;
        }

        .lostcity-command-panel-plugin {
            grid-template-columns: auto minmax(90px, 1fr) auto auto;
            color: #fff;
            background: #101010;
            border: 1px solid #2b2b2b;
        }

        .lostcity-command-panel-plugin input {
            margin: 0;
        }

        .lostcity-command-panel-plugin-state {
            min-width: 24px;
            color: #04A800;
            text-align: right;
        }

        .lostcity-command-panel-raw {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 6px;
        }

        .lostcity-command-panel-raw button {
            padding: 0 12px;
        }

        .lostcity-command-panel-status {
            min-height: 16px;
            color: #bdbdbd;
        }

        .lostcity-command-panel-empty {
            padding: 10px;
            color: #8f8f8f;
            background: #101010;
            border: 1px solid #2b2b2b;
        }

        @media (max-width: 560px) {
            #lostcity-command-panel {
                height: min(70vh, 520px);
            }

            .lostcity-command-panel-command-main {
                grid-template-columns: minmax(0, 1fr);
                grid-template-areas:
                    "label"
                    "meta"
                    "description";
            }

            .lostcity-command-panel-command-meta,
            .lostcity-command-panel-command-tags {
                justify-content: flex-start;
            }

            .lostcity-command-panel-command-description {
                white-space: normal;
            }

            .lostcity-command-panel-plugin {
                grid-template-columns: auto minmax(0, 1fr) auto;
            }

            .lostcity-command-panel-plugin code {
                grid-column: 2 / -1;
            }
        }
    `;
    document.head.appendChild(style);
}
