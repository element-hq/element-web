/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import QuickSettingsButton from "../../../../../src/components/views/spaces/QuickSettingsButton";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SdkContextClass } from "../../../../../src/contexts/SDKContext";

describe("QuickSettingsButton", () => {
    const roomId = "!room:example.com";

    const renderQuickSettingsButton = () => {
        render(<QuickSettingsButton isPanelCollapsed={true} />);
    };

    const getQuickSettingsButton = () => {
        return screen.getByRole("button", { name: "Quick settings" });
    };

    const openQuickSettings = async () => {
        await userEvent.click(getQuickSettingsButton());
        await screen.findByText("Quick settings");
    };

    it("should render the quick settings button", () => {
        renderQuickSettingsButton();
        expect(getQuickSettingsButton()).toBeInTheDocument();
    });

    it("should render the quick settings button in expanded mode", () => {
        const { asFragment } = render(<QuickSettingsButton isPanelCollapsed={false} />);
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
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => setting === "developerMode");
            renderQuickSettingsButton();
        });

        afterEach(() => {
            mocked(SettingsStore.getValue).mockRestore();
        });

        describe("and no room is viewed", () => {
            it("should not render the »Developer tools« button", () => {
                renderQuickSettingsButton();
                expect(screen.queryByText("Developer tools")).not.toBeInTheDocument();
            });
        });

        describe("and a room is viewed", () => {
            beforeEach(() => {
                jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(roomId);
            });

            afterEach(() => {
                mocked(SdkContextClass.instance.roomViewStore.getRoomId).mockRestore();
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
