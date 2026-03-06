/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { waitFor } from "jest-matrix-react";
import { type PanelImperativeHandle } from "@element-hq/web-shared-components";

import { ResizerViewModel } from "../../../src/viewmodels/structures/ResizerViewModel";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";

describe("LeftPanelResizerViewModel", () => {
    afterEach(() => {
        SettingsStore.reset();
    });

    describe("Initial state is correct", () => {
        it("should have correct initial state when panel was previously collapsed", () => {
            SettingsStore.setValue("RoomList.isPanelCollapsed", null, SettingLevel.DEVICE, true);
            const vm = new ResizerViewModel();
            expect(vm.getSnapshot()).toStrictEqual({
                isCollapsed: true,
                initialSize: 0,
            });
        });

        it("should have correct initial state when panel was previously resized", () => {
            SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
            const vm = new ResizerViewModel();
            expect(vm.getSnapshot()).toStrictEqual({
                isCollapsed: false,
                initialSize: 34,
            });
        });

        it("should have correct initial state when panel was neither resized nor collapsed", () => {
            const vm = new ResizerViewModel();
            expect(vm.getSnapshot()).toStrictEqual({
                isCollapsed: false,
                initialSize: undefined,
            });
        });
    });

    it("should update isCollapsed on onLeftPanelResized()", async () => {
        const vm = new ResizerViewModel();
        vm.onLeftPanelResize({ inPixels: 100, asPercentage: 6 });
        await waitFor(() => {
            expect(vm.getSnapshot().isCollapsed).toStrictEqual(false);
        });
        vm.onLeftPanelResize({ inPixels: 0, asPercentage: 6 });
        await waitFor(() => {
            expect(vm.getSnapshot().isCollapsed).toStrictEqual(true);
        });
    });

    it("should noop on onSeparatorClick() when handle is not yet set", () => {
        const vm = new ResizerViewModel();
        expect(() => vm.onSeparatorClick()).not.toThrow();
    });

    it("should noop on onSeparatorClick() when settings store does not contain last known size", () => {
        const vm = new ResizerViewModel();

        const mockHandle = {
            resize: jest.fn(),
            isCollapsed: jest.fn().mockReturnValue(true),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        vm.onSeparatorClick();
        expect(mockHandle.resize).not.toHaveBeenCalled();
    });

    it("should expand panel to last known width on onSeparatorClick()", () => {
        const vm = new ResizerViewModel();
        const mockHandle = {
            resize: jest.fn(),
            isCollapsed: jest.fn().mockReturnValue(true),
        } as unknown as PanelImperativeHandle;

        vm.setPanelHandle(mockHandle);

        // Let's say that the panel first is resized to 20%
        vm.onLeftPanelResized(20);

        // Now the panel should be restored to 20%
        vm.onSeparatorClick();
        expect(mockHandle.resize).toHaveBeenCalledWith("20%");
    });
});
