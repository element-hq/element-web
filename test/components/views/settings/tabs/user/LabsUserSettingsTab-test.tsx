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

import React from "react";
import { render, screen } from "@testing-library/react";

import LabsUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/LabsUserSettingsTab";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import SdkConfig from "../../../../../../src/SdkConfig";

describe("<LabsUserSettingsTab />", () => {
    const defaultProps = {
        closeSettingsFn: jest.fn(),
    };
    const getComponent = () => <LabsUserSettingsTab {...defaultProps} />;

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
