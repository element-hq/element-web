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

import BasePlatform from "../../src/BasePlatform";
import SdkConfig from "../../src/SdkConfig";
import { SettingLevel } from "../../src/settings/SettingLevel";
import SettingsStore from "../../src/settings/SettingsStore";
import { mockPlatformPeg } from "../test-utils";

const TEST_DATA = [
    {
        name: "Electron.showTrayIcon",
        level: SettingLevel.PLATFORM,
        value: true,
    },
];

/**
 * An existing setting that has {@link IBaseSetting#supportedLevelsAreOrdered} set to true.
 */
const SETTING_NAME_WITH_CONFIG_OVERRIDE = "feature_new_room_decoration_ui";

describe("SettingsStore", () => {
    let platformSettings: Record<string, any>;

    beforeAll(() => {
        jest.clearAllMocks();
        platformSettings = {};
        mockPlatformPeg({
            isLevelSupported: jest.fn().mockReturnValue(true),
            supportsSetting: jest.fn().mockReturnValue(true),
            setSettingValue: jest.fn().mockImplementation((settingName: string, value: any) => {
                platformSettings[settingName] = value;
            }),
            getSettingValue: jest.fn().mockImplementation((settingName: string) => {
                return platformSettings[settingName];
            }),
            reload: jest.fn(),
        } as unknown as BasePlatform);

        TEST_DATA.forEach((d) => {
            SettingsStore.setValue(d.name, null, d.level, d.value);
        });
    });

    beforeEach(() => {
        SdkConfig.reset();
    });

    describe("getValueAt", () => {
        TEST_DATA.forEach((d) => {
            it(`should return the value "${d.level}"."${d.name}"`, () => {
                expect(SettingsStore.getValueAt(d.level, d.name)).toBe(d.value);
                // regression test #22545
                expect(SettingsStore.getValueAt(d.level, d.name)).toBe(d.value);
            });
        });

        it(`supportedLevelsAreOrdered correctly overrides setting`, async () => {
            SdkConfig.put({
                features: {
                    [SETTING_NAME_WITH_CONFIG_OVERRIDE]: false,
                },
            });
            await SettingsStore.setValue(SETTING_NAME_WITH_CONFIG_OVERRIDE, null, SettingLevel.DEVICE, true);
            expect(SettingsStore.getValue(SETTING_NAME_WITH_CONFIG_OVERRIDE)).toBe(false);
        });

        it(`supportedLevelsAreOrdered doesn't incorrectly override setting`, async () => {
            await SettingsStore.setValue(SETTING_NAME_WITH_CONFIG_OVERRIDE, null, SettingLevel.DEVICE, true);
            expect(SettingsStore.getValueAt(SettingLevel.DEVICE, SETTING_NAME_WITH_CONFIG_OVERRIDE)).toBe(true);
        });
    });
});
