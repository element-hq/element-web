/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import SidebarUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/SidebarUserSettingsTab";
import PosthogTrackers from "../../../../../../src/PosthogTrackers";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { MetaSpace } from "../../../../../../src/stores/spaces";
import { SettingLevel } from "../../../../../../src/settings/SettingLevel";
import { flushPromises } from "../../../../../test-utils";
import SdkConfig from "../../../../../../src/SdkConfig";

describe("<SidebarUserSettingsTab />", () => {
    beforeEach(() => {
        jest.spyOn(PosthogTrackers, "trackInteraction").mockClear();
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
    });

    it("renders sidebar settings with guest spa url", () => {
        const spy = jest.spyOn(SdkConfig, "get").mockReturnValue({ guest_spa_url: "https://somewhere.org" });
        const originalGetValue = SettingsStore.getValue;
        const spySettingsStore = jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            return setting === "feature_video_rooms" ? true : originalGetValue(setting);
        });
        const { container } = render(<SidebarUserSettingsTab />);
        expect(container).toMatchSnapshot();
        spySettingsStore.mockRestore();
        spy.mockRestore();
    });
    it("renders sidebar settings without guest spa url", () => {
        const originalGetValue = SettingsStore.getValue;
        const spySettingsStore = jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            return setting === "feature_video_rooms" ? true : originalGetValue(setting);
        });
        const { container } = render(<SidebarUserSettingsTab />);
        expect(container).toMatchSnapshot();
        spySettingsStore.mockRestore();
    });

    it("toggles all rooms in home setting", async () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
            if (settingName === "Spaces.enabledMetaSpaces") {
                return {
                    [MetaSpace.Home]: true,
                    [MetaSpace.Favourites]: true,
                    [MetaSpace.People]: true,
                    [MetaSpace.Orphans]: true,
                };
            }
            return false;
        });
        render(<SidebarUserSettingsTab />);

        fireEvent.click(screen.getByTestId("mx_SidebarUserSettingsTab_homeAllRoomsCheckbox"));

        await flushPromises();
        expect(SettingsStore.setValue).toHaveBeenCalledWith("Spaces.allRoomsInHome", null, SettingLevel.ACCOUNT, true);

        expect(PosthogTrackers.trackInteraction).toHaveBeenCalledWith(
            "WebSettingsSidebarTabSpacesCheckbox",
            // synthetic event from checkbox
            expect.objectContaining({ type: "change" }),
            1,
        );
    });

    it("disables all rooms in home setting when home space is disabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
            if (settingName === "Spaces.enabledMetaSpaces") {
                return {
                    [MetaSpace.Home]: false,
                    [MetaSpace.Favourites]: true,
                    [MetaSpace.People]: true,
                    [MetaSpace.Orphans]: true,
                };
            }
            return false;
        });
        render(<SidebarUserSettingsTab />);

        expect(screen.getByTestId("mx_SidebarUserSettingsTab_homeAllRoomsCheckbox")).toBeDisabled();
    });
});
