/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, afterEach } from "vitest";
import { type PointerEvent } from "react";

import { waitFor } from "test-utils-rtl";
import { type PanelImperativeHandle } from "@element-hq/web-shared-components";

import { ResizerViewModel } from "./ResizerViewModel";
import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";
import { CallStore } from "../../stores/CallStore";

/** The pointer handlers only read where the pointer is, so that is all a test has to give them. */
const pointerAt = (x: number, y: number) => ({ clientX: x, clientY: y }) as PointerEvent;

describe("LeftPanelResizerViewModel", () => {
    afterEach(() => {
        localStorage.clear();
        SettingsStore.reset();
    });

    describe("Initial state is correct", () => {
        it("should have correct initial state when panel was previously collapsed", () => {
            SettingsStore.setValue("RoomList.isPanelCollapsed", null, SettingLevel.DEVICE, true);
            const vm = new ResizerViewModel(CallStore.instance);
            expect(vm.getSnapshot()).toStrictEqual({
                isCollapsed: true,
                initialSize: 0,
            });
        });

        it("should have correct initial state when panel was previously resized", () => {
            SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
            const vm = new ResizerViewModel(CallStore.instance);
            expect(vm.getSnapshot()).toStrictEqual({
                isCollapsed: false,
                initialSize: 34,
            });
        });

        it("should have correct initial state when panel was neither resized nor collapsed", () => {
            const vm = new ResizerViewModel(CallStore.instance);
            expect(vm.getSnapshot()).toStrictEqual({
                isCollapsed: false,
                initialSize: undefined,
            });
        });
    });

    it("should update isCollapsed on onLeftPanelResized()", async () => {
        const vm = new ResizerViewModel(CallStore.instance);
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
        const vm = new ResizerViewModel(CallStore.instance);
        expect(() => {
            // Click
            vm.onPointerDown(pointerAt(100, 100));
            vm.onPointerUp();
        }).not.toThrow();
    });

    it("should noop on mouse drag", () => {
        const vm = new ResizerViewModel(CallStore.instance);
        SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
        const mockHandle = {
            resize: vi.fn(),
            isCollapsed: vi.fn().mockReturnValue(true),
            getSize: vi.fn().mockReturnValue({
                inPixels: 0,
            }),
            collapse: vi.fn(),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        // Simulate drag
        vm.onPointerDown(pointerAt(100, 100));
        vm.onPointerMove(pointerAt(160, 100));
        vm.onPointerUp();

        expect(mockHandle.resize).not.toHaveBeenCalledWith("34%");
    });

    it("should expand panel when a click wanders a little", () => {
        const vm = new ResizerViewModel(CallStore.instance);
        SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
        const mockHandle = {
            resize: vi.fn(),
            isCollapsed: vi.fn().mockReturnValue(true),
            getSize: vi.fn().mockReturnValue(0),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        // A trackpad rarely holds the pointer still between press and release.
        vm.onPointerDown(pointerAt(100, 100));
        vm.onPointerMove(pointerAt(101, 102));
        vm.onPointerUp();

        expect(mockHandle.resize).toHaveBeenCalledWith("34%");
    });

    it("should expand panel on a click that follows moving across the separator", () => {
        const vm = new ResizerViewModel(CallStore.instance);
        SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
        const mockHandle = {
            resize: vi.fn(),
            isCollapsed: vi.fn().mockReturnValue(true),
            getSize: vi.fn().mockReturnValue(0),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        // Pointer moves fire on hover too, with no button held.
        vm.onPointerMove(pointerAt(300, 300));
        vm.onPointerDown(pointerAt(100, 100));
        vm.onPointerUp();

        expect(mockHandle.resize).toHaveBeenCalledWith("34%");
    });

    describe("should expand panel on double click when panel is collapsed", () => {
        it("to last non-zero width that the user set", () => {
            const vm = new ResizerViewModel(CallStore.instance);
            SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
            const mockHandle = {
                resize: vi.fn(),
                isCollapsed: vi.fn().mockReturnValue(true),
                getSize: vi.fn().mockReturnValue(0),
            } as unknown as PanelImperativeHandle;
            vm.setPanelHandle(mockHandle);
            // Simulate click
            vm.onPointerDown(pointerAt(100, 100));
            vm.onPointerUp();
            expect(mockHandle.resize).toHaveBeenCalledWith("34%");
        });

        it("to maximum size of the panel", () => {
            const vm = new ResizerViewModel(CallStore.instance);
            const mockHandle = {
                resize: vi.fn(),
                isCollapsed: vi.fn().mockReturnValue(true),
                getSize: vi.fn().mockReturnValue(0),
            } as unknown as PanelImperativeHandle;
            vm.setPanelHandle(mockHandle);
            // Simulate click
            vm.onPointerDown(pointerAt(100, 100));
            vm.onPointerUp();
            expect(mockHandle.resize).toHaveBeenCalledWith("100%");
        });
    });

    it("should collapse panel on click when panel is expanded", () => {
        const vm = new ResizerViewModel(CallStore.instance);
        const mockHandle = {
            collapse: vi.fn(),
            isCollapsed: vi.fn().mockReturnValue(false),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        vm.onDoubleClick();
        expect(mockHandle.collapse).toHaveBeenCalled();
    });

    it("should ignore first resized event", () => {
        const vm = new ResizerViewModel(CallStore.instance);
        const mockHandle = {
            resize: vi.fn(),
            getSize: vi.fn().mockReturnValue(0),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        vm.onLeftPanelResized(50);
        expect(mockHandle.resize).not.toHaveBeenCalled();
    });
});
