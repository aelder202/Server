'use strict';

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const { ExitPromptError } = require('@inquirer/core');
const { confirm, input, password, select } = require('@inquirer/prompts');

// if you're forking this feel free to change these :) it does make some assumptions elsewhere (branch names)
const repoOrg = 'https://github.com/LostCityRS';
const repos = {
    engine: 'Engine-TS',
    content: 'Content',
    webclient: 'Client-TS',
    javaclient: 'Client-Java'
};

const playerSaveSnapshotDir = path.join('saves', 'players');
const enginePlayerSaveDir = path.join('engine', 'data', 'players');

function hasAnyFile(dir) {
    if (!fs.existsSync(dir)) {
        return false;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (hasAnyFile(entryPath)) {
                return true;
            }
        } else {
            return true;
        }
    }

    return false;
}

function copyDirectory(source, destination, mirror = false) {
    if (!fs.existsSync(source)) {
        return false;
    }

    if (mirror && fs.existsSync(destination)) {
        fs.rmSync(destination, { recursive: true, force: true });
    }

    fs.mkdirSync(destination, { recursive: true });
    fs.cpSync(source, destination, { recursive: true, force: true });
    return true;
}

function restorePlayerSaves() {
    if (!hasAnyFile(playerSaveSnapshotDir) || hasAnyFile(enginePlayerSaveDir)) {
        return;
    }

    copyDirectory(playerSaveSnapshotDir, enginePlayerSaveDir);
    console.log('Restored character saves from saves/players.');
}

function backupPlayerSaves() {
    if (!hasAnyFile(enginePlayerSaveDir)) {
        console.log('No character saves found to back up.');
        return;
    }

    copyDirectory(enginePlayerSaveDir, playerSaveSnapshotDir, true);
    console.log('Backed up character saves to saves/players. Commit and push these files to carry them to another PC.');
}

function normalizeCharacterName(name) {
    const normalized = name.trim().toLowerCase().replaceAll(' ', '_');
    if (!/^[a-z0-9_]{1,12}$/.test(normalized)) {
        throw new Error('Character names must be 1-12 characters using letters, numbers, or underscores.');
    }
    return normalized;
}

function getWorldNodeConfig() {
    const worldConfigPath = path.join('engine', 'data', 'config', 'world.json');
    if (!fs.existsSync(worldConfigPath)) return { profile: 'main', adminUsername: 'mod' };
    return JSON.parse(fs.readFileSync(worldConfigPath, 'utf8')).node ?? { profile: 'main', adminUsername: 'mod' };
}

function getCharacterNames() {
    const names = new Set();
    const profile = getWorldNodeConfig().profile ?? 'main';
    for (const dir of [path.join(enginePlayerSaveDir, profile), path.join(playerSaveSnapshotDir, profile)]) {
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith('.sav')) {
                names.add(path.basename(entry.name, '.sav'));
            }
        }
    }
    return [...names].sort();
}

function getCharacterPaths(username) {
    const normalized = normalizeCharacterName(username);
    const profile = getWorldNodeConfig().profile ?? 'main';
    return {
        normalized,
        live: path.join(enginePlayerSaveDir, profile, `${normalized}.sav`),
        snapshot: path.join(playerSaveSnapshotDir, profile, `${normalized}.sav`)
    };
}

