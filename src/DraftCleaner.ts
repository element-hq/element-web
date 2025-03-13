/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "./MatrixClientPeg";
import { EDITOR_STATE_STORAGE_PREFIX } from "./components/views/rooms/SendMessageComposer";
import { WYSIWYG_EDITOR_STATE_STORAGE_PREFIX } from "./components/views/rooms/MessageComposer";

// The key used to persist the the timestamp we last cleaned up drafts
export const DRAFT_LAST_CLEANUP_KEY = "mx_draft_cleanup";
// The period of time we wait between cleaning drafts
export const DRAFT_CLEANUP_PERIOD = 1000 * 60 * 60 * 24 * 30;

/**
 * Checks if `DRAFT_CLEANUP_PERIOD` has expired, if so, deletes any stord editor drafts that exist for rooms that are not in the known list.
 */
export function cleanUpDraftsIfRequired(): void {
    if (!shouldCleanupDrafts()) {
        return;
    }
    logger.debug(`Cleaning up editor drafts...`);
    cleaupDrafts();
    try {
        localStorage.setItem(DRAFT_LAST_CLEANUP_KEY, String(Date.now()));
    } catch (error) {
        logger.error("Failed to persist draft cleanup key", error);
    }
}

/**
 *
 * @returns {bool} True if the timestamp has not been persisted or the `DRAFT_CLEANUP_PERIOD` has expired.
 */
function shouldCleanupDrafts(): boolean {
    try {
        const lastCleanupTimestamp = localStorage.getItem(DRAFT_LAST_CLEANUP_KEY);
        if (!lastCleanupTimestamp) {
            return true;
        }
        const parsedTimestamp = Number.parseInt(lastCleanupTimestamp || "", 10);
        if (!Number.isInteger(parsedTimestamp)) {
            return true;
        }
        return Date.now() > parsedTimestamp + DRAFT_CLEANUP_PERIOD;
    } catch {
        return true;
    }
}

/**
 * Clear all drafts for the CIDER and WYSIWYG editors if the room does not exist in the known rooms.
 */
function cleaupDrafts(): void {
    for (let i = 0; i < localStorage.length; i++) {
        const keyName = localStorage.key(i);
        if (!keyName) continue;
        let roomId: string | undefined = undefined;
        if (keyName.startsWith(EDITOR_STATE_STORAGE_PREFIX)) {
            roomId = keyName.slice(EDITOR_STATE_STORAGE_PREFIX.length).split("_$")[0];
        }
        if (keyName.startsWith(WYSIWYG_EDITOR_STATE_STORAGE_PREFIX)) {
            roomId = keyName.slice(WYSIWYG_EDITOR_STATE_STORAGE_PREFIX.length).split("_$")[0];
        }
        if (!roomId) continue;
        // Remove the prefix and the optional event id suffix to leave the room id
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (!room) {
            logger.debug(`Removing draft for unknown room with key ${keyName}`);
            localStorage.removeItem(keyName);
        }
    }
}
