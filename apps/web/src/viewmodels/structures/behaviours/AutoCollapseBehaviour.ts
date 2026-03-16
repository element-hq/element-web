/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { throttle } from "lodash";

import type { PanelImperativeHandle } from "@element-hq/web-shared-components";
import UIStore, { UI_EVENTS } from "../../../stores/UIStore";

/**
 * The viewport width below which the left panel will be auto-collapsed.
 */
const AUTO_COLLAPSE_WIDTH = 768;

/**
 * This class implements the auto-collapse behaviour of the left-panel.
 */
export class AutoCollapseBehaviour {
    private panelHandle?: PanelImperativeHandle;

    /**
     * Whether the left-panel was auto-collapsed due to the window being resized.
     */
    public isAutoCollapsed: boolean = false;

    /**
     * Stores the width to which the left-panel should be restored to when the auto-collapsed
     * panel is expanded due to the window being resized.
     */
    private restoreWidth?: number;

    public constructor(private readonly setCollapsed: (collapsed: boolean) => void) {
        UIStore.instance.on(UI_EVENTS.WidthIncreased, this.onWindowWidthIncreased);
        UIStore.instance.on(UI_EVENTS.WidthDecreased, this.onWindowWidthDecreased);
    }

    /**
     * Remove's any event listeners used by this class.
     */
    public dispose = (): void => {
        UIStore.instance.off(UI_EVENTS.WidthIncreased, this.onWindowWidthIncreased);
        UIStore.instance.off(UI_EVENTS.WidthDecreased, this.onWindowWidthDecreased);
    };

    /**
     * Make the panel API from react-resizable-panels available to this class.
     * @param handle The panel handle to access react-resizable-panels API
     */
    public setHandle = (handle: PanelImperativeHandle): void => {
        this.panelHandle = handle;
        this.restoreWidth = this.panelHandle?.getSize().inPixels;
    };

    /**
     * Should be called when the left panel is resized.
     */
    public onLeftPanelResized = (): void => {
        this.isAutoCollapsed = false;
        this.restoreWidth = this.panelHandle?.getSize().inPixels;
    };

    /**
     * Whether the window is currently being resized.
     */
    public get isResizeInProgress(): boolean {
        return UIStore.instance.isWindowBeingResized;
    }

    /**
     * Returns boolean indicating whether the left panel should be collapsed at app start.
     */
    public static shouldStartCollapsed(): boolean {
        return UIStore.instance.windowWidth <= AUTO_COLLAPSE_WIDTH;
    }

    private onWindowWidthDecreased = throttle((currentWindowWidth: number): void => {
        // If the panel is already auto-collapsed, we have nothing else left to do.
        if (this.isAutoCollapsed) return;

        if (currentWindowWidth <= AUTO_COLLAPSE_WIDTH) {
            this.isAutoCollapsed = true;
            this.panelHandle?.collapse();
            this.setCollapsed(true);
        }
    }, 50);

    private onWindowWidthIncreased = throttle((currentWindowWidth: number): void => {
        // If the panel isn't already collapsed, we have nothing to do.
        if (!this.isAutoCollapsed) return;

        if (currentWindowWidth > AUTO_COLLAPSE_WIDTH) {
            // As the window is resized, react-resizable-panels is also resizing the panels.
            // We'll expand the panel after a second to avoid racing with the library logic.
            window.setTimeout(() => {
                this.isAutoCollapsed = false;
                this.panelHandle?.resize(this.restoreWidth!);
                this.setCollapsed(false);
            }, 1000);
        }
    }, 50);
}
