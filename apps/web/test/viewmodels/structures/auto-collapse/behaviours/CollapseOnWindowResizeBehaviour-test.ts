/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import UIStore, { UI_EVENTS } from "../../../../../src/stores/UIStore";
import { CollapseOnWindowResizeBehaviour } from "../../../../../src/viewmodels/structures/auto-collapse/behaviours/CollapseOnWindowResizeBehaviour";
import { CollapseHandler } from "../../../../../src/viewmodels/structures/auto-collapse/CollapseHandler";

jest.useFakeTimers();

describe("CollapseOnWindowResizeBehaviour", () => {
    it("Should collapse/expand the panel when the window is resized", () => {
        const expandPanel = jest.fn();
        const collapsePanel = jest.fn();
        const collapseHandler = new CollapseHandler(expandPanel, collapsePanel, 0);
        // @ts-ignore
        // eslint-disable-next-line
        const behaviour = new CollapseOnWindowResizeBehaviour(collapseHandler);
        // Making the window smaller should collapse the panel.
        UIStore.instance.emit(UI_EVENTS.WidthDecreased, 750);
        expect(collapsePanel).toHaveBeenCalledTimes(1);
        // Making the window larger should expand the panel.
        UIStore.instance.emit(UI_EVENTS.WidthIncreased, 950);
        jest.runAllTimers();
        expect(expandPanel).toHaveBeenCalledTimes(1);
    });

    it("should set shouldIgnoreResize to true when window is being resized", () => {
        const collapseHandler = new CollapseHandler(jest.fn(), jest.fn(), 0);
        const behaviour = new CollapseOnWindowResizeBehaviour(collapseHandler);
        expect(behaviour.shouldIgnoreResize).toBe(false);
        // When the window is being resized, this behaviour should indicate that resize events
        // should be ignored.
        UIStore.instance.isWindowBeingResized = true;
        expect(behaviour.shouldIgnoreResize).toBe(true);
    });

    it("should return correct shouldStartCollapsed", () => {
        const collapseHandler = new CollapseHandler(jest.fn(), jest.fn(), 0);
        // @ts-ignore
        // eslint-disable-next-line
        const behaviour = new CollapseOnWindowResizeBehaviour(collapseHandler);
        // When the window is smaller than 768px, start collapsed.
        UIStore.instance.windowWidth = 750;
        expect(CollapseOnWindowResizeBehaviour.shouldStartCollapsed()).toBe(true);
        // When the window is larger than 768px, start expanded.
        UIStore.instance.windowWidth = 900;
        expect(CollapseOnWindowResizeBehaviour.shouldStartCollapsed()).toBe(false);
    });
});
