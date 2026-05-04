/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, screen, waitFor } from "jest-matrix-react";
import { useEventPresentation } from "@element-hq/web-shared-components";

import { Layout } from "../../../src/settings/enums/Layout";
import { EventPresentationProvider, getEventPresentation } from "../../../src/utils/EventPresentationProvider";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";

function PresentationProbe(): React.ReactElement {
    const { layout, density } = useEventPresentation();

    return React.createElement("div", { "data-testid": "presentation" }, `${layout}:${density}`);
}

describe("EventPresentationProvider", () => {
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
            React.createElement(
                EventPresentationProvider,
                { layout: Layout.Group },
                React.createElement(PresentationProbe),
            ),
        );

        expect(screen.getByTestId("presentation")).toHaveTextContent("group:default");

        await act(async () => {
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
        });

        await waitFor(() => expect(screen.getByTestId("presentation")).toHaveTextContent("group:compact"));
    });
});
