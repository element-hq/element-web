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

import React, { ReactElement } from "react";
import { render } from "@testing-library/react";
import { mocked } from "jest-mock";

import SettingsStore, { CallbackFn } from "../../../../src/settings/SettingsStore";
import SdkConfig from "../../../../src/SdkConfig";
import { UserTab } from "../../../../src/components/views/dialogs/UserTab";
import UserSettingsDialog from "../../../../src/components/views/dialogs/UserSettingsDialog";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
    mockClientMethodsServer,
    mockPlatformPeg,
} from "../../../test-utils";
import { UIFeature } from "../../../../src/settings/UIFeature";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

mockPlatformPeg({
    supportsSpellCheckSettings: jest.fn().mockReturnValue(false),
    getAppVersion: jest.fn().mockResolvedValue("1"),
});

jest.mock("../../../../src/settings/SettingsStore", () => ({
    getValue: jest.fn(),
    getValueAt: jest.fn(),
    canSetValue: jest.fn(),
    monitorSetting: jest.fn(),
    watchSetting: jest.fn(),
    unwatchSetting: jest.fn(),
    getFeatureSettingNames: jest.fn(),
    getBetaInfo: jest.fn(),
}));

jest.mock("../../../../src/SdkConfig", () => ({
    get: jest.fn(),
}));

describe("<UserSettingsDialog />", () => {
    const userId = "@alice:server.org";
    const mockSettingsStore = mocked(SettingsStore);
    const mockSdkConfig = mocked(SdkConfig);
    getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
    });

    const defaultProps = { onFinished: jest.fn() };
    const getComponent = (props: Partial<typeof defaultProps & { initialTabId?: UserTab }> = {}): ReactElement => (
        <UserSettingsDialog {...defaultProps} {...props} />
    );

    beforeEach(() => {
        jest.clearAllMocks();
        mockSettingsStore.getValue.mockReturnValue(false);
        mockSettingsStore.getFeatureSettingNames.mockReturnValue([]);
        mockSdkConfig.get.mockReturnValue({ brand: "Test" });
    });

    const getActiveTabLabel = (container: Element) =>
        container.querySelector(".mx_TabbedView_tabLabel_active")?.textContent;
    const getActiveTabHeading = (container: Element) =>
        container.querySelector(".mx_SettingsSection .mx_Heading_h2")?.textContent;

    it("should render general settings tab when no initialTabId", () => {
        const { container } = render(getComponent());

        expect(getActiveTabLabel(container)).toEqual("General");
        expect(getActiveTabHeading(container)).toEqual("General");
    });

    it("should render initial tab when initialTabId is set", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Help }));

        expect(getActiveTabLabel(container)).toEqual("Help & About");
        expect(getActiveTabHeading(container)).toEqual("Help & About");
    });

    it("should render general tab if initialTabId tab cannot be rendered", () => {
        // mjolnir tab is only rendered in some configs
        const { container } = render(getComponent({ initialTabId: UserTab.Mjolnir }));

        expect(getActiveTabLabel(container)).toEqual("General");
        expect(getActiveTabHeading(container)).toEqual("General");
    });

    it("renders tabs correctly", () => {
        const { container } = render(getComponent());
        expect(container.querySelectorAll(".mx_TabbedView_tabLabel")).toMatchSnapshot();
    });

    it("renders ignored users tab when feature_mjolnir is enabled", () => {
        mockSettingsStore.getValue.mockImplementation((settingName): any => settingName === "feature_mjolnir");
        const { getByTestId } = render(getComponent());
        expect(getByTestId(`settings-tab-${UserTab.Mjolnir}`)).toBeTruthy();
    });

    it("renders voip tab when voip is enabled", () => {
        mockSettingsStore.getValue.mockImplementation((settingName): any => settingName === UIFeature.Voip);
        const { getByTestId } = render(getComponent());
        expect(getByTestId(`settings-tab-${UserTab.Voice}`)).toBeTruthy();
    });

    it("renders session manager tab", () => {
        const { getByTestId } = render(getComponent());
        expect(getByTestId(`settings-tab-${UserTab.SessionManager}`)).toBeTruthy();
    });

    it("renders labs tab when show_labs_settings is enabled in config", () => {
        // @ts-ignore simplified test stub
        mockSdkConfig.get.mockImplementation((configName) => configName === "show_labs_settings");
        const { getByTestId } = render(getComponent());
        expect(getByTestId(`settings-tab-${UserTab.Labs}`)).toBeTruthy();
    });

    it("renders labs tab when some feature is in beta", () => {
        mockSettingsStore.getFeatureSettingNames.mockReturnValue(["feature_beta_setting", "feature_just_normal_labs"]);
        mockSettingsStore.getBetaInfo.mockImplementation((settingName) =>
            settingName === "feature_beta_setting" ? ({} as any) : undefined,
        );
        const { getByTestId } = render(getComponent());
        expect(getByTestId(`settings-tab-${UserTab.Labs}`)).toBeTruthy();
    });

    it("watches settings", () => {
        const watchSettingCallbacks: Record<string, CallbackFn> = {};

        mockSettingsStore.watchSetting.mockImplementation((settingName, roomId, callback) => {
            watchSettingCallbacks[settingName] = callback;
            return `mock-watcher-id-${settingName}`;
        });

        const { queryByTestId, unmount } = render(getComponent());
        expect(queryByTestId(`settings-tab-${UserTab.Mjolnir}`)).toBeFalsy();

        expect(mockSettingsStore.watchSetting.mock.calls[0][0]).toEqual("feature_mjolnir");

        // call the watch setting callback
        watchSettingCallbacks["feature_mjolnir"]("feature_mjolnir", "", SettingLevel.ACCOUNT, true, true);
        // tab is rendered now
        expect(queryByTestId(`settings-tab-${UserTab.Mjolnir}`)).toBeTruthy();

        unmount();

        // unwatches settings on unmount
        expect(mockSettingsStore.unwatchSetting).toHaveBeenCalledWith("mock-watcher-id-feature_mjolnir");
    });
});
