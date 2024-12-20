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
import { fireEvent, render, RenderResult, waitFor, screen } from "@testing-library/react";

import PreferencesUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/PreferencesUserSettingsTab";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { mockPlatformPeg, stubClient } from "../../../../../test-utils";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../src/settings/SettingLevel";
import MatrixClientBackedController from "../../../../../../src/settings/controllers/MatrixClientBackedController";
import { UIFeature } from "../../../../../../src/settings/UIFeature";

describe("PreferencesUserSettingsTab", () => {
    beforeEach(() => {
        mockPlatformPeg();

        // NOTE: keep updated with new feature flags you intend to test further down.
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
            switch (settingName) {
                case UIFeature.ShowStickersButtonSetting:
                    return false;

                case UIFeature.InsertTrailingColonSetting:
                    return false;

                case UIFeature.ShowJoinLeavesSetting:
                    return false;

                case UIFeature.ShowChatEffectSetting:
                    return false;

                default:
                    return "default";
            }
        });

        jest.spyOn(SettingsStore, "getValueAt").mockImplementation((level, key) => {
            if (level === SettingLevel.DEVICE && key === "autocompleteDelay") {
                return "10";
            }
            return "default";
        });
    });

    const renderTab = (): RenderResult => {
        return render(<PreferencesUserSettingsTab closeSettingsFn={() => {}} />);
    };

    it("should render", () => {
        const { asFragment } = renderTab();
        expect(asFragment()).toMatchSnapshot();
    });

    describe("Feature flag tests for PreferencesUserSettingsTab", () => {
        describe("Feature flag: ShowStickersButtonSetting", () => {
            beforeEach(() => {
                jest.clearAllMocks();
            });

            it("ShowStickersButtonSetting: false > should NOT render the 'Show Sticker button' toggle", () => {
                renderTab();
                expect(screen.queryByText("Show stickers button")).toBeFalsy();
            });

            it("ShowStickersButtonSetting: true > should render the 'Show Sticker button' toggle", () => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
                    switch (settingName) {
                        case UIFeature.ShowStickersButtonSetting:
                            return true;

                        case UIFeature.InsertTrailingColonSetting:
                            return false;

                        case UIFeature.ShowJoinLeavesSetting:
                            return false;

                        case UIFeature.ShowChatEffectSetting:
                            return false;

                        default:
                            return "default";
                    }
                });

                renderTab();
                expect(screen.queryByText("Show stickers button")).toBeTruthy();
            });
        });

        describe("Feature flag: InsertTrailingColonSetting", () => {
            beforeEach(() => {
                jest.clearAllMocks();
            });

            it("InsertTrailingColonSetting: false > should NOT render the 'Insert a trailing colon after user mentions at the start of a message' toggle", () => {
                renderTab();
                expect(
                    screen.queryByText("Insert a trailing colon after user mentions at the start of a message"),
                ).toBeNull();
            });

            it("InsertTrailingColonSetting: true > should render the 'Insert a trailing colon after user mentions at the start of a message' toggle", () => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
                    switch (settingName) {
                        case UIFeature.ShowStickersButtonSetting:
                            return false;

                        case UIFeature.InsertTrailingColonSetting:
                            return true;

                        case UIFeature.ShowJoinLeavesSetting:
                            return false;

                        case UIFeature.ShowChatEffectSetting:
                            return false;

                        default:
                            return "default";
                    }
                });

                renderTab();
                expect(
                    screen.queryByText("Insert a trailing colon after user mentions at the start of a message"),
                ).toBeTruthy();
            });
        });

        describe("Feature flag: ShowJoinLeavesSetting", () => {
            beforeEach(() => {
                jest.clearAllMocks();
            });

            it("ShowJoinLeavesSetting: false > should NOT render the 'Show join/leave messages (invites/removes/bans unaffected)' toggle", () => {
                renderTab();
                expect(screen.queryByText("Show join/leave messages (invites/removes/bans unaffected)")).toBeNull();
            });

            it("InsertTrailingColonSetting: true > should render the 'Show join/leave messages (invites/removes/bans unaffected)' toggle", () => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
                    switch (settingName) {
                        case UIFeature.ShowStickersButtonSetting:
                            return false;

                        case UIFeature.InsertTrailingColonSetting:
                            return false;

                        case UIFeature.ShowJoinLeavesSetting:
                            return true;

                        case UIFeature.ShowChatEffectSetting:
                            return false;

                        default:
                            return "default";
                    }
                });

                renderTab();
                expect(screen.queryByText("Show join/leave messages (invites/removes/bans unaffected)")).toBeTruthy();
            });
        });

        describe("Feature flag: ShowChatEffectSetting", () => {
            beforeEach(() => {
                jest.clearAllMocks();
            });

            it("ShowChatEffectSetting: false > should NOT render the 'Show chat effects (animations when receiving e.g. confetti)' toggle", () => {
                renderTab();
                expect(screen.queryByText("Show chat effects (animations when receiving e.g. confetti)")).toBeNull();
            });

            it("ShowChatEffectSetting: true > should render the 'Show chat effects (animations when receiving e.g. confetti)' toggle", () => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
                    switch (settingName) {
                        case UIFeature.ShowStickersButtonSetting:
                            return false;

                        case UIFeature.InsertTrailingColonSetting:
                            return false;

                        case UIFeature.ShowJoinLeavesSetting:
                            return false;

                        case UIFeature.ShowChatEffectSetting:
                            return true;

                        default:
                            return "default";
                    }
                });

                renderTab();
                expect(screen.queryByText("Show chat effects (animations when receiving e.g. confetti)")).toBeTruthy();
            });
        });
    });

    describe("send read receipts", () => {
        beforeEach(() => {
            stubClient();
            jest.spyOn(SettingsStore, "setValue");
            jest.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        const getToggle = () => renderTab().getByRole("switch", { name: "Send read receipts" });

        const mockIsVersionSupported = (val: boolean) => {
            const client = MatrixClientPeg.safeGet();
            jest.spyOn(client, "doesServerSupportUnstableFeature").mockResolvedValue(false);
            jest.spyOn(client, "isVersionSupported").mockImplementation(async (version: string) => {
                if (version === "v1.4") return val;
                return false;
            });
            MatrixClientBackedController.matrixClient = client;
        };

        const mockGetValue = (val: boolean) => {
            const copyOfGetValueAt = SettingsStore.getValueAt;

            SettingsStore.getValueAt = (level: SettingLevel, name: string, roomId?: string, isExplicit?: boolean) => {
                if (name === "sendReadReceipts") return val;
                return copyOfGetValueAt(level, name, roomId, isExplicit);
            };
        };

        const expectSetValueToHaveBeenCalled = (
            name: string,
            roomId: string | null,
            level: SettingLevel,
            value: boolean,
        ) => expect(SettingsStore.setValue).toHaveBeenCalledWith(name, roomId, level, value);

        describe("with server support", () => {
            beforeEach(() => {
                mockIsVersionSupported(true);
            });

            it("can be enabled", async () => {
                mockGetValue(false);
                const toggle = getToggle();

                await waitFor(() => expect(toggle).toHaveAttribute("aria-disabled", "false"));
                fireEvent.click(toggle);
                expectSetValueToHaveBeenCalled("sendReadReceipts", null, SettingLevel.ACCOUNT, true);
            });

            it("can be disabled", async () => {
                mockGetValue(true);
                const toggle = getToggle();

                await waitFor(() => expect(toggle).toHaveAttribute("aria-disabled", "false"));
                fireEvent.click(toggle);
                expectSetValueToHaveBeenCalled("sendReadReceipts", null, SettingLevel.ACCOUNT, false);
            });
        });

        describe("without server support", () => {
            beforeEach(() => {
                mockIsVersionSupported(false);
            });

            it("is forcibly enabled", async () => {
                const toggle = getToggle();
                await waitFor(() => {
                    expect(toggle).toHaveAttribute("aria-checked", "true");
                    expect(toggle).toHaveAttribute("aria-disabled", "true");
                });
            });

            it("cannot be disabled", async () => {
                mockGetValue(true);
                const toggle = getToggle();

                await waitFor(() => expect(toggle).toHaveAttribute("aria-disabled", "true"));
                fireEvent.click(toggle);
                expect(SettingsStore.setValue).not.toHaveBeenCalled();
            });
        });

        describe("testing with UIFeature.SearchShortcutPreferences being true or false.", () => {
            beforeEach(() => {
                jest.clearAllMocks();
                jest.spyOn(SettingsStore, "getValueAt").mockImplementation((level, key) => {
                    if (level === SettingLevel.DEVICE && key === "autocompleteDelay") {
                        return "10";
                    }
                    return "default";
                });
            });

            it('renders "Use Ctrl + F to search timeline" when UIFeature.SearchShortcutPreferences is true', () => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => {
                    if (name === "UIFeature.searchShortcutPreferences") {
                        return true;
                    }
                    return "default";
                });
                renderTab();

                expect(screen.queryByText("Use Ctrl + F to search timeline")).not.toBeNull();
            });

            it('does not render "Use Ctrl + F to search timeline" when UIFeature.SearchShortcutPreferences is false', () => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => {
                    if (name === "UIFeature.searchShortcutPreferences") {
                        return false;
                    }
                    return "default";
                });
                renderTab();

                expect(screen.queryByText("Use Ctrl + F to search timeline")).toBeNull();
            });
        });
    });
});
