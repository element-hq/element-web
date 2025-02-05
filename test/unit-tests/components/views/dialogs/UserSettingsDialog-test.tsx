/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";
import { render, screen } from "jest-matrix-react";
import { mocked, type MockedObject } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SettingsStore, { type CallbackFn } from "../../../../../src/settings/SettingsStore";
import SdkConfig from "../../../../../src/SdkConfig";
import { UserTab } from "../../../../../src/components/views/dialogs/UserTab";
import UserSettingsDialog from "../../../../../src/components/views/dialogs/UserSettingsDialog";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
    mockClientMethodsServer,
    mockPlatformPeg,
    mockClientMethodsCrypto,
    mockClientMethodsRooms,
    useMockMediaDevices,
} from "../../../../test-utils";
import { UIFeature } from "../../../../../src/settings/UIFeature";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import { SdkContextClass } from "../../../../../src/contexts/SDKContext";
import { type FeatureSettingKey } from "../../../../../src/settings/Settings.tsx";

mockPlatformPeg({
    supportsSpellCheckSettings: jest.fn().mockReturnValue(false),
    getAppVersion: jest.fn().mockResolvedValue("1"),
});

jest.mock("../../../../../src/settings/SettingsStore", () => ({
    getValue: jest.fn(),
    getValueAt: jest.fn(),
    canSetValue: jest.fn(),
    monitorSetting: jest.fn(),
    watchSetting: jest.fn(),
    unwatchSetting: jest.fn(),
    getFeatureSettingNames: jest.fn(),
    getBetaInfo: jest.fn(),
    getDisplayName: jest.fn(),
    getDescription: jest.fn(),
    shouldHaveWarning: jest.fn(),
    disabledMessage: jest.fn(),
    settingIsOveriddenAtConfigLevel: jest.fn(),
}));

