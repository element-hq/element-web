/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * This is the id given to the resizable container that holds
 * the left panel contents.
 */
export const LEFT_PANEL_ID = "left-panel";

export * from "./group/GroupView";
export * from "./separator/SeparatorView";
export * from "./panel/LeftResizablePanelView";

/**
 * Common snapshot for GroupView, SeparatorView and LeftResizablePanelView.
 */
export interface ResizerViewSnapshot {
    /**
     * Whether the left panel is collapsed or not.
     */
    isCollapsed: boolean;
    /**
     * This is the initial size of the panel if available; should be interpreted as percentage.
     */
    initialSize?: number;
    /**
     * Whether the separator is currently focused by navigating
     * to it using keyboard input.
     */
    isFocusedViaKeyboard: boolean;
}

/**
 * Export relevant parts of the underlying library.
 */
export { Group, Panel, Separator, type PanelSize, type PanelImperativeHandle } from "react-resizable-panels";
