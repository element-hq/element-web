/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    eventTileActionBarFocusChange,
    eventTileBlurWithin,
    eventTileClearHover,
    eventTileCloseContextMenu,
    eventTileFocusWithin,
    eventTileMouseEnter,
    eventTileMouseLeave,
    eventTileOpenContextMenu,
    initialEventTileInteractionState,
    type EventTileInteractionState,
} from "../../../src/viewmodels/room/timeline/event-tile/EventTileInteractionState";

function makeState(overrides: Partial<EventTileInteractionState> = {}): EventTileInteractionState {
    return {
        ...initialEventTileInteractionState,
        ...overrides,
    };
}

describe("EventTileInteractionState", () => {
    it("tracks hover state", () => {
        const hovered = eventTileMouseEnter(makeState());
        const unhovered = eventTileMouseLeave(hovered);

        expect(hovered.hover).toBe(true);
        expect(unhovered.hover).toBe(false);
    });

    it("tracks focus-within state and keyboard action bar visibility", () => {
        const focused = eventTileFocusWithin(makeState(), true);
        const blurred = eventTileBlurWithin(focused);

        expect(focused.focusWithin).toBe(true);
        expect(focused.showActionBarFromFocus).toBe(true);
        expect(blurred.focusWithin).toBe(false);
        expect(blurred.showActionBarFromFocus).toBe(false);
    });

    it("preserves hover while action bar receives focus", () => {
        const state = makeState({ hover: true });
        const focused = eventTileActionBarFocusChange(state, true, false);

        expect(focused.actionBarFocused).toBe(true);
        expect(focused.hover).toBe(true);
    });

    it("restores hover from the tile when action bar loses focus", () => {
        const state = makeState({ actionBarFocused: true, hover: false });
        const focused = eventTileActionBarFocusChange(state, false, true);

        expect(focused.actionBarFocused).toBe(false);
        expect(focused.hover).toBe(true);
    });

    it("clears stale hover", () => {
        const state = eventTileClearHover(makeState({ hover: true }));

        expect(state.hover).toBe(false);
    });

    it("opens and closes the context menu", () => {
        const menu = {
            position: {
                left: 1,
                top: 2,
                bottom: 3,
            },
            link: "https://example.org/",
        };
        const opened = eventTileOpenContextMenu(makeState({ hover: true }), menu);
        const closed = eventTileCloseContextMenu(opened);

        expect(opened.contextMenu).toEqual(menu);
        expect(opened.actionBarFocused).toBe(true);
        expect(opened.hover).toBe(false);
        expect(closed.contextMenu).toBeUndefined();
        expect(closed.actionBarFocused).toBe(false);
        expect(closed.hover).toBe(false);
    });
});
