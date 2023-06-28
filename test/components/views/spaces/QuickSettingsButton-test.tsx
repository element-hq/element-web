/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import QuickSettingsButton from "../../../../src/components/views/spaces/QuickSettingsButton";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";

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
