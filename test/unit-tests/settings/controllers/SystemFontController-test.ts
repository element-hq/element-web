/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Action } from "../../../../src/dispatcher/actions";
import dis from "../../../../src/dispatcher/dispatcher";
import SystemFontController from "../../../../src/settings/controllers/SystemFontController";
import SettingsStore from "../../../../src/settings/SettingsStore";

const dispatchSpy = jest.spyOn(dis, "dispatch");

describe("SystemFontController", () => {
    it("dispatches a system font update action on change", () => {
        const controller = new SystemFontController();

        const getValueSpy = jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName): any => {
            if (settingName === "useBundledEmojiFont") return false;
            if (settingName === "useSystemFont") return true;
            if (settingName === "systemFont") return "Comic Sans MS";
        });
        controller.onChange();

        expect(dispatchSpy).toHaveBeenCalledWith({
            action: Action.UpdateSystemFont,
            useBundledEmojiFont: false,
            useSystemFont: true,
            font: "Comic Sans MS",
        });

        expect(getValueSpy).toHaveBeenCalledWith("useSystemFont");
    });
});
