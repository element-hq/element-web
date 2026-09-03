/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "test-utils-rtl";

import SettingsStore from "../../../settings/SettingsStore";
import { WidgetType } from "../../../widgets/WidgetType";
import { type IApp } from "../../../stores/WidgetStore";
import { CallTile } from "./CallTile";

vi.mock("./ElementCallAppTile", () => ({
    ElementCallAppTile: () => <div data-testid="element-call-app-tile" />,
}));
vi.mock("../elements/AppTile", () => ({
    default: () => <div data-testid="app-tile" />,
}));

const mkApp = (type: string): IApp => ({
    id: "widget1",
    type,
    url: "https://example.org",
    name: "Widget",
    creatorUserId: "@alice:example.org",
    roomId: "!1:example.org",
    eventId: "$event",
    avatar_url: undefined,
});

describe("CallTile", () => {
    let reactCallEnabled: boolean;

    beforeEach(() => {
        reactCallEnabled = false;
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name): any =>
            name === "feature_element_call_react" ? reactCallEnabled : undefined,
        );
    });

    it("renders an AppTile for Element Call when the React transport is off", () => {
        render(<CallTile app={mkApp(WidgetType.CALL.preferred)} />);
        expect(screen.getByTestId("app-tile")).toBeInTheDocument();
        expect(screen.queryByTestId("element-call-app-tile")).not.toBeInTheDocument();
    });

    it("renders the React tile for Element Call when the React transport is on", () => {
        reactCallEnabled = true;
        render(<CallTile app={mkApp(WidgetType.CALL.preferred)} />);
        expect(screen.getByTestId("element-call-app-tile")).toBeInTheDocument();
        expect(screen.queryByTestId("app-tile")).not.toBeInTheDocument();
    });
});
