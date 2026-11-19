/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { spawnSync } from "node:child_process";

const SECURITY = "/usr/bin/security";

/**
 * The attributes of the macOS keychain item in which Electron keeps the safeStorage key.
 * Only the app which created the item may read it without asking, and a build signed differently counts as another app.
 */
function safeStorageKeychainItem(appName: string): string[] {
    return ["-s", `${appName} Safe Storage`, "-a", `${appName} Key`];
}

/**
 * Whether the app's safeStorage keychain item exists.
 * This reads only the item's attributes, so it never asks the user for access.
 */
export function hasSafeStorageKeychainItem(appName: string): boolean {
    return spawnSync(SECURITY, ["find-generic-password", ...safeStorageKeychainItem(appName)]).status === 0;
}

/**
 * Delete the app's safeStorage keychain item, which works even when the app may not read it.
 * Electron then creates a new item, with a new key, on the next launch.
 * @returns whether the item was deleted
 */
export function deleteSafeStorageKeychainItem(appName: string): boolean {
    return spawnSync(SECURITY, ["delete-generic-password", ...safeStorageKeychainItem(appName)]).status === 0;
}
