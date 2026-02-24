/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import LabsUserSettingsTab from "../../../../../../../src/components/views/settings/tabs/user/LabsUserSettingsTab";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";
import SdkConfig from "../../../../../../../src/SdkConfig";

describe("<LabsUserSettingsTab />", () => {
    const getComponent = () => <LabsUserSettingsTab />;

    const settingsValueSpy = jest.spyOn(SettingsStore, "getValue");

    beforeEach(() => {
        jest.clearAllMocks();
        settingsValueSpy.mockReturnValue(false);
        SdkConfig.reset();
        SdkConfig.add({ brand: "BrandedClient" });
        localStorage.clear();
    });

    it("renders settings marked as beta as beta cards", () => {
        render(getComponent());
        expect(screen.getByText("Upcoming features").parentElement!).toMatchSnapshot();
    });

    it("does not render non-beta labs settings when disabled in config", () => {
        const sdkConfigSpy = jest.spyOn(SdkConfig, "get");
        render(getComponent());
        expect(sdkConfigSpy).toHaveBeenCalledWith("show_labs_settings");

        // only section is beta section
        expect(screen.queryByText("Early previews")).not.toBeInTheDocument();
    });

    it("renders non-beta labs settings when enabled in config", () => {
        // enable labs
        SdkConfig.add({ show_labs_settings: true });
        const { container } = render(getComponent());

        // non-beta labs section
        expect(screen.getByText("Early previews")).toBeInTheDocument();
        const labsSections = container.getElementsByClassName("mx_SettingsSubsection");
        expect(labsSections).toHaveLength(10);
    });
});
