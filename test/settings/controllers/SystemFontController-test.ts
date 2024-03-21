/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Action } from "../../../src/dispatcher/actions";
import dis from "../../../src/dispatcher/dispatcher";
import SystemFontController from "../../../src/settings/controllers/SystemFontController";
import SettingsStore from "../../../src/settings/SettingsStore";

const dispatchSpy = jest.spyOn(dis, "dispatch");

describe("SystemFontController", () => {
    it("dispatches a system font update action on change", () => {
        const controller = new SystemFontController();

        const getValueSpy = jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
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
