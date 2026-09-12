/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const FOCUS_EVENT_TILE_MAX_ATTEMPTS = 90;

export function focusEventTileAfterScroll(eventId: string, attempt = 0): void {
    const tile = document.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(eventId)}"]`);
    if (tile) {
        tile.focus();
        return;
    }
    if (attempt >= FOCUS_EVENT_TILE_MAX_ATTEMPTS) return;
    requestAnimationFrame(() => focusEventTileAfterScroll(eventId, attempt + 1));
}
