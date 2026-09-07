/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, type MockedObject } from "vitest";
import React from "react";
import { fireEvent, render } from "test-utils-rtl";
import { ClientWidgetApi, MatrixWidgetType } from "matrix-widget-api";
import type * as MatrixWidgetApi from "matrix-widget-api";
import { TooltipProvider } from "@vector-im/compound-web";
import { findLast, last } from "lodash";
import { stubClient } from "test-utils";

import ModalWidgetDialog from "./ModalWidgetDialog";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import SettingsStore from "../../../settings/SettingsStore";

vi.mock("matrix-widget-api", async () => {
    const actual = await vi.importActual<typeof MatrixWidgetApi>("matrix-widget-api");
    return {
        ...actual,
        ClientWidgetApi: vi.fn(function () {
            return {
                on: vi.fn(),
                once: vi.fn(),
                off: vi.fn(),
                stop: vi.fn(),
                updateTheme: vi.fn(),
                sendWidgetConfig: vi.fn(),
                notifyModalWidgetButtonClicked: vi.fn(),
                transport: { reply: vi.fn() },
            };
        }),
    };
});

describe("ModalWidgetDialog", () => {
    it("informs the widget of theme changes", () => {
        stubClient();
        let theme = "light";
        const settingsSpy = vi
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
            const messaging: MockedObject<ClientWidgetApi> = vi.mocked(
                last(vi.mocked(ClientWidgetApi).mock.instances)!,
            );
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
