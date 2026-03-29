/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import UIStore, { UI_EVENTS } from "../../../../../src/stores/UIStore";
import { CollapseOnWindowResizeBehaviour } from "../../../../../src/viewmodels/structures/auto-collapse/behaviours/CollapseOnWindowResizeBehaviour";
import type { CollapseHandler } from "../../../../../src/viewmodels/structures/auto-collapse/CollapseHandler";
import { MockCollapseHandler } from "../mocks";

jest.useFakeTimers();

describe("CollapseOnWindowResizeBehaviour", () => {
    it("Should collapse/expand the panel when the window is resized", () => {
        const collapseHandler = new MockCollapseHandler() as unknown as CollapseHandler;
        new CollapseOnWindowResizeBehaviour(collapseHandler);
        // Making the window smaller should collapse the panel.
        UIStore.instance.emit(UI_EVENTS.WidthDecreased, 750);
        expect(collapseHandler.collapse).toHaveBeenCalledTimes(1);
        // Making the window larger should expand the panel.
        UIStore.instance.emit(UI_EVENTS.WidthIncreased, 950);
        jest.runAllTimers();
        expect(collapseHandler.expand).toHaveBeenCalledTimes(1);
    });

    it("should set shouldIgnoreResize to true when window is being resized", () => {
        const collapseHandler = new MockCollapseHandler() as unknown as CollapseHandler;
        const behaviour = new CollapseOnWindowResizeBehaviour(collapseHandler);
        expect(behaviour.shouldIgnoreResize).toBe(false);
        // When the window is being resized, this behaviour should tell the AutoCollapser to
        // ignore any panel resize events.
        UIStore.instance.isWindowBeingResized = true;
        expect(behaviour.shouldIgnoreResize).toBe(true);
    });

    it("should not auto-collapse panel when user has manually resized the panel", () => {
        const collapseHandler = new MockCollapseHandler();
        const behaviour = new CollapseOnWindowResizeBehaviour(collapseHandler as unknown as CollapseHandler);
        // Let's make the window smaller so that the panel is auto-collapsed.
        UIStore.instance.emit(UI_EVENTS.WidthDecreased, 750);
        expect(collapseHandler.collapse).toHaveBeenCalledTimes(1);
        collapseHandler.collapse.mockClear();
        // Let's say that the user now manually expands the auto-collapsed panel.
        behaviour.onLeftPanelResized();
        // Let's say that the window now became even smaller
        UIStore.instance.emit(UI_EVENTS.WidthDecreased, 500);
        // The panel should not be auto-collapsed again
        expect(collapseHandler.collapse).not.toHaveBeenCalled();
    });

    it("should return correct shouldStartCollapsed", () => {
        const collapseHandler = new MockCollapseHandler();
        new CollapseOnWindowResizeBehaviour(collapseHandler as unknown as CollapseHandler);
        // When the window is smaller than 768px, start collapsed.
        UIStore.instance.windowWidth = 750;
        expect(CollapseOnWindowResizeBehaviour.shouldStartCollapsed()).toBe(true);
        // When the window is larger than 768px, start expanded.
        UIStore.instance.windowWidth = 900;
        expect(CollapseOnWindowResizeBehaviour.shouldStartCollapsed()).toBe(false);
    });
});
