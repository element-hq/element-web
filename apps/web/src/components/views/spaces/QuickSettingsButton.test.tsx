/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";

import QuickSettingsButton from "./QuickSettingsButton";
import SettingsStore from "../../../settings/SettingsStore";
import { SDKContextClass } from "../../../contexts/SDKContextClass";
import { SDKContext } from "../../../contexts/SDKContext.ts";

describe("QuickSettingsButton", () => {
    const roomId = "!room:example.com";

    const renderQuickSettingsButton = () => {
        render(<QuickSettingsButton isPanelCollapsed={true} />, {
            wrapper: ({ children }) => (
                <SDKContext.Provider value={SDKContextClass.instance}>{children}</SDKContext.Provider>
            ),
        });
    };

    const getQuickSettingsButton = () => {
        return screen.getByRole("button", { name: "Quick settings" });
    };

    const openQuickSettings = async () => {
        await userEvent.click(getQuickSettingsButton());
        await screen.findByRole("heading", { name: "Quick settings" });
    };

    it("should render the quick settings button", () => {
        renderQuickSettingsButton();
        expect(getQuickSettingsButton()).toBeInTheDocument();
    });

    it("should render the quick settings button in expanded mode", () => {
        const { asFragment } = render(<QuickSettingsButton isPanelCollapsed={false} />, {
            wrapper: ({ children }) => (
                <SDKContext.Provider value={SDKContextClass.instance}>{children}</SDKContext.Provider>
            ),
        });
        expect(asFragment()).toMatchSnapshot();
    });

    describe("when the quick settings are open", () => {
        beforeEach(async () => {
            renderQuickSettingsButton();
            await openQuickSettings();
        });

        it("should not render the »Developer tools« button", () => {
            renderQuickSettingsButton();
            expect(screen.queryByText("Developer tools")).not.toBeInTheDocument();
        });
    });

    describe("when developer mode is enabled", () => {
        beforeEach(() => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => setting === "developerMode");
            renderQuickSettingsButton();
        });

        afterEach(() => {
            vi.mocked(SettingsStore.getValue).mockRestore();
        });

        describe("and no room is viewed", () => {
            it("should not render the »Developer tools« button", () => {
                renderQuickSettingsButton();
                expect(screen.queryByText("Developer tools")).not.toBeInTheDocument();
            });
        });

        describe("and a room is viewed", () => {
            beforeEach(() => {
                vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(roomId);
            });

            afterEach(() => {
                vi.mocked(SDKContextClass.instance.roomViewStore.getRoomId).mockRestore();
            });

            describe("and the quick settings are open", () => {
                beforeEach(async () => {
                    await openQuickSettings();
                });

                it("should render the »Developer tools« button", () => {
                    expect(screen.getByRole("button", { name: "Developer tools" })).toBeInTheDocument();
                });
            });
        });
    });
});
