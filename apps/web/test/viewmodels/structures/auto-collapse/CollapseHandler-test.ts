/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { CollapseHandler } from "../../../../src/viewmodels/structures/auto-collapse/CollapseHandler";

function getCollapseHandler() {
    const expandPanel = jest.fn();
    const collapsePanel = jest.fn();
    const collapseHandler = new CollapseHandler(expandPanel, collapsePanel, 0);
    return { collapseHandler, expandPanel, collapsePanel };
}

describe("CollapseHandler", () => {
    it("should be possible to collapse and expand the panel", () => {
        const { collapseHandler, expandPanel, collapsePanel } = getCollapseHandler();
        collapseHandler.collapse();
        expect(collapseHandler.isAutoCollapsed).toBe(true);
        expect(collapsePanel).toHaveBeenCalledTimes(1);

        collapseHandler.expand();
        expect(collapseHandler.isAutoCollapsed).toBe(false);
        expect(expandPanel).toHaveBeenCalledTimes(1);
    });

    it("should retain auto collapsed state on sequential calls of expand and collapse", () => {
        const { collapseHandler, expandPanel, collapsePanel } = getCollapseHandler();
        // behaviour X collapses the panel
        collapseHandler.collapse();
        expect(collapsePanel).toHaveBeenCalledTimes(1);

        // behaviour Y collapses the panel
        collapseHandler.collapse();
        // Since panel is already collapsed, we do not expect another call.
        expect(collapsePanel).toHaveBeenCalledTimes(1);

        // behaviour Y expands the panel
        collapseHandler.expand();
        // should still be auto collapsed because behaviour X hasn't expanded the panel
        expect(collapseHandler.isAutoCollapsed).toBe(true);
        // The actual panel should not be expanded yet
        expect(expandPanel).toHaveBeenCalledTimes(0);

        // behaviour Y expands the panel
        collapseHandler.expand();
        // all behaviours have expanded the panel, so no longer auto collapsed
        expect(collapseHandler.isAutoCollapsed).toBe(false);
        expect(expandPanel).toHaveBeenCalledTimes(1);
    });
});
