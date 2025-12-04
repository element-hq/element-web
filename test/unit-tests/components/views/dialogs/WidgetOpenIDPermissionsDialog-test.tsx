/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { WidgetKind } from "matrix-widget-api";

import { stubClient } from "../../../../test-utils";
import WidgetOpenIDPermissionsDialog from "../../../../../src/components/views/dialogs/WidgetOpenIDPermissionsDialog.tsx";

describe("WidgetOpenIDPermissionsDialog", () => {
    const mockWidget = {
        id: "test-widget",
        name: "Test Widget",
        templateUrl: "https://imawidget",
    } as any;

    const onFinished = jest.fn();

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
