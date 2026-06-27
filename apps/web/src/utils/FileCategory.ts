/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { isVoiceMessage } from "./EventUtils";

/**
 * Telegram-style typed media tabs for the {@link FilePanel} (search Phase 4).
 *
 * {@link All} is a tab selector only (every media event); {@link getFileCategory} never returns it. A "Links" tab is
 * intentionally absent in v1 — the FilePanel data source (`contains_url` server filter / Seshat `loadFileEvents`)
 * returns events with a `content.url` *field* (media), not messages with hyperlinks in their body text, so a real
 * Links tab needs a separate link-extraction data source. See `memorybank/search-phase4-plan.md`.
 */
export enum FileCategory {
    All = "all",
    Media = "media",
    Files = "files",
    Music = "music",
    Voice = "voice",
}

/** The media tabs in display order (All first, then the typed categories). */
export const FILE_CATEGORY_TABS: readonly FileCategory[] = [
    FileCategory.All,
    FileCategory.Media,
    FileCategory.Files,
    FileCategory.Music,
    FileCategory.Voice,
] as const;

/**
 * Classify a media event into one of the typed categories, or `null` if it is not a shared-media event.
 *
 * Voice messages (`m.audio` carrying the MSC3245/MSC2516 voice flag) are split out from {@link FileCategory.Music}.
 * Never returns {@link FileCategory.All} (that is a tab selector, not a classification).
 */
export function getFileCategory(ev: MatrixEvent): FileCategory | null {
    if (ev.getType() !== EventType.RoomMessage) return null;

    switch (ev.getContent().msgtype) {
        case MsgType.Image:
        case MsgType.Video:
            return FileCategory.Media;
        case MsgType.File:
            return FileCategory.Files;
        case MsgType.Audio:
            return isVoiceMessage(ev) ? FileCategory.Voice : FileCategory.Music;
        default:
            return null;
    }
}

/**
 * Whether an event belongs under the given tab. {@link FileCategory.All} matches any media event; a typed category
 * matches only its own classification.
 */
export function eventMatchesCategory(ev: MatrixEvent, category: FileCategory): boolean {
    const eventCategory = getFileCategory(ev);
    if (eventCategory === null) return false;
    return category === FileCategory.All || eventCategory === category;
}

/**
 * Whether an event matches the in-tab text filter. An empty/whitespace term matches everything. Otherwise a
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
 * Build the display predicate for the FilePanel timeline from the active tab and search term: an event shows iff it
 * belongs to the category AND matches the search term.
 */
export function buildFileEventFilter(category: FileCategory, searchTerm: string): (ev: MatrixEvent) => boolean {
    return (ev) => eventMatchesCategory(ev, category) && eventMatchesFileSearch(ev, searchTerm);
}
