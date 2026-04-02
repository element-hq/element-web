/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { CollapseHandler } from "../CollapseHandler";

/**
 * The left panel should be auto-collapsed under certain app states.
 * This class provides a base for writing such logic.
 */
export class BaseCollapseBehaviour {
    public constructor(protected readonly collapseHandler: CollapseHandler) {}

    public dispose = (): void => {
        return;
    };

    /**
     * Whether currently arriving left panel resized events should be ignored according
     * to this behaviour.
     */
    public get shouldIgnoreResize(): boolean {
        return false;
    }

    /**
     * Whether the panel should be collapsed at app start according to this behaviour.
     */
    public static shouldStartCollapsed(): boolean {
        return false;
    }

    /**
     * This method is called when the left panel is resized.
     */
    public onLeftPanelResized = (): void => {
        return;
    };
}
