/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Streams } from "electron";

type DisplayMediaCallback = (streams: Streams) => void;

let displayMediaCallback: DisplayMediaCallback | null = null;

export const setDisplayMediaCallback = (callback: DisplayMediaCallback | null): void => {
    displayMediaCallback = callback;
};

/**
 * Atomically read and clear the pending display-media callback.
 *
 * The screen-share request handler stores a single callback per request (see
 * electron-main.ts). Reading-and-clearing in one step guarantees consume-once
 * semantics: a duplicate or stale `callDisplayMediaCallback` IPC — e.g. left over
 * from the macOS 15+ native picker path, which never consumes it via the renderer —
 * resolves to `null` and becomes a safe no-op instead of invoking a stale callback twice.
 */
export const consumeDisplayMediaCallback = (): DisplayMediaCallback | null => {
    const callback = displayMediaCallback;
    displayMediaCallback = null;
    return callback;
};
