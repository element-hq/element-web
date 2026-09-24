/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { debounce } from "lodash";
import { logger } from "matrix-js-sdk/src/logger";

import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import { type PdfViewerState } from "../@types/pdf-viewer";

const loggerPdfState = logger.getChild("pdfViewerState");

/**
 * How many files we remember a position for. Reading positions are cheap to lose and expensive to
 * accumulate — the setting is serialised in full on every write — so the least recently updated
 * entries are dropped once the map grows past this.
 */
export const PDF_VIEWER_STATE_LIMIT = 100;

/**
 * Scrolling reports a new position on every frame. Coalesce them so that a scroll through a long
 * document is a couple of writes rather than hundreds, while `maxWait` keeps a continuous scroll from
 * deferring the write indefinitely.
 */
const SAVE_DEBOUNCE_MS = 1000;
const SAVE_MAX_WAIT_MS = 5000;

/** Positions recorded since the last write, keyed by MXC URI. */
const pendingStates = new Map<string, PdfViewerState>();

/**
 * Drop the least recently updated entries until the map is within {@link PDF_VIEWER_STATE_LIMIT}.
 */
function evictOldest(states: Record<string, PdfViewerState>): Record<string, PdfViewerState> {
    const entries = Object.entries(states);
    if (entries.length <= PDF_VIEWER_STATE_LIMIT) return states;

    entries.sort(([, a], [, b]) => b.updatedAt - a.updatedAt);

    return Object.fromEntries(entries.slice(0, PDF_VIEWER_STATE_LIMIT));
}

async function writePendingStates(): Promise<void> {
    if (pendingStates.size === 0) return;

    const states = Object.fromEntries(pendingStates);
    pendingStates.clear();

    // Re-read rather than close over an earlier value: another viewer may have written in the
    // meantime, and a whole-map setting would otherwise lose their entry.
    const stored = SettingsStore.getValue("pdfViewerState");

    await SettingsStore.setValue("pdfViewerState", null, SettingLevel.DEVICE, evictOldest({ ...stored, ...states }));
}

const flushPending = (): void => {
    void writePendingStates().catch((error: unknown) => {
        loggerPdfState.warn("Unable to persist PDF viewer state", error);
    });
};

const debouncedFlush = debounce(flushPending, SAVE_DEBOUNCE_MS, { maxWait: SAVE_MAX_WAIT_MS });

/**
 * The position last recorded for a file, if there is one.
 *
 * @param uri - MXC URI of the PDF.
 */
export function getPdfViewerState(uri: string): PdfViewerState | undefined {
    const pending = pendingStates.get(uri);
    if (pending) return pending;

    return SettingsStore.getValue("pdfViewerState")[uri];
}

/**
 * Record where the reader has got to in a file. The write itself is debounced, so this is cheap
 * enough to call for every scroll event.
 *
 * @param uri - MXC URI of the PDF.
 * @param state - Position to remember, without the timestamp used for eviction.
 */
export function setPdfViewerState(uri: string, state: Omit<PdfViewerState, "updatedAt">): void {
    pendingStates.set(uri, { ...state, updatedAt: Date.now() });
    debouncedFlush();
}

/**
 * Write any pending positions out now. Call this when a viewer closes, so that the last position
 * before it went away is not lost with the outstanding debounce.
 */
export function flushPdfViewerState(): void {
    debouncedFlush.cancel();
    flushPending();
}
