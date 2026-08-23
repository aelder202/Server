'use strict';

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const { ExitPromptError } = require('@inquirer/core');
const { select } = require('@inquirer/prompts');

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
