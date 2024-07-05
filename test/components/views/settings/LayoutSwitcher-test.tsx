/*
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { mocked } from "jest-mock";

import { LayoutSwitcher } from "../../../../src/components/views/settings/LayoutSwitcher";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { stubClient } from "../../../test-utils";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { Layout } from "../../../../src/settings/enums/Layout";

describe("<LayoutSwitcher />", () => {
    const matrixClient = stubClient();
    const profileInfo = {
        displayname: "Alice",
    };

    async function renderLayoutSwitcher() {
        const renderResult = render(
            <MatrixClientContext.Provider value={matrixClient}>
                <LayoutSwitcher />
            </MatrixClientContext.Provider>,
        );

        // Wait for the profile info to be displayed in the event tile preview
        // Also avoid act warning
        await waitFor(() => expect(screen.getAllByText(profileInfo.displayname).length).toBe(3));
        return renderResult;
    }

    beforeEach(async () => {
        await SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
        mocked(matrixClient).getProfileInfo.mockResolvedValue(profileInfo);
    });

    it("should render", async () => {
        const { asFragment } = await renderLayoutSwitcher();
        expect(asFragment()).toMatchSnapshot();
    });

    describe("layout selection", () => {
        it("should display the modern layout", async () => {
            await renderLayoutSwitcher();
            expect(screen.getByRole("radio", { name: "Modern" })).toBeChecked();
        });

        it("should change the layout when selected", async () => {
            await renderLayoutSwitcher();
            act(() => screen.getByRole("radio", { name: "Message bubbles" }).click());

            expect(screen.getByRole("radio", { name: "Message bubbles" })).toBeChecked();
            await waitFor(() => expect(SettingsStore.getValue<boolean>("layout")).toBe(Layout.Bubble));
        });
    });

    describe("compact layout", () => {
        beforeEach(async () => {
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, false);
        });

        it("should be enabled", async () => {
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            await renderLayoutSwitcher();

            expect(screen.getByRole("checkbox", { name: "Show compact text and messages" })).toBeChecked();
        });

        it("should change the setting when toggled", async () => {
            await renderLayoutSwitcher();
            act(() => screen.getByRole("checkbox", { name: "Show compact text and messages" }).click());

            await waitFor(() => expect(SettingsStore.getValue<boolean>("useCompactLayout")).toBe(true));
        });

        it("should be disabled when the modern layout is not enabled", async () => {
            await SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            await renderLayoutSwitcher();
            expect(screen.getByRole("checkbox", { name: "Show compact text and messages" })).toBeDisabled();
        });
    });
});
