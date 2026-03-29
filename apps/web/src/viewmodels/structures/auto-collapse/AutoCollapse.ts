/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { PanelImperativeHandle } from "@element-hq/web-shared-components";
import { CollapseHandler } from "./CollapseHandler";
import type { BaseCollapseBehaviour } from "./behaviours/BaseCollapseBehaviour";
import { Behaviours } from "./behaviours/behaviours";

/**
 * This class orchestrates all the auto-collapse behaviours.
 */
export class AutoCollapse {
    private readonly behaviours: BaseCollapseBehaviour[] = [];
    private readonly collapseHandler: CollapseHandler;

    public constructor(setCollapsed: (collapsed: boolean) => void) {
        this.collapseHandler = new CollapseHandler(setCollapsed);
        for (const Behaviour of Behaviours) {
            this.behaviours.push(new Behaviour(this.collapseHandler));
        }
    }

    /**
     * When this returns true, any left panel resized events should be ignored.
     */
    public get shouldIgnoreResize(): boolean {
        return this.behaviours.some((b) => b.shouldIgnoreResize);
    }

    /**
     * Whether the panel is currently auto-collapsed.
     */
    public get isAutoCollapsed(): boolean {
        return this.collapseHandler.isAutoCollapsed;
    }

    /**
     * Returns boolean indicating whether the left panel should be collapsed at app start.
     */
    public static shouldStartCollapsed(): boolean {
        return Behaviours.some((B) => B.shouldStartCollapsed());
    }

    public dispose = (): void => {
        for (const behaviour of this.behaviours) {
            behaviour.dispose();
        }
    };

    /**
     * Make the panel API from react-resizable-panels available to this class.
     * @param handle The panel handle to access react-resizable-panels API
     */
    public setHandle = (handle: PanelImperativeHandle): void => {
        this.collapseHandler.setHandle(handle);
    };

    /**
     * Should be called when the left panel is resized.
     */
    public onLeftPanelResized = (): void => {
        for (const behaviour of this.behaviours) {
            behaviour.onLeftPanelResized();
        }
        this.collapseHandler.isAutoCollapsed = false;
        this.collapseHandler.updateRestoreWidth();
    };
}