function backupCharacterFile(filename) {
    if (!fs.existsSync(filename)) return;
    const backupDir = path.join('saves', 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    fs.copyFileSync(filename, path.join(backupDir, `${path.basename(filename, '.sav')}-${stamp}.sav`));
}

function runPlayerManager(args) {
    ensureEngineDependencies();
    child_process.execFileSync(process.execPath, ['--import', 'tsx', 'tools/player/ManagePlayers.ts', ...args], {
        cwd: 'engine',
        stdio: 'inherit'
    });
}

function syncCharacterSnapshot(username) {
    const paths = getCharacterPaths(username);
    if (!fs.existsSync(paths.live)) return;
    fs.mkdirSync(path.dirname(paths.snapshot), { recursive: true });
    fs.copyFileSync(paths.live, paths.snapshot);
}

function ensureLiveCharacter(username) {
    const paths = getCharacterPaths(username);
    if (!fs.existsSync(paths.live) && fs.existsSync(paths.snapshot)) {
        fs.mkdirSync(path.dirname(paths.live), { recursive: true });
        fs.copyFileSync(paths.snapshot, paths.live);
    }
}

async function chooseCharacter(message) {
    const names = getCharacterNames();
    if (names.length === 0) {
        console.log('No character saves were found.');
        return null;
    }
    return select({ message, choices: names.map(name => ({ name, value: name })) });
}

async function promptCharacterManager() {
    console.log('Important: stop the game server before changing saves or passwords.');
    const proceed = await confirm({ message: 'Is the game server stopped?', default: false });
    if (!proceed) return;

    let managing = true;
    while (managing) {
        const choice = await select({
            message: 'Character management',
            choices: [
                { name: 'List characters', value: 'list' },
                { name: 'Inspect a character', value: 'inspect' },
                { name: 'Change a password', value: 'password' },
                { name: 'Import or replace a save', value: 'import' },
                { name: 'Clone a character', value: 'clone' },
                { name: 'Rename a character', value: 'rename' },
                { name: 'Edit a skill level or XP', value: 'skill' },
                { name: 'Edit position', value: 'position' },
                { name: 'Edit inventory or bank', value: 'inventory' },
                { name: 'Delete a character', value: 'delete' },
                { name: 'Back', value: 'back' }
            ]
        }, { clearPromptOnDone: true });

        try {
            if (choice === 'back') {
                managing = false;
            } else if (choice === 'list') {
                const names = getCharacterNames();
                console.log(names.length > 0 ? `Characters: ${names.join(', ')}` : 'No character saves were found.');
            } else if (choice === 'inspect') {
                const username = await chooseCharacter('Inspect which character?');
                if (username) {
                    ensureLiveCharacter(username);
                    runPlayerManager(['inspect', username]);
                }
            } else if (choice === 'password') {
                const username = await input({ message: 'Character name (use mod for the administrator):' });
                const first = await password({ message: 'New password (1-20 characters):', mask: '*' });
                const second = await password({ message: 'Confirm password:', mask: '*' });
                if (first !== second) throw new Error('Passwords did not match.');
                runPlayerManager(['set-password', normalizeCharacterName(username), first]);
            } else if (choice === 'import') {
                const source = path.resolve(await input({ message: 'Full path to the .sav file:' }));
                const destination = normalizeCharacterName(await input({ message: 'Destination character name:' }));
                runPlayerManager(['verify-file', source]);
                const paths = getCharacterPaths(destination);
                if ((fs.existsSync(paths.live) || fs.existsSync(paths.snapshot)) && !(await confirm({ message: `${destination} already exists. Replace it?`, default: false }))) continue;
                backupCharacterFile(fs.existsSync(paths.live) ? paths.live : paths.snapshot);
                fs.mkdirSync(path.dirname(paths.live), { recursive: true });
                fs.mkdirSync(path.dirname(paths.snapshot), { recursive: true });
                fs.copyFileSync(source, paths.live);
                fs.copyFileSync(source, paths.snapshot);
                console.log(`Imported '${destination}'. Its existing password was preserved; an unclaimed name sets its password on first login.`);
            } else if (choice === 'clone' || choice === 'rename') {
                const source = await chooseCharacter(`${choice === 'clone' ? 'Clone' : 'Rename'} which character?`);
                if (!source) continue;
                if (choice === 'rename' && source === normalizeCharacterName(getWorldNodeConfig().adminUsername ?? 'mod')) {
                    throw new Error('The configured administrator cannot be renamed. Clone it or change node.adminUsername first.');
                }
                const destination = normalizeCharacterName(await input({ message: 'New character name:' }));
                const sourcePaths = getCharacterPaths(source);
                const destinationPaths = getCharacterPaths(destination);
                if (fs.existsSync(destinationPaths.live) || fs.existsSync(destinationPaths.snapshot)) throw new Error(`Character '${destination}' already exists.`);
                const sourceFile = fs.existsSync(sourcePaths.live) ? sourcePaths.live : sourcePaths.snapshot;
                fs.mkdirSync(path.dirname(destinationPaths.live), { recursive: true });
                fs.mkdirSync(path.dirname(destinationPaths.snapshot), { recursive: true });
                fs.copyFileSync(sourceFile, destinationPaths.live);
                fs.copyFileSync(sourceFile, destinationPaths.snapshot);
                if (choice === 'rename') {
                    backupCharacterFile(sourceFile);
                    if (fs.existsSync(sourcePaths.live)) fs.rmSync(sourcePaths.live);
                    if (fs.existsSync(sourcePaths.snapshot)) fs.rmSync(sourcePaths.snapshot);
                    runPlayerManager(['remove-password', source]);
                }
                console.log(`${choice === 'clone' ? 'Cloned' : 'Renamed'} '${source}' as '${destination}'. The destination will set its password on first login.`);
            } else if (choice === 'skill') {
                const username = await chooseCharacter('Edit which character?');
                if (!username) continue;
                ensureLiveCharacter(username);
                const mode = await select({ message: 'Change level or exact XP?', choices: [{ name: 'Level', value: 'set-level' }, { name: 'Exact XP', value: 'set-xp' }] });
                const skill = await input({ message: 'Skill name (for example mining):' });
                const value = await input({ message: mode === 'set-level' ? 'Level (1-99):' : 'XP:' });
                backupCharacterFile(getCharacterPaths(username).live);
                runPlayerManager([mode, username, skill, value]);
                syncCharacterSnapshot(username);
            } else if (choice === 'position') {
                const username = await chooseCharacter('Move which character?');
                if (!username) continue;
                ensureLiveCharacter(username);
                const x = await input({ message: 'X coordinate:' });
                const z = await input({ message: 'Z coordinate:' });
                const plane = await input({ message: 'Plane (0-3):', default: '0' });
                backupCharacterFile(getCharacterPaths(username).live);
                runPlayerManager(['set-position', username, x, z, plane]);
                syncCharacterSnapshot(username);
            } else if (choice === 'inventory') {
                const username = await chooseCharacter('Edit which character?');
                if (!username) continue;
                ensureLiveCharacter(username);
                const action = await select({ message: 'Inventory action', choices: [{ name: 'Add item', value: 'add-item' }, { name: 'Remove item', value: 'remove-item' }, { name: 'Clear inventory/bank', value: 'clear-inventory' }] });
                const inventory = await input({ message: 'Container name (inv, bank, or worn):' });
                const args = [action, username, inventory];
                if (action !== 'clear-inventory') {
                    args.push(await input({ message: 'Item config name or numeric ID:' }));
                    args.push(await input({ message: 'Amount:', default: '1' }));
                } else if (!(await confirm({ message: `Really clear ${username}'s ${inventory}?`, default: false }))) {
                    continue;
                }
                backupCharacterFile(getCharacterPaths(username).live);
                runPlayerManager(args);
                syncCharacterSnapshot(username);
            } else if (choice === 'delete') {
                const username = await chooseCharacter('Delete which character?');
                if (username === normalizeCharacterName(getWorldNodeConfig().adminUsername ?? 'mod')) {
                    throw new Error('The configured administrator cannot be deleted. Change node.adminUsername first.');
                }
                if (!username || !(await confirm({ message: `Delete '${username}' and its local password? A backup will be retained.`, default: false }))) continue;
                const paths = getCharacterPaths(username);
                backupCharacterFile(fs.existsSync(paths.live) ? paths.live : paths.snapshot);
                if (fs.existsSync(paths.live)) fs.rmSync(paths.live);
                if (fs.existsSync(paths.snapshot)) fs.rmSync(paths.snapshot);
                runPlayerManager(['remove-password', username]);
                console.log(`Deleted '${username}'.`);
            }
        } catch (err) {
            if (err instanceof ExitPromptError) throw err;
            console.error(err instanceof Error ? err.message : err);
        }
    }
}

function getRepoUrl(repo) {
    const source = config.repos?.[repo];
    if (typeof source === 'string') {
        return source;
    }
    if (source && typeof source === 'object' && typeof source.url === 'string') {
        return source.url;
    }
    return `${repoOrg}/${repos[repo]}`;
}

function getRepoBranch(repo, branch) {
    const source = config.repos?.[repo];
    if (source && typeof source === 'object' && typeof source.branch === 'string') {
        return source.branch;
    }
    return branch;
}

function cloneRepo(repo, dir, branch) {
    child_process.execFileSync('git', ['clone', getRepoUrl(repo), '--single-branch', '-b', getRepoBranch(repo, branch), dir], {
        stdio: 'inherit'
    });
}

function updateRepo(cwd) {
    child_process.execSync('git pull', {
        stdio: 'inherit',
        cwd
    });
}

function runOnOs(exec, cwd) {
    const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');

    child_process.execSync(`${start} ${exec}`, {
        stdio: 'inherit',
        cwd
    });
}

function ensureEngineDependencies() {
    if (!fs.existsSync('engine/node_modules')) {
        child_process.execSync('bun install', {
            stdio: 'inherit',
            cwd: 'engine'
        });
    }
}

function startEngine() {
    ensureEngineDependencies();

    try {
        // Revision 274 uses Node's built-in sqlite module, so execute through
        // Node/tsx rather than the Bun runtime used only for dependency setup.
        child_process.execSync('npm run quickstart', {
            stdio: 'inherit',
            cwd: 'engine'
        });
    } finally {
        backupPlayerSaves();
    }
}

let config = {
    rev: 'unset'
};

const revInfo = {
    '225': {
        description: 'May 18, 2004',
        webclient: true
    },
    '244': {
        description: 'June 28, 2004',
        webclient: true
    },
    '245.2': {
        description: 'July 13, 2004 (there were 3 "245" builds!)',
        webclient: true
    },
    '254': {
        description: 'September 7, 2004',
        webclient: true
    },
    '274': {
        description: 'November 23, 2004',
        webclient: true
    },
    '289': {
        description: 'January 17, 2005',
        wip: true,
        webclient: true
    },
    '377-wip': {
        description: 'May 5, 2006',
        wip: true,
        clientBranch: '377'
    }
};

let running = true;
async function main() {
    if (!fs.existsSync('server.json')) {
        await promptConfig();
    }

    config = JSON.parse(fs.readFileSync('server.json', 'utf8'));

    if (!fs.existsSync('engine')) {
        cloneRepo('engine', 'engine', config.rev);
    }

    if (!fs.existsSync('content')) {
        cloneRepo('content', 'content', config.rev);
    }

    if (revInfo[config.rev]?.webclient && !fs.existsSync('webclient')) {
        cloneRepo('webclient', 'webclient', config.rev);
    }

    if (!fs.existsSync('javaclient')) {
        cloneRepo('javaclient', 'javaclient', revInfo[config.rev]?.clientBranch ?? config.rev);
    }

    if (!fs.existsSync('engine/.env') && !fs.existsSync('engine/data/config/world.json')) {
        child_process.spawnSync('npm install', {
            shell: true,
            stdio: 'inherit',
            cwd: 'engine'
        });

        child_process.spawnSync('npm run setup', {
            shell: true,
            stdio: 'inherit',
            cwd: 'engine'
        });
    }

    restorePlayerSaves();

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.log('No interactive terminal detected; starting the server directly.');
        startEngine();
        running = false;
        return;
    }

    const choice = await select({
        message: 'What would you like to do?',
        choices: [{
            name: 'Start Server',
            description: 'Starts the server normally',
            value: 'start'
        }, {
            name: 'Update Source',
            description: 'Pull the latest commits for all subprojects',
            value: 'update'
        }, {
            name: 'Backup Character Saves',
            description: 'Copies local player saves into the tracked saves/players snapshot',
            value: 'backup-saves'
        }, {
            name: 'Manage Characters',
            description: 'Change passwords and safely edit, import, clone, or delete saves',
            value: 'manage-characters'
        },
        revInfo[config.rev]?.webclient ? {
            name: 'Run Web Client',
            description: 'Opens your browser to play using the modern web client (TypeScript)',
            value: 'web'
        } : {
            name: 'Run Web Client (unavailable)',
            description: 'Not available in this version.',
            value: ''
        },
        {
            name: 'Run Java Client',
            description: 'Opens the legacy Java applet to play using the original client',
            value: 'java'
        }, {
            name: 'Advanced Options',
            description: 'View more options',
            value: 'advanced'
        }, {
            name: 'Quit',
            description: '',
            value: 'quit'
        }]
    }, { clearPromptOnDone: true });

    if (choice === 'start') {
        startEngine();
    } else if (choice === 'update') {
        updateRepo('engine');
        updateRepo('content');
        updateRepo('webclient');
        updateRepo('javaclient');
    } else if (choice === 'backup-saves') {
        backupPlayerSaves();
    } else if (choice === 'manage-characters') {
        await promptCharacterManager();
    } else if (choice === 'web') {
        if (!revInfo[config.rev]?.webclient) {
            console.log('This version does not have a webclient available (yet?), sorry.');
        } else if (process.platform === 'win32' || process.platform === 'darwin') {
            runOnOs('http://localhost/rs2.cgi');
        } else {
            runOnOs('http://localhost:8888/rs2.cgi');
        }
    } else if (choice === 'java') {
        const command = process.platform === 'win32' ? 'gradlew' : './gradlew';
        if (config.rev === '225') {
            child_process.execSync(`${command} run --args="10 0 highmem members"`, {
                stdio: 'inherit',
                cwd: 'javaclient'
            });
        } else {
            child_process.execSync(`${command} run --args="10 0 highmem members 32"`, {
                stdio: 'inherit',
                cwd: 'javaclient'
            });
        }
    } else if (choice === 'advanced') {
        await promptAdvanced();
    } else if (choice === 'quit') {
        running = false;
    }
}

