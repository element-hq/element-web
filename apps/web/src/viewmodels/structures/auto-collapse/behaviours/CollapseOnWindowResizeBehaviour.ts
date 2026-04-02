/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { throttle } from "lodash";

import UIStore, { UI_EVENTS } from "../../../../stores/UIStore";
import { BaseCollapseBehaviour } from "./BaseCollapseBehaviour";
import type { CollapseHandler } from "../CollapseHandler";

/**
 * The viewport width below which the left panel will be auto-collapsed.
 */
const AUTO_COLLAPSE_WIDTH = 768;

/**
 * Implements auto-collapse logic that collapses and expands the left panel when the
 * app window is resized.
 */
export class CollapseOnWindowResizeBehaviour extends BaseCollapseBehaviour {
    /**
     * If this boolean is true, we won't auto collapse the panel when the
     * window is resized to be smaller than AUTO_COLLAPSE_WIDTH.
     *
     * If the panel is auto-collapsed and then the user manually expands the
     * panel, we want to make sure that further window resizing does not collapse
     * the panel.
     */
    private disableAutoCollapse = false;

    public constructor(collapseHandler: CollapseHandler) {
        super(collapseHandler);
        UIStore.instance.on(UI_EVENTS.WidthIncreased, this.onWindowWidthIncreased);
        UIStore.instance.on(UI_EVENTS.WidthDecreased, this.onWindowWidthDecreased);
    }

    private onWindowWidthDecreased = throttle((currentWindowWidth: number): void => {
        // If the panel is already collapsed, we have nothing else left to do.
        if (this.collapseHandler.isAutoCollapsed || this.collapseHandler.panelHandle?.isCollapsed()) return;

        // We were already auto-collapsed and the user has manually resized the panel.
        // Don't auto-collapse again.
        if (this.disableAutoCollapse) return;

        if (currentWindowWidth <= AUTO_COLLAPSE_WIDTH) {
            this.collapseHandler.collapse();
            console.log("\t collapsed panel");
        }
    }, 50);

    public onLeftPanelResized = (): void => {
        if (this.collapseHandler.isAutoCollapsed) {
            // Track that the user has manually resized the auto-collapsed panel.
            this.disableAutoCollapse = true;
        }
    };

    private onWindowWidthIncreased = throttle((currentWindowWidth: number): void => {
        if (currentWindowWidth > AUTO_COLLAPSE_WIDTH) {
            // Reset the flag when we cross the collapse width boundary.
            this.disableAutoCollapse = false;
            // If the panel isn't already collapsed, we don't need to expand the panel.
            if (!this.collapseHandler.isAutoCollapsed) return;
            // As the window is resized, react-resizable-panels is also resizing the panels.
            // We'll expand the panel after a second to avoid racing with the library logic.
            window.setTimeout(() => {
                // this.disableAutoCollapse = false;
                this.collapseHandler.expand();
            }, 1000);
        }
    }, 50);

    /**
     * Whether the window is currently being resized.
     */
    public get shouldIgnoreResize(): boolean {
        // When the window is resized, the panel is resized in various ways.
        // These transient changes should not be persisted in settings.
        // So early return if that is the case.
        return UIStore.instance.isWindowBeingResized;
    }

    /**
     * Remove's any event listeners used by this class.
     */
    public dispose = (): void => {
        UIStore.instance.off(UI_EVENTS.WidthIncreased, this.onWindowWidthIncreased);
        UIStore.instance.off(UI_EVENTS.WidthDecreased, this.onWindowWidthDecreased);
    };

    public static shouldStartCollapsed(): boolean {
        return UIStore.instance.windowWidth <= AUTO_COLLAPSE_WIDTH;
    }
}
