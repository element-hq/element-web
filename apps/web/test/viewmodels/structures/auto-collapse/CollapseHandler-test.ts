/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { PanelImperativeHandle } from "@element-hq/web-shared-components";
import { CollapseHandler } from "../../../../src/viewmodels/structures/auto-collapse/CollapseHandler";
import { MockPanelHandle } from "./mocks";

function setup() {
    const setCollapsed = jest.fn();
    const panelHandle = new MockPanelHandle();
    const collapseHandler = new CollapseHandler(setCollapsed);
    collapseHandler.setHandle(panelHandle as unknown as PanelImperativeHandle);
    return { collapseHandler, panelHandle, setCollapsed };
}

jest.useFakeTimers();

describe("CollapseHandler", () => {
    it("should collapse panel on collapse()", () => {
        const { collapseHandler, panelHandle, setCollapsed } = setup();
        collapseHandler.collapse();
        expect(setCollapsed).toHaveBeenCalledWith(true);
        expect(panelHandle.collapse).toHaveBeenCalledTimes(1);
        expect(collapseHandler.isAutoCollapsed).toBe(true);
    });

    it("should expand panel on expand()", () => {
        const { collapseHandler, panelHandle, setCollapsed } = setup();
        collapseHandler.expand();
        expect(setCollapsed).toHaveBeenCalledWith(false);
        expect(panelHandle.resize).toHaveBeenCalledTimes(1);
        expect(collapseHandler.isAutoCollapsed).toBe(false);
    });

    it("should update restoreWidth on updateRestoreWidth()", () => {
        const { collapseHandler, panelHandle } = setup();
        collapseHandler.updateRestoreWidth();
        jest.runAllTimers();
        expect(panelHandle.getSize).toHaveBeenCalled();
    });

    it("should update restoreWidth on setHandle", () => {
        const setCollapsed = jest.fn();
        const panelHandle = new MockPanelHandle();
        const collapseHandler = new CollapseHandler(setCollapsed);
        expect(collapseHandler.panelHandle).toBeUndefined();
        collapseHandler.setHandle(panelHandle as unknown as PanelImperativeHandle);
        expect(collapseHandler.panelHandle).toBe(panelHandle);
        expect(panelHandle.getSize).toHaveBeenCalled();
    });
});
