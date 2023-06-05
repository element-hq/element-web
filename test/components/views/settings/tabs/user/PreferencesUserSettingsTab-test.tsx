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
import { fireEvent, render, RenderResult, waitFor } from "@testing-library/react";

import PreferencesUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/PreferencesUserSettingsTab";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { mockPlatformPeg, stubClient } from "../../../../../test-utils";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../src/settings/SettingLevel";
import MatrixClientBackedController from "../../../../../../src/settings/controllers/MatrixClientBackedController";

describe("PreferencesUserSettingsTab", () => {
    beforeEach(() => {
        mockPlatformPeg();
    });

    const renderTab = (): RenderResult => {
        return render(<PreferencesUserSettingsTab closeSettingsFn={() => {}} />);
    };

    it("should render", () => {
        const { asFragment } = renderTab();
        expect(asFragment()).toMatchSnapshot();
    });

    describe("send read receipts", () => {
        beforeEach(() => {
            stubClient();
            jest.spyOn(SettingsStore, "setValue");
            jest.spyOn(SettingsStore, "canSetValue").mockReturnValue(true);
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
    });
});
