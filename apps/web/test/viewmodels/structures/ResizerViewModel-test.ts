/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { waitFor } from "jest-matrix-react";
import { type PanelImperativeHandle } from "@element-hq/web-shared-components";
import whatInput from "what-input";

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
                isFocusedViaKeyboard: false,
            });
        });

        it("should have correct initial state when panel was previously resized", () => {
            SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
            const vm = new ResizerViewModel();
            expect(vm.getSnapshot()).toStrictEqual({
                isCollapsed: false,
                initialSize: 34,
                isFocusedViaKeyboard: false,
            });
        });

        it("should have correct initial state when panel was neither resized nor collapsed", () => {
            const vm = new ResizerViewModel();
            expect(vm.getSnapshot()).toStrictEqual({
                isCollapsed: false,
                initialSize: undefined,
                isFocusedViaKeyboard: false,
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

    it("should expand panel on onSeparatorClick()", () => {
        const vm = new ResizerViewModel();
        SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, 34);
        const mockHandle = {
            resize: jest.fn(),
            isCollapsed: jest.fn().mockReturnValue(true),
            getSize: jest.fn().mockReturnValue({
                inPixels: 0,
            }),
            collapse: jest.fn(),
        } as unknown as PanelImperativeHandle;
        vm.setPanelHandle(mockHandle);

        vm.onSeparatorClick();

        expect(mockHandle.resize).toHaveBeenCalledWith("34%");
    });

    it("should set isFocusedViaKeyboard state correctly", () => {
        whatInput.ask = jest.fn().mockReturnValue("keyboard");
        const vm = new ResizerViewModel();
        vm.onFocus();
        expect(vm.getSnapshot().isFocusedViaKeyboard).toStrictEqual(true);
        vm.onBlur();
        expect(vm.getSnapshot().isFocusedViaKeyboard).toStrictEqual(false);
    });
});
