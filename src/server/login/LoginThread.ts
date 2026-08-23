import fs from 'fs';
import { parentPort } from 'worker_threads';

import * as bcrypt from 'bcrypt-ts';

import { LoginClient } from '#/server/login/LoginClient.js';
import Environment from '#/util/Environment.js';

import { type GenericLoginThreadResponse } from './index.d.js';
import { verifyOrCreateLocalAccountPassword } from './LocalAccountStore.js';
import { trackLoginAttempts, trackLoginTime } from './LoginMetrics.js';

const client = new LoginClient(Environment.node.id);

function staffLevelFor(username: string): number {
    const adminUsername = Environment.node.adminUsername.trim().toLowerCase();
    return adminUsername.length > 0 && username.trim().toLowerCase() === adminUsername ? 4 : 0;
}

function isAdminUsername(username: string): boolean {
    return staffLevelFor(username) === 4;
}

async function hasValidLocalAdminPassword(username: string, password: string): Promise<boolean> {
    if (!isAdminUsername(username)) {
        return true;
    }

    const passwordHash = Environment.node.adminPasswordHash.trim();
    return passwordHash.length > 0 && (await bcrypt.compare(password.toLowerCase(), passwordHash));
}

if (!parentPort) throw new Error('This file must be run as a worker thread.');

parentPort.on('message', async msg => {
    try {
        if (!parentPort) throw new Error('This file must be run as a worker thread.');
        await handleRequests(parentPort, msg);
    } catch (err) {
        console.error(err);
    }
});

client.onMessage((opcode, data) => {
    parentPort!.postMessage({ opcode, data });
});

type ParentPort = {
    postMessage: (msg: GenericLoginThreadResponse) => void;
};

async function handleRequests(parentPort: ParentPort, msg: any) {
    const { type } = msg;

    switch (type) {
        case 'world_startup': {
            if (Environment.login.enabled) {
                await client.worldStartup();
            }
            break;
        }
        case 'player_login': {
            const { socket, remoteAddress, username, password, uid, lowMemory, reconnecting, hasSave } = msg;

            if (Environment.login.enabled) {
                trackLoginAttempts.inc();
                const stopTimer = trackLoginTime.startTimer();
                const response = await client.playerLogin(username, password, uid, socket, remoteAddress, reconnecting, hasSave);

                // Development mode must not make every local account an
                // administrator. Only the configured username receives staff.
                response.staffmodlevel = staffLevelFor(username);

                parentPort.postMessage({
                    type: 'player_login',
                    socket,
                    username,
                    lowMemory,
                    reconnecting,
                    ...response
                });
                stopTimer();
            } else {
                if (!(await hasValidLocalAdminPassword(username, password))) {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 1,
                        staffmodlevel: 0,
                        save: null,
                        account_id: -1,
                        members: Environment.node.members
                    });
                    break;
                }

                if (!isAdminUsername(username) && !(await verifyOrCreateLocalAccountPassword(username, password))) {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 1,
                        staffmodlevel: 0,
                        save: null,
                        account_id: -1,
                        members: Environment.node.members
                    });
                    break;
                }

                const staffmodlevel = staffLevelFor(username);

                const profile = Environment.node.profile;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                if (!fs.existsSync(`data/players/${profile}/${username}.sav`)) {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 4,
                        staffmodlevel,
                        save: null,
                        account_id: 1,
                        members: Environment.node.members
                    });
                } else {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 0,
                        staffmodlevel,
                        save: fs.readFileSync(`data/players/${profile}/${username}.sav`),
                        account_id: 1,
                        members: Environment.node.members
                    });
                }
            }
            break;
        }
        case 'player_logout': {
            const { username, save } = msg;

            if (Environment.login.enabled) {
                const success = await client.playerLogout(username, save);

                parentPort.postMessage({
                    type: 'player_logout',
                    username,
                    success
                });
            } else {
                const profile = Environment.node.profile;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                fs.writeFileSync(`data/players/${profile}/${username}.sav`, save);

                parentPort.postMessage({
                    type: 'player_logout',
                    username,
                    success: true
                });
            }
            break;
        }
        case 'player_autosave': {
            const { username, save } = msg;

            if (Environment.login.enabled) {
                await client.playerAutosave(username, save);
            } else {
                const profile = Environment.node.profile;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                fs.writeFileSync(`data/players/${profile}/${username}.sav`, save);
            }
            break;
        }
        case 'player_force_logout': {
            if (Environment.login.enabled) {
                const { username } = msg;
                await client.playerForceLogout(username);
            }
            break;
        }
        case 'player_ban': {
            if (Environment.login.enabled) {
                // todo: wait for confirmation? resend?
                const { staff, username, until } = msg;
                await client.playerBan(staff, username, until);
            }
            break;
        }
        case 'player_mute': {
            if (Environment.login.enabled) {
                // todo: wait for confirmation? resend?
                const { staff, username, until } = msg;
                await client.playerMute(staff, username, until);
            }
            break;
        }
        case 'world_heartbeat': {
            break;
        }
        default:
            console.error('Unknown message type: ' + msg.type);
            break;
    }
}
