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
import { fireEvent, render, screen } from "@testing-library/react";
import { mocked, MockedObject } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import {
    CustomComponentLifecycle,
    CustomComponentOpts,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/CustomComponentLifecycle";

import SettingsStore, { CallbackFn } from "../../../../src/settings/SettingsStore";
import SdkConfig from "../../../../src/SdkConfig";
import { UserTab } from "../../../../src/components/views/dialogs/UserTab";
import UserSettingsDialog from "../../../../src/components/views/dialogs/UserSettingsDialog";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
    mockClientMethodsServer,
    mockPlatformPeg,
    mockClientMethodsCrypto,
    mockClientMethodsRooms,
    useMockMediaDevices,
} from "../../../test-utils";
import { UIFeature } from "../../../../src/settings/UIFeature";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import { ModuleRunner } from "../../../../src/modules/ModuleRunner";

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
    getDisplayName: jest.fn(),
    getDescription: jest.fn(),
    shouldHaveWarning: jest.fn(),
    disabledMessage: jest.fn(),
}));

jest.mock("../../../../src/SdkConfig", () => ({
    get: jest.fn(),
}));

describe("<UserSettingsDialog />", () => {
    const userId = "@alice:server.org";
    const mockSettingsStore = mocked(SettingsStore);
    const mockSdkConfig = mocked(SdkConfig);
    let mockClient!: MockedObject<MatrixClient>;

    let sdkContext: SdkContextClass;
    const defaultProps = { onFinished: jest.fn() };
    const getComponent = (props: Partial<typeof defaultProps & { initialTabId?: UserTab }> = {}): ReactElement => (
        <UserSettingsDialog sdkContext={sdkContext} {...defaultProps} {...props} />
    );

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
        mockSdkConfig.get.mockReturnValue({ brand: "Test" });
    });

    const getActiveTabLabel = (container: Element) =>
        container.querySelector(".mx_TabbedView_tabLabel_active")?.textContent;

    it("should render general settings tab when no initialTabId", () => {
        const { container } = render(getComponent());

        expect(getActiveTabLabel(container)).toEqual("General");
    });

    it("should render initial tab when initialTabId is set", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Help }));

        expect(getActiveTabLabel(container)).toEqual("Help & About");
    });

    it("should render general tab if initialTabId tab cannot be rendered", () => {
        // mjolnir tab is only rendered in some configs
        const { container } = render(getComponent({ initialTabId: UserTab.Mjolnir }));

        expect(getActiveTabLabel(container)).toEqual("General");
    });

    it("renders tabs correctly", () => {
        // jest.spyOn(SettingsStore, "getValue").mockImplementation((name:string) => {
        //     if (name == UIFeature.SpacesEnabled) return true;
        //     return true;
        // });
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
        mockSettingsStore.getValue.mockImplementation((settingName): any => settingName === UIFeature.Voip);
        const { container } = render(getComponent({ initialTabId: UserTab.Voice }));

        expect(getActiveTabLabel(container)).toEqual("Voice & Video");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Voice & Video");
    });

    it("renders with secutity tab selected", () => {
        const { container } = render(getComponent({ initialTabId: UserTab.Security }));

        expect(getActiveTabLabel(container)).toEqual("Security & Privacy");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings: Security & Privacy");
    });

    it("renders with labs tab selected", () => {
        // @ts-ignore I give up trying to get the types right here
        // why do we have functions that return different things depending on what they're passed?
        mockSdkConfig.get.mockImplementation((x) => {
            const mockConfig = { show_labs_settings: true, brand: "Test" };
            switch (x) {
                case "show_labs_settings":
                case "brand":
                    // @ts-ignore
                    return mockConfig[x];
                default:
                    return mockConfig;
            }
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
        mockSettingsStore.getValue.mockReturnValue(false);

        const { queryByTestId, unmount } = render(getComponent());
        expect(queryByTestId(`settings-tab-${UserTab.Mjolnir}`)).toBeFalsy();

        expect(mockSettingsStore.watchSetting).toHaveBeenCalledWith("feature_mjolnir", null, expect.anything());

        // call the watch setting callback
        mockSettingsStore.getValue.mockReturnValue(true);
        watchSettingCallbacks["feature_mjolnir"]("feature_mjolnir", "", SettingLevel.ACCOUNT, true, true);

        // tab is rendered now
        expect(queryByTestId(`settings-tab-${UserTab.Mjolnir}`)).toBeTruthy();

        unmount();

        // unwatches settings on unmount
        expect(mockSettingsStore.unwatchSetting).toHaveBeenCalledWith("mock-watcher-id-feature_mjolnir");
    });
    describe("on CustomComponentLifecycle.SessionManageTab", () => {
        it("should invoke CustomComponentLifecycle.SessionsManagerTab on rendering when Sessions-tab component renders", () => {
            jest.spyOn(ModuleRunner.instance, "invoke");
            render(getComponent());
            fireEvent.click(screen.getByText("Sessions"));
            screen.debug(undefined, 300000);
            expect(ModuleRunner.instance.invoke).toHaveBeenCalledWith(CustomComponentLifecycle.SessionManagerTab, {
                CustomComponent: expect.any(Symbol),
            });
        });

        it("should render standard SessionManagerTab if if there are no module-implementations using the lifecycle", () => {
            const { container } = render(getComponent());
            fireEvent.click(screen.getByText("Sessions"));

            expect(container.querySelector("#mx_tabpanel_USER_SESSION_MANAGER_TAB")).toBeVisible();
            // Expect that element unique to SessionsManagerTab is rendered.
            expect(screen.getByTestId("current-session-section")).toBeVisible();
        });

        it("should replace the default SessionManagerTab and return <div data-testid='custom-user-sessions-manager-tab'> instead", () => {
            jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts) => {
                if (lifecycleEvent === CustomComponentLifecycle.SessionManagerTab) {
                    (opts as CustomComponentOpts).CustomComponent = () => {
                        return (
                            <>
                                <div data-testid="custom-user-sessions-manager-tab" />
                            </>
                        );
                    };
                }
            });
            render(getComponent());
            fireEvent.click(screen.getByText("Sessions"));
            const customRolesTab = screen.queryByTestId("custom-user-sessions-manager-tab");
            expect(customRolesTab).toBeVisible();

            // Expect that element unique to RolesRoomSettingsTab is NOT-rendered, as proof of default RolesRoomSettingsTab not being in the document.
            expect(screen.queryByTestId("current-session-section")).toBeFalsy();
        });
    });
});
