/*
Copyright 2025 Clap

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import { CLAP_DEV_FLAGS, type ClapDevFlagKey, type ClapDevFlagsValue } from "../settings/ClapDeveloperFlags";

/**
 * Console API interface for Clap developer flags
 */
export interface ClapDevFlagsConsoleAPI {
    /** Enable a developer flag */
    enable(flag: ClapDevFlagKey): void;
    /** Disable a developer flag */
    disable(flag: ClapDevFlagKey): void;
    /** Toggle a developer flag */
    toggle(flag: ClapDevFlagKey): void;
    /** List all current flag states */
    list(): ClapDevFlagsValue;
    /** Show available flags with descriptions */
    help(): void;
}

/**
 * Get current flags value from settings
 */
function getFlags(): ClapDevFlagsValue {
    return SettingsStore.getValue("clapDeveloperFlags") ?? {};
}

/**
 * Set flags value to settings
 */
function setFlags(flags: ClapDevFlagsValue): void {
    SettingsStore.setValue("clapDeveloperFlags", null, SettingLevel.DEVICE, flags);
}

/**
 * Validate if flag name is valid
 */
function isValidFlag(flag: string): flag is ClapDevFlagKey {
    return flag in CLAP_DEV_FLAGS;
}

/**
 * Console API for managing Clap developer flags
 *
 * Usage in browser console:
 *   mxDevFlags.help()                        // Show available flags
 *   mxDevFlags.enable("showCustomHomeserver") // Enable a flag
 *   mxDevFlags.disable("showCustomHomeserver") // Disable a flag
 *   mxDevFlags.toggle("showCustomHomeserver") // Toggle a flag
 *   mxDevFlags.list()                        // Show current states
 */
export const ClapDevFlagsConsole: ClapDevFlagsConsoleAPI = {
    enable(flag: ClapDevFlagKey): void {
        if (!isValidFlag(flag)) {
            console.error(`❌ Unknown flag: "${flag}". Use mxDevFlags.help() to see available flags.`);
            return;
        }
        const flags = getFlags();
        flags[flag] = true;
        setFlags(flags);
        console.log(`✅ Enabled: ${flag}`);
    },

    disable(flag: ClapDevFlagKey): void {
        if (!isValidFlag(flag)) {
            console.error(`❌ Unknown flag: "${flag}". Use mxDevFlags.help() to see available flags.`);
            return;
        }
        const flags = getFlags();
        flags[flag] = false;
        setFlags(flags);
        console.log(`⛔ Disabled: ${flag}`);
    },

    toggle(flag: ClapDevFlagKey): void {
        if (!isValidFlag(flag)) {
            console.error(`❌ Unknown flag: "${flag}". Use mxDevFlags.help() to see available flags.`);
            return;
        }
        const flags = getFlags();
        const newValue = !flags[flag];
        flags[flag] = newValue;
        setFlags(flags);
        console.log(`🔄 Toggled: ${flag} → ${newValue ? "ON" : "OFF"}`);
    },

    list(): ClapDevFlagsValue {
        const flags = getFlags();
        console.log("📋 Current Clap Developer Flags:");
        console.table(
            Object.keys(CLAP_DEV_FLAGS).map((key) => ({
                Flag: key,
                Enabled: flags[key as ClapDevFlagKey] ?? false,
                Description: CLAP_DEV_FLAGS[key as ClapDevFlagKey],
            })),
        );
        return flags;
    },

    help(): void {
        console.log(`
🔧 Clap Developer Flags Console API
====================================

Available commands:
  mxDevFlags.enable("flagName")   - Enable a flag
  mxDevFlags.disable("flagName")  - Disable a flag
  mxDevFlags.toggle("flagName")   - Toggle a flag
  mxDevFlags.list()               - Show current flag states
  mxDevFlags.help()               - Show this help message

Available flags:
${Object.entries(CLAP_DEV_FLAGS)
    .map(([key, desc]) => `  • ${key}: ${desc}`)
    .join("\n")}

Example:
  mxDevFlags.enable("showCustomHomeserver")
        `);
    },
};

/**
 * Initialize console API by exposing it to window object
 */
export function initClapDevFlagsConsole(): void {
    window.mxDevFlags = ClapDevFlagsConsole;
}
