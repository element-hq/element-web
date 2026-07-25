/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/** Context menu state owned by EventTile interaction handling. */
export interface EventTileContextMenuState {
    /** Menu anchor position. */
    position: Pick<DOMRect, "top" | "left" | "bottom">;
    /** Optional link target captured from the context-menu target. */
    link?: string;
}

/** Interaction state owned by EventTile. */
export interface EventTileInteractionState {
    /** Whether the action bar is focused. */
    actionBarFocused: boolean;
    /** Whether focus should force the action bar visible. */
    showActionBarFromFocus: boolean;
    /** Whether the tile is currently hovered. */
    hover: boolean;
    /** Whether focus is currently inside the tile. */
    focusWithin: boolean;
    /** Context menu state, when the EventTile context menu is open. */
    contextMenu?: EventTileContextMenuState;
}

/** Initial EventTile interaction state. */
export const initialEventTileInteractionState: EventTileInteractionState = {
    actionBarFocused: false,
    showActionBarFromFocus: false,
    hover: false,
    focusWithin: false,
};

/** Updates interaction state when the tile is hovered. */
export function eventTileMouseEnter(state: EventTileInteractionState): EventTileInteractionState {
    return {
        ...state,
        hover: true,
    };
}

/** Updates interaction state when the tile is no longer hovered. */
export function eventTileMouseLeave(state: EventTileInteractionState): EventTileInteractionState {
    return {
        ...state,
        hover: false,
    };
}

/** Updates interaction state when focus enters the tile. */
export function eventTileFocusWithin(
    state: EventTileInteractionState,
    showActionBarFromFocus: boolean,
): EventTileInteractionState {
    return {
        ...state,
        focusWithin: true,
        showActionBarFromFocus,
    };
}

/** Updates interaction state when focus leaves the tile. */
export function eventTileBlurWithin(state: EventTileInteractionState): EventTileInteractionState {
    return {
        ...state,
        focusWithin: false,
        showActionBarFromFocus: false,
    };
}

/** Updates interaction state when the action bar focus changes. */
export function eventTileActionBarFocusChange(
    state: EventTileInteractionState,
    actionBarFocused: boolean,
    tileHovered: boolean,
): EventTileInteractionState {
    return {
        ...state,
        actionBarFocused,
        hover: actionBarFocused ? state.hover : tileHovered,
    };
}

/** Updates interaction state when stale hover is detected. */
export function eventTileClearHover(state: EventTileInteractionState): EventTileInteractionState {
    return eventTileMouseLeave(state);
}

/** Updates interaction state when the EventTile context menu opens. */
export function eventTileOpenContextMenu(
    state: EventTileInteractionState,
    contextMenu: EventTileContextMenuState,
): EventTileInteractionState {
    return {
        ...state,
        contextMenu,
        actionBarFocused: true,
        hover: false,
    };
}

/** Updates interaction state when the EventTile context menu closes. */
export function eventTileCloseContextMenu(state: EventTileInteractionState): EventTileInteractionState {
    return {
        ...state,
        contextMenu: undefined,
        actionBarFocused: false,
        hover: false,
    };
}
