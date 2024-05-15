/*
    Copyright 2024 Verji Tech AS. All rights reserved.
    Unauthorized copying or distribution of this file, via any medium, is strictly prohibited.
*/

import React from "react";
import { render, RenderResult, screen } from "@testing-library/react";
import PreferencesUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/PreferencesUserSettingsTab";
import { mockPlatformPeg } from "../../../../../test-utils";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../src/settings/SettingLevel";
import { UIFeature } from "../../../../../../src/settings/UIFeature";

describe("PreferencesUserSettingsTab", () => {
    beforeEach(() => {
        mockPlatformPeg();
    });

    const renderTab = (): RenderResult => {
        return render(<PreferencesUserSettingsTab closeSettingsFn={() => {}} />);
    };

    describe("testing for feature flag: UIFeature.ShowStickersButtonSetting", () => {
        beforeEach(() => {
            jest.clearAllMocks();
            jest.spyOn(SettingsStore, "getValueAt").mockImplementation((level, key) => {
                if (level === SettingLevel.DEVICE && key === "autocompleteDelay") {
                    return "10";
                }
                return "default";
            });
        });

        it("should NOT render the 'Show Sticker button' toggle", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
                if (settingName === UIFeature.ShowStickersButtonSetting) {
                    console.log("yyy::: ", settingName)
                    return false;
                }
                return "default";
            });

            renderTab();
            // screen.debug();

            expect(screen.queryByText("Show stickers button")).toBeFalsy();

        });

        it("should render the 'Show Sticker button' toggle", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
                if (settingName === UIFeature.ShowStickersButtonSetting) {
                    return true;
                }
                return "default";
            });

            renderTab();

            expect(screen.queryByText("Show stickers button")).toBeTruthy();
        });
    });
});
