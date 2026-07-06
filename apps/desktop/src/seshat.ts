/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app } from "electron";
import { promises as afs } from "node:fs";
import path from "node:path";

import type {
    Seshat as SeshatType,
    SeshatRecovery as SeshatRecoveryType,
    ReindexError as ReindexErrorType,
} from "matrix-seshat"; // Hak dependency type
import { randomArray } from "./utils.js";
import type Store from "./store.js";
import { typedIpcMain } from "./ipc.js";

let seshatSupported = false;
let Seshat: typeof SeshatType;
let SeshatRecovery: typeof SeshatRecoveryType;
let ReindexError: typeof ReindexErrorType;

try {
    const seshatModule = await import("matrix-seshat");
    Seshat = seshatModule.Seshat;
    SeshatRecovery = seshatModule.SeshatRecovery;
    ReindexError = seshatModule.ReindexError;
    seshatSupported = true;
} catch (e) {
    if ((<NodeJS.ErrnoException>e).code === "MODULE_NOT_FOUND") {
        console.log("Seshat isn't installed, event indexing is disabled.");
    } else {
        console.warn("Seshat unexpected error:", e);
    }
}

let eventIndex: SeshatType | null = null;

const seshatDefaultPassphrase = "DEFAULT_PASSPHRASE";
async function getOrCreatePassphrase(store: Store, key: string): Promise<string> {
    try {
        const storedPassphrase = await store.getSecret(key);
        if (storedPassphrase !== undefined) {
            return storedPassphrase;
        }
    } catch (e) {
        console.error("Error getting the event index passphrase out of the secret store", e);
    }

    try {
        const newPassphrase = await randomArray(32);
        await store.setSecret(key, newPassphrase);
        return newPassphrase;
    } catch (e) {
        console.error("Error creating new event index passphrase, using default", e);
    }

    return seshatDefaultPassphrase;
}

const deleteContents = async (p: string): Promise<void> => {
    try {
        for (const entry of await afs.readdir(p)) {
            const curPath = path.join(p, entry);
            try {
                await afs.unlink(curPath);
            } catch (e) {
                console.log("Error deleting a file in EventStore directory", e);
            }
        }
    } catch (e) {
        console.log("Error reading the files in EventStore directory", e);
    }
};

export function setupListeners(store: Store): void {
    // We do this here to ensure we get the path after --profile has been resolved
    const eventStorePath = path.join(app.getPath("userData"), "EventStore");

    typedIpcMain.handle("seshat.supportsEventIndexing", () => seshatSupported);
    typedIpcMain.handle("seshat.initEventIndex", async (_, userId, deviceId) => {
        if (eventIndex !== null) return;

        const passphraseKey = `seshat|${userId}|${deviceId}`;

        const passphrase = await getOrCreatePassphrase(store, passphraseKey);

        try {
            await afs.mkdir(eventStorePath, { recursive: true });
            eventIndex = new Seshat(eventStorePath, { passphrase });
        } catch (e) {
            if (e instanceof ReindexError) {
                // If this is a reindex error, the index schema
                // changed. Try to open the database in recovery mode,
                // reindex the database and finally try to open the
                // database again.
                const recoveryIndex = new SeshatRecovery(eventStorePath, {
                    passphrase,
                });

                const userVersion = await recoveryIndex.getUserVersion();

                // If our user version is 0 we'll delete the db
                // anyways so reindexing it is a waste of time.
                if (userVersion === 0) {
                    await recoveryIndex.shutdown();
                    await deleteContents(eventStorePath);
                } else {
                    await recoveryIndex.reindex();
                }

                eventIndex = new Seshat(eventStorePath, { passphrase });
            } else {
                throw e;
            }
        }
    });
    typedIpcMain.handle("seshat.closeEventIndex", async () => {
        if (eventIndex === null) return;

        const index = eventIndex;
        eventIndex = null;

        await index.shutdown();
    });
    typedIpcMain.handle("seshat.deleteEventIndex", () => deleteContents(eventStorePath));
    typedIpcMain.handle("seshat.isEventIndexEmpty", () => eventIndex?.isEmpty() ?? true);
    typedIpcMain.handle("seshat.isRoomIndexed", (_, roomId) => eventIndex?.isRoomIndexed(roomId) ?? false);
    typedIpcMain.handle("seshat.addEventToIndex", (_, matrixEvent, profile) =>
        eventIndex?.addEvent(matrixEvent, profile),
    );
    typedIpcMain.handle("seshat.deleteEvent", (_, eventId) => eventIndex?.deleteEvent(eventId) ?? false);
    typedIpcMain.handle("seshat.commitLiveEvents", () => eventIndex?.commit() ?? 0);
    typedIpcMain.handle("seshat.searchEventIndex", (_, searchArgs) => eventIndex?.search(searchArgs));
    typedIpcMain.handle(
        "seshat.addHistoricEvents",
        (_, events, newCheckpoint, oldCheckpoint) =>
            eventIndex?.addHistoricEvents(events, newCheckpoint ?? undefined, oldCheckpoint ?? undefined) ?? false,
    );
    typedIpcMain.handle("seshat.getStats", () => eventIndex?.getStats());
    typedIpcMain.handle("seshat.removeCrawlerCheckpoint", (_, checkpoint) =>
        eventIndex?.removeCrawlerCheckpoint(checkpoint),
    );
    typedIpcMain.handle("seshat.addCrawlerCheckpoint", (_, checkpoint) => eventIndex?.addCrawlerCheckpoint(checkpoint));
    typedIpcMain.handle("seshat.loadFileEvents", (_, args) => eventIndex?.loadFileEvents(args) ?? []);
    typedIpcMain.handle("seshat.loadCheckpoints", async () => {
        try {
            return (await eventIndex?.loadCheckpoints()) ?? [];
        } catch {
            return [];
        }
    });
    typedIpcMain.handle("seshat.setUserVersion", (_, version) => eventIndex?.setUserVersion(version));
    typedIpcMain.handle("seshat.getUserVersion", () => eventIndex?.getUserVersion());
}
