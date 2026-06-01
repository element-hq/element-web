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

jest.mock("what-input");

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

    it("should noop on click when handle is not yet set", () => {
        const vm = new ResizerViewModel();
        expect(() => {
            // Click
            vm.onPointerDown();
            vm.onPointerUp();
        }).not.toThrow();
    });

    it("should noop on mouse drag", () => {
        const vm = new ResizerViewModel();
        SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
        const mockHandle = {
            resize: jest.fn(),
            isCollapsed: jest.fn().mockReturnValue(true),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        // Simulate drag
        vm.onPointerDown();
        vm.onPointerMove();
        vm.onPointerUp();

        expect(mockHandle.resize).not.toHaveBeenCalledWith("34%");
    });

    describe("should expand panel on double click when panel is collapsed", () => {
        it("to last non-zero width that the user set", () => {
            const vm = new ResizerViewModel();
            SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
            const mockHandle = {
                resize: jest.fn(),
                isCollapsed: jest.fn().mockReturnValue(true),
            } as unknown as PanelImperativeHandle;
            vm.setPanelHandle(mockHandle);
            // Simulate click
            vm.onPointerDown();
            vm.onPointerUp();
            expect(mockHandle.resize).toHaveBeenCalledWith("34%");
        });

        it("to maximum size of the panel", () => {
            const vm = new ResizerViewModel();
            const mockHandle = {
                resize: jest.fn(),
                isCollapsed: jest.fn().mockReturnValue(true),
            } as unknown as PanelImperativeHandle;
            vm.setPanelHandle(mockHandle);
            // Simulate click
            vm.onPointerDown();
            vm.onPointerUp();
            expect(mockHandle.resize).toHaveBeenCalledWith("100%");
        });
    });

    it("should collapse panel on click when panel is expanded", () => {
        const vm = new ResizerViewModel();
        const mockHandle = {
            collapse: jest.fn(),
            isCollapsed: jest.fn().mockReturnValue(false),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        vm.onDoubleClick();
        expect(mockHandle.collapse).toHaveBeenCalled();
    });

    it("should resize to nearest whole number", () => {
        const vm = new ResizerViewModel();
        const mockHandle = {
            resize: jest.fn(),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        vm.onLeftPanelResized(25.515);
        expect(mockHandle.resize).toHaveBeenCalledWith("26%");
    });
});
