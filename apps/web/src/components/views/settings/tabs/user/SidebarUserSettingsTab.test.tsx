/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "test-utils-rtl";
import { flushPromises } from "test-utils";

import SidebarUserSettingsTab from "./SidebarUserSettingsTab";
import PosthogTrackers from "../../../../../PosthogTrackers";
import SettingsStore from "../../../../../settings/SettingsStore";
import { MetaSpace } from "../../../../../stores/spaces";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SdkConfig from "../../../../../SdkConfig";

describe("<SidebarUserSettingsTab />", () => {
    beforeEach(() => {
        vi.spyOn(PosthogTrackers, "trackInteraction").mockClear();
        vi.spyOn(SettingsStore, "getValue").mockRestore();
        vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
    });

    it("renders sidebar settings with guest spa url", () => {
        const spy = vi.spyOn(SdkConfig, "get").mockReturnValue({ guest_spa_url: "https://somewhere.org" });
        const originalGetValue = SettingsStore.getValue;
        const spySettingsStore = vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            return setting === "feature_video_rooms" ? true : originalGetValue(setting);
        });
        const { container } = render(<SidebarUserSettingsTab />);
        expect(container).toMatchSnapshot();
        spySettingsStore.mockRestore();
        spy.mockRestore();
    });
    it("renders sidebar settings without guest spa url", () => {
        const originalGetValue = SettingsStore.getValue;
        const spySettingsStore = vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            return setting === "feature_video_rooms" ? true : originalGetValue(setting);
        });
        const { container } = render(<SidebarUserSettingsTab />);
        expect(container).toMatchSnapshot();
        spySettingsStore.mockRestore();
    });

    it("toggles all rooms in home setting", async () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
            if (settingName === "Spaces.enabledMetaSpaces") {
                return {
                    [MetaSpace.Home]: true,
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
        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
            if (settingName === "Spaces.enabledMetaSpaces") {
                return {
                    [MetaSpace.Home]: false,
                    [MetaSpace.Orphans]: true,
                };
            }
            return false;
        });
        render(<SidebarUserSettingsTab />);

        expect(screen.getByTestId("mx_SidebarUserSettingsTab_homeAllRoomsCheckbox")).toBeDisabled();
    });
});
