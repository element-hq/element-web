/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, type RenderResult, screen, waitFor } from "test-utils-rtl";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    mockPlatformPeg,
    stubClient,
} from "test-utils";
import userEvent from "@testing-library/user-event";

import PreferencesUserSettingsTab from "./PreferencesUserSettingsTab";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import MatrixClientBackedController from "../../../../../settings/controllers/MatrixClientBackedController";
import PlatformPeg from "../../../../../PlatformPeg";
import { type SettingKey } from "../../../../../settings/Settings.tsx";

describe("PreferencesUserSettingsTab", () => {
    beforeEach(() => {
        mockPlatformPeg();
    });

    const renderTab = (): RenderResult => {
        return render(<PreferencesUserSettingsTab />);
    };

    it("should render", () => {
        MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            ...mockClientMethodsUser(),
        });
        const { asFragment } = renderTab();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should reload when changing language", async () => {
        const reloadStub = vi.fn();
        PlatformPeg.get()!.reload = reloadStub;

        renderTab();
        const languageDropdown = await screen.findByRole("button", { name: "Language Dropdown" });
        expect(languageDropdown).toBeInTheDocument();

        await userEvent.click(languageDropdown);

        const germanOption = await screen.findByText("Deutsch");
        await userEvent.click(germanOption);
        expect(reloadStub).toHaveBeenCalled();
    });

    it("should search and select a user timezone", async () => {
        renderTab();

        expect(await screen.findByText(/Browser default/)).toBeInTheDocument();
        const timezoneDropdown = await screen.findByRole("button", { name: "Set timezone" });
        await userEvent.click(timezoneDropdown);

        // Without filtering `expect(screen.queryByRole("option" ...` take over 1s.
        await fireEvent.change(screen.getByRole("combobox", { name: "Set timezone" }), {
            target: { value: "Africa/Abidjan" },
        });

        expect(screen.queryByRole("option", { name: "Africa/Abidjan" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Europe/Paris" })).not.toBeInTheDocument();

        await fireEvent.change(screen.getByRole("combobox", { name: "Set timezone" }), {
            target: { value: "Europe/Paris" },
        });

        expect(screen.queryByRole("option", { name: "Africa/Abidjan" })).not.toBeInTheDocument();
        const option = await screen.getByRole("option", { name: "Europe/Paris" });
        await userEvent.click(option);

        expect(await screen.findByText("Europe/Paris")).toBeInTheDocument();
    });

    it("should not show spell check setting if unsupported", async () => {
        PlatformPeg.get()!.supportsSpellCheckSettings = vi.fn().mockReturnValue(false);

        renderTab();
        expect(screen.queryByRole("switch", { name: "Allow spell check" })).not.toBeInTheDocument();
    });

    it("should enable spell check", async () => {
        const spellCheckEnableFn = vi.fn();
        PlatformPeg.get()!.supportsSpellCheckSettings = vi.fn().mockReturnValue(true);
        PlatformPeg.get()!.getSpellCheckEnabled = vi.fn().mockReturnValue(false);
        PlatformPeg.get()!.setSpellCheckEnabled = spellCheckEnableFn;

        renderTab();
        const toggle = await screen.findByRole("switch", { name: "Allow spell check" });
        expect(toggle).not.toBeDisabled();

        await userEvent.click(toggle);

        expect(spellCheckEnableFn).toHaveBeenCalledWith(true);
    });

    describe("send read receipts", () => {
        beforeEach(() => {
            stubClient();
            vi.spyOn(SettingsStore, "setValue");
            vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
        });

        afterEach(() => {
            vi.resetAllMocks();
        });

        const getToggle = () => renderTab().getByRole("switch", { name: "Send read receipts" });

        const mockIsVersionSupported = (val: boolean) => {
            const client = MatrixClientPeg.safeGet();
            vi.spyOn(client, "doesServerSupportUnstableFeature").mockResolvedValue(false);
            vi.spyOn(client, "isVersionSupported").mockImplementation(async (version: string) => {
                if (version === "v1.4") return val;
                return false;
            });
            MatrixClientBackedController.matrixClient = client;
        };

        const mockGetValue = (val: boolean) => {
            const copyOfGetValueAt = SettingsStore.getValueAt;

            SettingsStore.getValueAt = (
                level: SettingLevel,
                name: SettingKey,
                roomId?: string,
                isExplicit?: boolean,
            ) => {
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

                await waitFor(() => expect(toggle).not.toBeDisabled());
                fireEvent.click(toggle);
                expectSetValueToHaveBeenCalled("sendReadReceipts", null, SettingLevel.ACCOUNT, true);
            });

            it("can be disabled", async () => {
                mockGetValue(true);
                const toggle = getToggle();

                await waitFor(() => expect(toggle).not.toBeDisabled());
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
                    expect(toggle).toBeChecked();
                    expect(toggle).toBeDisabled();
                });
            });

            it("cannot be disabled", async () => {
                mockGetValue(true);
                const toggle = getToggle();

                await waitFor(() => expect(toggle).toBeDisabled());
                console.log(toggle.innerHTML);
                fireEvent.click(toggle);
                expect(SettingsStore.setValue).not.toHaveBeenCalled();
            });
        });
    });
});
