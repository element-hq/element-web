/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { showInRoomSearchNudgeIfNeeded } from "../../../src/toasts/InRoomSearchNudgeToast";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import ToastStore from "../../../src/stores/ToastStore";

const TOAST_KEY = "in-room-search-nudge";

// In the jsdom test environment IS_ELECTRON (window.electron) is undefined and IS_MAC is false,
// so these emulate the web build pressing Ctrl+F.
const ctrlF = (): KeyboardEvent => new KeyboardEvent("keydown", { key: "f", ctrlKey: true });

describe("showInRoomSearchNudgeIfNeeded", () => {
    let addOrReplaceToast: jest.SpyInstance;
    let setValue: jest.SpyInstance;

    const mockSettings = (values: Record<string, boolean>): void => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => !!values[name as string]);
    };

    beforeEach(() => {
        addOrReplaceToast = jest
            .spyOn(ToastStore.sharedInstance(), "addOrReplaceToast")
            .mockImplementation(() => undefined);
        setValue = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shows the one-time toast on Ctrl/Cmd+F when in-room search is disabled and not yet shown", () => {
        mockSettings({ ctrlFForSearch: false, ctrlFForSearchNudgeShown: false });

        showInRoomSearchNudgeIfNeeded(ctrlF());

        expect(addOrReplaceToast).toHaveBeenCalledTimes(1);
        expect(addOrReplaceToast).toHaveBeenCalledWith(expect.objectContaining({ key: TOAST_KEY }));
        // It marks itself as shown so it never nags again on this device.
        expect(setValue).toHaveBeenCalledWith("ctrlFForSearchNudgeShown", null, SettingLevel.DEVICE, true);
    });

    it("does not show when in-room search is already enabled", () => {
        mockSettings({ ctrlFForSearch: true, ctrlFForSearchNudgeShown: false });

        showInRoomSearchNudgeIfNeeded(ctrlF());

        expect(addOrReplaceToast).not.toHaveBeenCalled();
    });

    it("does not show when it has already been shown once", () => {
        mockSettings({ ctrlFForSearch: false, ctrlFForSearchNudgeShown: true });

        showInRoomSearchNudgeIfNeeded(ctrlF());

        expect(addOrReplaceToast).not.toHaveBeenCalled();
    });

    it("ignores key presses that are not Ctrl/Cmd+F", () => {
        mockSettings({ ctrlFForSearch: false, ctrlFForSearchNudgeShown: false });

        showInRoomSearchNudgeIfNeeded(new KeyboardEvent("keydown", { key: "f" })); // no modifier
        showInRoomSearchNudgeIfNeeded(new KeyboardEvent("keydown", { key: "g", ctrlKey: true })); // wrong key

        expect(addOrReplaceToast).not.toHaveBeenCalled();
    });

    it("enables in-room search when the toast's primary action is clicked", () => {
        mockSettings({ ctrlFForSearch: false, ctrlFForSearchNudgeShown: false });

        showInRoomSearchNudgeIfNeeded(ctrlF());

        const toast = addOrReplaceToast.mock.calls[0][0];
        toast.props.onPrimaryClick();

        expect(setValue).toHaveBeenCalledWith("ctrlFForSearch", null, SettingLevel.ACCOUNT, true);
    });
});
