/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { fireEvent, render } from "jest-matrix-react";
import { ClientWidgetApi, MatrixWidgetType } from "matrix-widget-api";
import React from "react";
import { TooltipProvider } from "@vector-im/compound-web";
import { mocked } from "jest-mock";
import { findLast, last } from "lodash";

import ModalWidgetDialog from "../../../../src/components/views/dialogs/ModalWidgetDialog";
import { stubClient } from "../../../test-utils";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import SettingsStore from "../../../../src/settings/SettingsStore";

jest.mock("matrix-widget-api", () => ({
    ...jest.requireActual("matrix-widget-api"),
    ClientWidgetApi: (jest.createMockFromModule("matrix-widget-api") as any).ClientWidgetApi,
}));

describe("ModalWidgetDialog", () => {
    it("informs the widget of theme changes", () => {
        stubClient();
        let theme = "light";
        const settingsSpy = jest
            .spyOn(SettingsStore, "getValue")
            .mockImplementation((name) => (name === "theme" ? theme : null));
        try {
            render(
                <TooltipProvider>
                    <ModalWidgetDialog
                        widgetDefinition={{ type: MatrixWidgetType.Custom, url: "https://example.org" }}
                        sourceWidgetId=""
                        onFinished={() => {}}
                    />
                </TooltipProvider>,
            );
            // Indicate that the widget is loaded and ready
            fireEvent.load(document.getElementsByTagName("iframe").item(0)!);
            const messaging = mocked(last(mocked(ClientWidgetApi).mock.instances)!);
            findLast(messaging.once.mock.calls, ([eventName]) => eventName === "ready")![1]();

            // Now change the theme
            theme = "dark";
            defaultDispatcher.dispatch({ action: Action.RecheckTheme }, true);
            expect(messaging.updateTheme).toHaveBeenLastCalledWith({ name: "dark" });
        } finally {
            settingsSpy.mockRestore();
        }
    });
});
