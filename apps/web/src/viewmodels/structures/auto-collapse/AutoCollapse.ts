/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { CollapseHandler } from "./CollapseHandler";
import type { BaseCollapseBehaviour } from "./behaviours/BaseCollapseBehaviour";
import { Behaviours } from "./behaviours/behaviours";

/**
 * This class orchestrates all the auto-collapse behaviours.
 */
export class AutoCollapse {
    private readonly behaviours: BaseCollapseBehaviour[] = [];
    private readonly collapseHandler: CollapseHandler;

    /**
     * @param expandPanel Callback that should expand the left panel
     * @param collapsePanel Callback that should collapse the left panel
     */
    public constructor(expandPanel: () => void, collapsePanel: () => void) {
        // Calculate the initial value for autoCollapsedCount
        const initialAutoCollapsedCount = Behaviours.reduce(
            (count, B) => (B.shouldStartCollapsed() ? count + 1 : count),
            0,
        );
        this.collapseHandler = new CollapseHandler(expandPanel, collapsePanel, initialAutoCollapsedCount);

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

    /**
     * Dispose the behaviours in sequence.
     */
    public dispose = (): void => {
        for (const behaviour of this.behaviours) {
            behaviour.dispose();
        }
    };

    /**
     * Should be called when the left panel is resized.
     */
    public onLeftPanelResized = (): void => {
        this.collapseHandler.onLeftPanelResized();
    };
}
