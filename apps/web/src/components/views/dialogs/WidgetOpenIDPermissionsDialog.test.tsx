/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render } from "test-utils-rtl";
import { WidgetKind } from "matrix-widget-api";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { stubClient } from "test-utils";
import WidgetOpenIDPermissionsDialog from "./WidgetOpenIDPermissionsDialog";

vi.mock("react-focus-lock");

describe("WidgetOpenIDPermissionsDialog", () => {
    const mockWidget = {
        id: "test-widget",
        name: "Test Widget",
        templateUrl: "https://imawidget",
    } as any;

    const onFinished = vi.fn();

    beforeEach(() => {
        stubClient();
        onFinished.mockClear();
    });

    it("should render", () => {
        const dialog = render(
            <WidgetOpenIDPermissionsDialog widget={mockWidget} widgetKind={WidgetKind.Room} onFinished={onFinished} />,
        );

        expect(dialog.getByText("Allow this widget to verify your identity")).toBeInTheDocument();
        expect(dialog.asFragment()).toMatchSnapshot();
    });
});
