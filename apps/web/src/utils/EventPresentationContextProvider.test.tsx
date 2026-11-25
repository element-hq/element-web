/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "test-utils-rtl";
import { useEventPresentation } from "@element-hq/web-shared-components";

import { Layout } from "../settings/enums/Layout";
import { EventPresentationContextProvider, getEventPresentation } from "./EventPresentationContextProvider";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";

const PresentationProbe: React.FC = () => {
    const { layout, density } = useEventPresentation();

    return <div data-testid="presentation">{`${layout}:${density}`}</div>;
};

describe("EventPresentationContextProvider", () => {
    beforeEach(async () => {
        await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, false);
    });

    it.each([
        [Layout.Group, false, { layout: "group", density: "default" }],
        [Layout.Group, true, { layout: "group", density: "compact" }],
        [Layout.Bubble, false, { layout: "bubble", density: "default" }],
        [Layout.Bubble, true, { layout: "bubble", density: "default" }],
        [Layout.IRC, false, { layout: "irc", density: "default" }],
        [Layout.IRC, true, { layout: "irc", density: "default" }],
    ])("maps %s with compact=%s", (layout, useCompactLayout, expected) => {
        expect(getEventPresentation(layout, useCompactLayout)).toEqual(expected);
    });

    it("updates provider density when compact layout changes", async () => {
        render(
            <EventPresentationContextProvider layout={Layout.Group}>
                <PresentationProbe />
            </EventPresentationContextProvider>,
        );

        expect(screen.getByTestId("presentation")).toHaveTextContent("group:default");

        await act(async () => {
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
        });

        await waitFor(() => expect(screen.getByTestId("presentation")).toHaveTextContent("group:compact"));
    });
});
