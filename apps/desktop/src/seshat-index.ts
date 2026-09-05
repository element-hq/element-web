/*
Copyright 2026 Hiroshi Shinaoka

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Seshat as SeshatType, SeshatRecovery as SeshatRecoveryType } from "matrix-seshat";
import { createSeshatConfig } from "./seshat-config.js";

type SeshatConfig = NonNullable<ConstructorParameters<typeof SeshatType>[1]>;

export interface SeshatIndexDependencies {
    mkdir(path: string, options: { recursive: true }): Promise<string | undefined>;
    deleteContents(path: string): Promise<void>;
    createSeshat(path: string, config: SeshatConfig): SeshatType;
    createSeshatRecovery(path: string, config: SeshatConfig): SeshatRecoveryType;
    isReindexError(error: unknown): boolean;
}

export interface InitEventIndexResult {
    eventIndex: SeshatType;
    wasRecreated?: boolean;
}

export async function initEventIndex(
    eventStorePath: string,
    passphrase: string,
    tokenizerMode: string | undefined,
    dependencies: SeshatIndexDependencies,
): Promise<InitEventIndexResult> {
    const seshatConfig = { passphrase, ...createSeshatConfig(tokenizerMode) };

    await dependencies.mkdir(eventStorePath, { recursive: true });

    try {
        return { eventIndex: dependencies.createSeshat(eventStorePath, seshatConfig) };
    } catch (e) {
        if (dependencies.isReindexError(e)) {
            // If this is a reindex error, the index schema changed. Try to open the
            // database in recovery mode, reindex the database and finally try to
            // open the database again.
            const recoveryIndex = dependencies.createSeshatRecovery(eventStorePath, seshatConfig);
            const userVersion = await recoveryIndex.getUserVersion();

            // If our user version is 0 we'll delete the db anyways so reindexing it is a waste of time.
            if (userVersion === 0) {
                await recoveryIndex.shutdown();
                await dependencies.deleteContents(eventStorePath);
                return { eventIndex: dependencies.createSeshat(eventStorePath, seshatConfig), wasRecreated: true };
            } else {
                await recoveryIndex.reindex();
            }

            return { eventIndex: dependencies.createSeshat(eventStorePath, seshatConfig) };
        }

        // For non-reindex errors (e.g. bad passphrase, filesystem lock),
        // propagate to the caller so the user sees an error instead of
        // silently losing their search index.
        throw e;
    }
}