describe("<UserSettingsDialog />", () => {
    const userId = "@alice:server.org";
    const mockSettingsStore = mocked(SettingsStore);
    let mockClient!: MockedObject<MatrixClient>;

    let sdkContext: SdkContextClass;
    const defaultProps = { onFinished: jest.fn() };
    const getComponent = (
        props: Partial<typeof defaultProps & { initialTabId?: UserTab; props: Record<string, any> }> = {},
    ): ReactElement => <UserSettingsDialog sdkContext={sdkContext} {...defaultProps} {...props} />;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
            ...mockClientMethodsServer(),
            ...mockClientMethodsCrypto(),
            ...mockClientMethodsRooms(),
            getIgnoredUsers: jest.fn().mockResolvedValue([]),
            getPushers: jest.fn().mockResolvedValue([]),
            getProfileInfo: jest.fn().mockResolvedValue({}),
        });
        sdkContext = new SdkContextClass();
        sdkContext.client = mockClient;
        mockSettingsStore.getValue.mockReturnValue(false);
        mockSettingsStore.getValueAt.mockReturnValue(false);
        mockSettingsStore.getFeatureSettingNames.mockReturnValue([]);
        SdkConfig.reset();
        SdkConfig.put({ brand: "Test" });
    });

    const getActiveTabLabel = (container: Element) =>
        container.querySelector(".mx_TabbedView_tabLabel_active")?.textContent;

    it("should render general settings tab when no initialTabId", () => {
        const { container } = render(getComponent());

        expect(getActiveTabLabel(container)).toEqual("Account");
    });

    it("should render initial tab when initialTabId is set", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Help }));

        expect(getActiveTabLabel(container)).toEqual("Help & About");
    });

    it("should render general tab if initialTabId tab cannot be rendered", () => {
        // mjolnir tab is only rendered in some configs
        const { container } = render(getComponent({ initialTabId: UserTab.Mjolnir }));

        expect(getActiveTabLabel(container)).toEqual("Account");
    });

    it("renders tabs correctly", () => {
        SdkConfig.add({
            show_labs_settings: true,
        });
        const { container } = render(getComponent());
        expect(container.querySelectorAll(".mx_TabbedView_tabLabel")).toMatchSnapshot();
    });

    it("renders ignored users tab when feature_mjolnir is enabled", () => {
        mockSettingsStore.getValue.mockImplementation((settingName) => settingName === "feature_mjolnir");
        const { getByTestId } = render(getComponent());
        expect(getByTestId(`settings-tab-${UserTab.Mjolnir}`)).toBeTruthy();
    });

    it("renders voip tab when voip is enabled", () => {
        mockSettingsStore.getValue.mockImplementation((settingName: any): any => settingName === UIFeature.Voip);
        const { getByTestId } = render(getComponent());
        expect(getByTestId(`settings-tab-${UserTab.Voice}`)).toBeTruthy();
    });

    it("renders with session manager tab selected", () => {
        const { getByTestId } = render(getComponent({ initialTabId: UserTab.SessionManager }));
        expect(getByTestId(`settings-tab-${UserTab.SessionManager}`)).toBeTruthy();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Sessions");
    });

    it("renders with appearance tab selected", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Appearance }));

        expect(getActiveTabLabel(container)).toEqual("Appearance");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Appearance");
    });

    it("renders with notifications tab selected", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Notifications }));

        expect(getActiveTabLabel(container)).toEqual("Notifications");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Notifications");
    });

    it("renders with preferences tab selected", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Preferences }));

        expect(getActiveTabLabel(container)).toEqual("Preferences");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Preferences");
    });

    it("renders with keyboard tab selected", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Keyboard }));

        expect(getActiveTabLabel(container)).toEqual("Keyboard");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Keyboard");
    });

    it("renders with sidebar tab selected", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Sidebar }));

        expect(getActiveTabLabel(container)).toEqual("Sidebar");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Sidebar");
    });

    it("renders with voip tab selected", () => {
        useMockMediaDevices();
        mockSettingsStore.getValue.mockImplementation((settingName: any): any => settingName === UIFeature.Voip);
        const { container } = render(getComponent({ initialTabId: UserTab.Voice }));

        expect(getActiveTabLabel(container)).toEqual("Voice & Video");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Voice & Video");
    });

    it("renders with security tab selected", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Security }));

        expect(getActiveTabLabel(container)).toEqual("Security & Privacy");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Security & Privacy");
    });

    it("renders with labs tab selected", () => {
        SdkConfig.add({
            show_labs_settings: true,
        });
        const { container } = render(getComponent({ initialTabId: UserTab.Labs }));

        expect(getActiveTabLabel(container)).toEqual("Labs");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Labs");
    });

    it("renders with mjolnir tab selected", () => {
        mockSettingsStore.getValue.mockImplementation((settingName): any => settingName === "feature_mjolnir");
        const { container } = render(getComponent({ initialTabId: UserTab.Mjolnir }));
        expect(getActiveTabLabel(container)).toEqual("Ignored users");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ignored Users");
    });

    it("renders with help tab selected", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Help }));

        expect(getActiveTabLabel(container)).toEqual("Help & About");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Help & About");
    });

    it("renders labs tab when show_labs_settings is enabled in config", () => {
        SdkConfig.add({
            show_labs_settings: true,
        });
        const { getByTestId } = render(getComponent());
        expect(getByTestId(`settings-tab-${UserTab.Labs}`)).toBeTruthy();
    });

    it("renders labs tab when some feature is in beta", () => {
        mockSettingsStore.getFeatureSettingNames.mockReturnValue([
            "feature_beta_setting",
            "feature_just_normal_labs",
        ] as unknown[] as FeatureSettingKey[]);
        mockSettingsStore.getBetaInfo.mockImplementation((settingName: any) =>
            settingName === "feature_beta_setting" ? ({} as any) : undefined,
        );
        const { getByTestId } = render(getComponent());
        expect(getByTestId(`settings-tab-${UserTab.Labs}`)).toBeTruthy();
    });

    it("watches settings", async () => {
        const watchSettingCallbacks: Record<string, CallbackFn> = {};

        mockSettingsStore.watchSetting.mockImplementation((settingName, roomId, callback) => {
            watchSettingCallbacks[settingName] = callback;
            return `mock-watcher-id-${settingName}`;
        });
        mockSettingsStore.getValue.mockReturnValue(false);

        const { queryByTestId, findByTestId, unmount } = render(getComponent());
        expect(queryByTestId(`settings-tab-${UserTab.Mjolnir}`)).toBeFalsy();

        expect(mockSettingsStore.watchSetting).toHaveBeenCalledWith("feature_mjolnir", null, expect.anything());

        // call the watch setting callback
        mockSettingsStore.getValue.mockReturnValue(true);
        watchSettingCallbacks["feature_mjolnir"]("feature_mjolnir", "", SettingLevel.ACCOUNT, true, true);

        // tab is rendered now
        await expect(findByTestId(`settings-tab-${UserTab.Mjolnir}`)).resolves.toBeTruthy();

        unmount();

        // unwatches settings on unmount
        expect(mockSettingsStore.unwatchSetting).toHaveBeenCalledWith("mock-watcher-id-feature_mjolnir");
    });
});
