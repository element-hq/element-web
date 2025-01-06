/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingsHandler from "./SettingsHandler";

/**
 * Abstract settings handler wrapping around localStorage making getValue calls cheaper
 * by caching the values and listening for localStorage updates from other tabs.
 */
export default abstract class AbstractLocalStorageSettingsHandler extends SettingsHandler {
    // Shared cache between all subclass instances
    private static itemCache = new Map<string, string | null>();
    private static objectCache = new Map<string, object>();
    private static storageListenerBound = false;

    private static onStorageEvent = (e: StorageEvent): void => {
        if (e.key === null) {
            AbstractLocalStorageSettingsHandler.clear();
        } else {
            AbstractLocalStorageSettingsHandler.itemCache.delete(e.key);
            AbstractLocalStorageSettingsHandler.objectCache.delete(e.key);
        }
    };

    private static clear(): void {
        AbstractLocalStorageSettingsHandler.itemCache.clear();
        AbstractLocalStorageSettingsHandler.objectCache.clear();
    }

    protected constructor() {
        super();

        if (!AbstractLocalStorageSettingsHandler.storageListenerBound) {
            AbstractLocalStorageSettingsHandler.storageListenerBound = true;
            // Listen for storage changes from other tabs to bust the cache
            window.addEventListener("storage", AbstractLocalStorageSettingsHandler.onStorageEvent);
        }
    }

    protected getItem(key: string): string | null {
        if (!AbstractLocalStorageSettingsHandler.itemCache.has(key)) {
            const value = localStorage.getItem(key);
            AbstractLocalStorageSettingsHandler.itemCache.set(key, value);
            return value;
        }

        return AbstractLocalStorageSettingsHandler.itemCache.get(key)!;
    }

    protected getBoolean(key: string): boolean | null {
        const item = this.getItem(key);
        if (item === "true") return true;
        if (item === "false") return false;
        // Fall back to the next config level
        return null;
    }

    protected getObject<T extends object>(key: string): T | null {
        if (!AbstractLocalStorageSettingsHandler.objectCache.has(key)) {
            try {
                const value = JSON.parse(localStorage.getItem(key)!);
                AbstractLocalStorageSettingsHandler.objectCache.set(key, value);
                return value;
            } catch (err) {
                console.error("Failed to parse localStorage object", err);
                return null;
            }
        }

        return AbstractLocalStorageSettingsHandler.objectCache.get(key) as T;
    }

    protected setItem(key: string, value: string): void {
        AbstractLocalStorageSettingsHandler.itemCache.set(key, value);
        localStorage.setItem(key, value);
    }

    protected setBoolean(key: string, value: boolean | null): void {
        this.setItem(key, `${value}`);
    }

    protected setObject(key: string, value: object): void {
        AbstractLocalStorageSettingsHandler.objectCache.set(key, value);
        localStorage.setItem(key, JSON.stringify(value));
    }

    // handles both items and objects
    protected removeItem(key: string): void {
        localStorage.removeItem(key);
        AbstractLocalStorageSettingsHandler.itemCache.delete(key);
        AbstractLocalStorageSettingsHandler.objectCache.delete(key);
    }

    public isSupported(): boolean {
        return localStorage !== undefined && localStorage !== null;
    }

    public reset(): void {
        AbstractLocalStorageSettingsHandler.clear();
    }
}