async function promptConfig() {
    const orderedRevs = Object.entries(revInfo);
    orderedRevs.sort((a, b) => parseInt(a[0]) - parseInt(b[0])); // descending revs
    orderedRevs.sort((a, b) => a[1].wip ? 1 : -1); // wip last

    let choices = [];
    for (const [rev, info] of orderedRevs) {
        choices.push({
            name: info.wip ? `${rev} (DEVELOPERS ONLY)` : rev,
            value: rev,
            description: info.description
        });
    }

    const rev = await select({
        message: 'What version are you interested in?',
        choices
    }, { clearPromptOnDone: true });

    config.rev = rev;

    fs.writeFileSync('server.json', JSON.stringify(config, null, 2));
}

async function promptAdvanced() {
    const choice = await select({
        message: 'What would you like to do?',
        choices: [{
            name: 'Start Server (engine dev)',
            description: 'Starts the server and watches for .ts file changes to reload',
            value: 'start-dev'
        }, {
             name: 'Reconfigure Server',
             description: 'Edit the environment config for the server',
             value: 'configure'
        }, {
            name: 'Clean-build Server',
            description: '',
            value: 'clean-build'
        },
        revInfo[config.rev]?.webclient ? {
            name: 'Build Web Client',
            description: '',
            value: 'build-web'
        } : {
            name: 'Build Web Client (unavailable)',
            description: 'Not available in this version.',
            value: ''
        },
        {
            name: 'Build Java Client',
            description: '',
            value: 'build-java'
        }, {
            name: 'Change Version',
            description: 'THIS OPTION WILL DESTROY YOUR WORKING FOLDER AND CREATE A NEW ONE.',
            value: 'change-version'
        }, {
            name: 'Back',
            description: 'Go back',
            value: 'back'
        }]
    }, { clearPromptOnDone: true });

    if (choice === 'start-dev') {
        child_process.execSync('npm run dev', {
            stdio: 'inherit',
            cwd: 'engine'
        });
    } else if (choice === 'configure') {
        child_process.spawnSync('npm run setup', {
            shell: true,
            stdio: 'inherit',
            cwd: 'engine'
        });
    } else if (choice === 'clean-build') {
        child_process.execSync('npm run clean', {
            stdio: 'inherit',
            cwd: 'engine'
        });

        child_process.execSync('npm run build', {
            stdio: 'inherit',
            cwd: 'engine'
        });
    } else if (choice === 'build-web') {
        child_process.execSync('npm run build', {
            stdio: 'inherit',
            cwd: 'webclient'
        });

        fs.copyFileSync('webclient/out/client.js', 'engine/public/client/client.js');
    } else if (choice === 'build-java') {
        const command = process.platform === 'win32' ? 'gradlew' : './gradlew';
        child_process.execSync(`${command} build`, {
            stdio: 'inherit',
            cwd: 'javaclient'
        });
    } else if (choice === 'change-version') {
        await promptConfig();

        fs.rmSync('engine', { recursive: true, force: true });
        fs.rmSync('content', { recursive: true, force: true });
        fs.rmSync('webclient', { recursive: true, force: true });
        fs.rmSync('javaclient', { recursive: true, force: true });
    }
}

async function run() {
    try {
        while (running) {
            await main();
        }
    } catch (e) {
        if (e instanceof ExitPromptError) {
            process.exit(0);
        } else if (e instanceof Error) {
            console.error(e.message);
            process.exit(1);
        }
    }
}

run();
