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
import { render } from "@testing-library/react";
import { defer } from "matrix-js-sdk/src/utils";

import LabsUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/LabsUserSettingsTab";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../../../test-utils";
import SdkConfig from "../../../../../../src/SdkConfig";
import MatrixClientBackedController from "../../../../../../src/settings/controllers/MatrixClientBackedController";

describe("<SecurityUserSettingsTab />", () => {
    const sdkConfigSpy = jest.spyOn(SdkConfig, "get");

    const defaultProps = {
        closeSettingsFn: jest.fn(),
    };
    const getComponent = () => <LabsUserSettingsTab {...defaultProps} />;

    const userId = "@alice:server.org";
    const cli = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
    });

    const settingsValueSpy = jest.spyOn(SettingsStore, "getValue");

    beforeEach(() => {
        jest.clearAllMocks();
        settingsValueSpy.mockReturnValue(false);
        sdkConfigSpy.mockReturnValue(false);
    });

    it("renders settings marked as beta as beta cards", () => {
        const { getByTestId } = render(getComponent());
        expect(getByTestId("labs-beta-section")).toMatchSnapshot();
    });

    it("does not render non-beta labs settings when disabled in config", () => {
        const { container } = render(getComponent());
        expect(sdkConfigSpy).toHaveBeenCalledWith("show_labs_settings");

        const labsSections = container.getElementsByClassName("mx_SettingsTab_section");
        // only section is beta section
        expect(labsSections.length).toEqual(1);
    });

    it("renders non-beta labs settings when enabled in config", () => {
        // enable labs
        sdkConfigSpy.mockImplementation((configName) => configName === "show_labs_settings");
        const { container } = render(getComponent());

        const labsSections = container.getElementsByClassName("mx_SettingsTab_section");
        expect(labsSections.length).toEqual(11);
    });

    it("renders a labs flag which requires unstable support once support is confirmed", async () => {
        // enable labs
        sdkConfigSpy.mockImplementation((configName) => configName === "show_labs_settings");

        const deferred = defer<boolean>();
        cli.doesServerSupportUnstableFeature.mockImplementation(async (featureName) => {
            return featureName === "org.matrix.msc3827.stable" ? deferred.promise : false;
        });
        MatrixClientBackedController.matrixClient = cli;

        const { queryByText, findByText } = render(getComponent());

        expect(queryByText("Explore public spaces in the new search dialog")).toBeFalsy();
        deferred.resolve(true);
        await expect(findByText("Explore public spaces in the new search dialog")).resolves.toBeDefined();
    });
});
