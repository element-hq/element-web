/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

/**
 * The shared-media type filters offered by the {@link FilePanel} (search Phase 4).
 *
 * There is deliberately no "all" member: the filter is a toggle, and *no* selected category means every media
 * event shows. A "Links" category is intentionally absent in v1 — the FilePanel data source (`contains_url`
 * server filter / Seshat `loadFileEvents`) returns events with a `content.url` *field* (media), not messages with
 * hyperlinks in their body text, so a real Links filter needs a separate link-extraction data source. See
 * `memorybank/search-phase4-plan.md`.
 */
export enum FileCategory {
    Documents = "documents",
    Images = "images",
    Videos = "videos",
    Audio = "audio",
}

/** The category filters in display order. */
export const FILE_CATEGORY_FILTERS: readonly FileCategory[] = [
    FileCategory.Documents,
    FileCategory.Images,
    FileCategory.Videos,
    FileCategory.Audio,
] as const;

/**
 * Classify a media event into one of the categories, or `null` if it is not a shared-media event.
 *
 * Voice messages are not split out of {@link FileCategory.Audio}: both plain `m.audio` and its
 * MSC3245/MSC2516 voice-message flavour are audio to the user.
 */
export function getFileCategory(ev: MatrixEvent): FileCategory | null {
    if (ev.getType() !== EventType.RoomMessage) return null;

    switch (ev.getContent().msgtype) {
        case MsgType.Image:
            return FileCategory.Images;
        case MsgType.Video:
            return FileCategory.Videos;
        case MsgType.File:
            return FileCategory.Documents;
        case MsgType.Audio:
            return FileCategory.Audio;
        default:
            return null;
    }
}

/**
 * Whether an event belongs under the given category filter. A `null` category (nothing selected) matches any
 * shared-media event; a concrete category matches only its own classification.
 */
export function eventMatchesCategory(ev: MatrixEvent, category: FileCategory | null): boolean {
    const eventCategory = getFileCategory(ev);
    if (eventCategory === null) return false;
    return category === null || eventCategory === category;
}

/**
 * Whether an event matches the text filter. An empty/whitespace term matches everything. Otherwise a
 * case-insensitive substring match against both the `filename` field and the `body` caption (so either the real
 * file name or a caption finds the event).
 */
export function eventMatchesFileSearch(ev: MatrixEvent, rawTerm: string): boolean {
    const term = rawTerm.trim().toLowerCase();
    if (!term) return true;

    const content = ev.getContent();
    const haystack = [content.filename, content.body].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(term);
}

/**
 * Build the display predicate for the FilePanel timeline from the selected category and search term: an event
 * shows iff it belongs to the category AND matches the search term.
 */
export function buildFileEventFilter(category: FileCategory | null, searchTerm: string): (ev: MatrixEvent) => boolean {
    return (ev) => eventMatchesCategory(ev, category) && eventMatchesFileSearch(ev, searchTerm);
}
