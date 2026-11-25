/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "test-utils-rtl";
import { stubClient } from "test-utils";

import { LayoutSwitcher } from "./LayoutSwitcher";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import { Layout } from "../../../settings/enums/Layout";

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
        vi.mocked(matrixClient).getProfileInfo.mockResolvedValue(profileInfo);
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
            await waitFor(() => expect(SettingsStore.getValue("layout")).toBe(Layout.Bubble));
        });
    });

    describe("compact layout", () => {
        beforeEach(async () => {
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, false);
        });

        it("should be enabled", async () => {
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            await renderLayoutSwitcher();

            expect(screen.getByRole("switch", { name: "Show compact text and messages" })).toBeChecked();
        });

        it("should change the setting when toggled", async () => {
            await renderLayoutSwitcher();
            act(() => screen.getByRole("switch", { name: "Show compact text and messages" }).click());

            await waitFor(() => expect(SettingsStore.getValue("useCompactLayout")).toBe(true));
        });

        it("should be disabled when the modern layout is not enabled", async () => {
            await SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            await renderLayoutSwitcher();
            expect(screen.getByRole("switch", { name: "Show compact text and messages" })).toBeDisabled();
        });

        it("should keep layout previews at the default density", async () => {
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            const { container } = await renderLayoutSwitcher();

            const groupPreviewSender = container.querySelector(
                '[data-testid="event-tile-slot-sender"] [data-event-layout="group"]',
            );
            expect(groupPreviewSender).toHaveAttribute("data-event-density", "default");
        });
    });
});
