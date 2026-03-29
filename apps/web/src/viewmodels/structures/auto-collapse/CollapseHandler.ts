/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { PanelImperativeHandle } from "@element-hq/web-shared-components";

/**
 * Contains auto-collapsed state and methods to expand/collapse the panel.
 * This class is used by the different auto-collapse behaviours.
 */
export class CollapseHandler {
    /**
     * @param setCollapsed Callback that will be called when the handler changes the collapsed state.
     */
    public constructor(private readonly setCollapsed: (collapsed: boolean) => void) {}

    /**
     * This gives access to the panel's imperative methods.
     */
    public panelHandle?: PanelImperativeHandle;

    /**
     * Whether the left-panel is auto-collapsed.
     */
    public isAutoCollapsed: boolean = false;

    /**
     * Stores the width to which the left-panel should be restored to when the auto-collapsed
     * panel is expanded due to the window being resized.
     */
    private restoreWidth?: number;

    /**
     * Make the panel API from react-resizable-panels available to this class.
     * @param handle The panel handle to access react-resizable-panels API.
     */
    public setHandle = (handle: PanelImperativeHandle): void => {
        this.panelHandle = handle;
        this.restoreWidth = this.panelHandle?.getSize().inPixels;
    };

    /**
     * Update {@link CollapseHandler#restoreWidth} with the up to date width of the left panel.
     */
    public updateRestoreWidth = (): void => {
        // Takes a bit of time for the library to update the pixel values.
        window.setTimeout(() => {
            this.restoreWidth = this.panelHandle?.getSize().inPixels;
        }, 500);
    };

    /**
     * Collapse the left panel.
     */
    public collapse = (): void => {
        this.isAutoCollapsed = true;
        this.panelHandle?.collapse();
        this.setCollapsed(true);
    };

    /**
     * Expand the left panel.
     */
    public expand = (): void => {
        this.isAutoCollapsed = false;
        this.panelHandle?.resize(this.restoreWidth!);
        this.setCollapsed(false);
    };
}
