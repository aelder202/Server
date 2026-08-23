import fs from 'fs';
import path from 'path';

import * as bcrypt from 'bcrypt-ts';

export const LOCAL_ACCOUNT_STORE_PATH = 'data/config/local-accounts.json';

type LocalAccount = {
    passwordHash: string;
    createdAt: string;
    updatedAt: string;
};

type LocalAccountStore = {
    version: 1;
    accounts: Record<string, LocalAccount>;
};

function emptyStore(): LocalAccountStore {
    return { version: 1, accounts: {} };
}

export function normalizeLocalUsername(username: string): string {
    return username.trim().toLowerCase();
}

export function loadLocalAccountStore(): LocalAccountStore {
    if (!fs.existsSync(LOCAL_ACCOUNT_STORE_PATH)) {
        return emptyStore();
    }

    const parsed = JSON.parse(fs.readFileSync(LOCAL_ACCOUNT_STORE_PATH, 'utf8')) as Partial<LocalAccountStore>;
    if (parsed.version !== 1 || !parsed.accounts || typeof parsed.accounts !== 'object') {
        throw new Error(`Unsupported local account store at ${LOCAL_ACCOUNT_STORE_PATH}`);
    }

    return parsed as LocalAccountStore;
}

function saveLocalAccountStore(store: LocalAccountStore): void {
    fs.mkdirSync(path.dirname(LOCAL_ACCOUNT_STORE_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_ACCOUNT_STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

export function hasLocalAccountPassword(username: string): boolean {
    return typeof loadLocalAccountStore().accounts[normalizeLocalUsername(username)] !== 'undefined';
}

export function setLocalAccountPassword(username: string, password: string): void {
    const normalized = normalizeLocalUsername(username);
    if (normalized.length === 0) {
        throw new Error('Username cannot be empty.');
    }
    if (password.length < 1 || password.length > 20) {
        throw new Error('Passwords must contain between 1 and 20 characters.');
    }

    const store = loadLocalAccountStore();
    const now = new Date().toISOString();
    const previous = store.accounts[normalized];
    store.accounts[normalized] = {
        passwordHash: bcrypt.hashSync(password.toLowerCase(), 10),
        createdAt: previous?.createdAt ?? now,
        updatedAt: now
    };
    saveLocalAccountStore(store);
}

export function removeLocalAccountPassword(username: string): boolean {
    const store = loadLocalAccountStore();
    const normalized = normalizeLocalUsername(username);
    if (!store.accounts[normalized]) {
        return false;
    }

    delete store.accounts[normalized];
    saveLocalAccountStore(store);
    return true;
}

export async function verifyOrCreateLocalAccountPassword(username: string, password: string): Promise<boolean> {
    try {
        const store = loadLocalAccountStore();
        const normalized = normalizeLocalUsername(username);
        const account = store.accounts[normalized];

        if (account) {
            return await bcrypt.compare(password.toLowerCase(), account.passwordHash);
        }

        // Local worlds historically had no per-character authentication. The
        // first successful login after this upgrade claims the character name.
        setLocalAccountPassword(normalized, password);
        return true;
    } catch (err) {
        console.error('Unable to verify the local character password:', err);
        return false;
    }
}
