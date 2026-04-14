/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, describe, expect, test, type vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type WidgetApi, type I18nApi } from "@element-hq/element-web-module-api";
import { type IWidget } from "matrix-widget-api";
import { type PropsWithChildren } from "react";
import { TooltipProvider } from "@vector-im/compound-web";
import userEvent from "@testing-library/user-event";

import { WidgetToggle } from "../src/toggle";
import { mockI18nApi, mockWidget, mockWidgetApi } from "./mocks";

const roomId = "!room:example.com";

const wrapper = ({ children }: PropsWithChildren): React.JSX.Element => <TooltipProvider>{children}</TooltipProvider>;

describe("WidgetToggle", () => {
    let widgetApi: WidgetApi;
    let i18nApi: I18nApi;
    let app: IWidget;

    beforeEach(() => {
        widgetApi = mockWidgetApi();
        i18nApi = mockI18nApi();
        app = mockWidget();
    });

    test("displays avatar image when widget has an avatar URL", () => {
        (widgetApi.getAppAvatarUrl as ReturnType<typeof vi.fn>).mockReturnValue("https://example.com/avatar.png");
        render(<WidgetToggle app={app} roomId={roomId} widgetApi={widgetApi} i18nApi={i18nApi} />, { wrapper });
        const img = screen.getByRole("img", { name: app.name });
        expect(img).toBeDefined();
        expect(img.getAttribute("src")).toBe("https://example.com/avatar.png");
    });

    test("renders the Jitsi avatar for Jitsi widgets", () => {
        app = mockWidget({ type: "m.jitsi", name: "Jitsi" });
        render(<WidgetToggle app={app} roomId={roomId} widgetApi={widgetApi} i18nApi={i18nApi} />, { wrapper });
        const img = screen.getByRole("img", { name: "Jitsi" });
        expect(img.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    test("shows 'Show' label when widget is not in container", () => {
        (widgetApi.isAppInContainer as ReturnType<typeof vi.fn>).mockReturnValue(false);
        render(<WidgetToggle app={app} roomId={roomId} widgetApi={widgetApi} i18nApi={i18nApi} />, { wrapper });
        const button = screen.getByRole("button", { name: "Show My Widget" });
        expect(button).toBeDefined();
    });

    test("shows 'Hide' label when widget is in container", () => {
        (widgetApi.isAppInContainer as ReturnType<typeof vi.fn>).mockReturnValue(true);
        render(<WidgetToggle app={app} roomId={roomId} widgetApi={widgetApi} i18nApi={i18nApi} />, { wrapper });
        const button = screen.getByRole("button", { name: "Hide My Widget" });
        expect(button).toBeDefined();
    });

    test("calls moveAppToContainer with 'top' when widget is not in container and button is clicked", async () => {
        const user = userEvent.setup();

        (widgetApi.isAppInContainer as ReturnType<typeof vi.fn>).mockReturnValue(false);
        render(<WidgetToggle app={app} roomId={roomId} widgetApi={widgetApi} i18nApi={i18nApi} />, { wrapper });
        const button = screen.getByRole("button", { name: "Show My Widget" });
        await user.click(button);
        expect(widgetApi.moveAppToContainer).toHaveBeenCalledWith(app, "top", roomId);
    });

    test("calls moveAppToContainer with 'right' when widget is in container and button is clicked", async () => {
        const user = userEvent.setup();

        (widgetApi.isAppInContainer as ReturnType<typeof vi.fn>).mockReturnValue(true);
        render(<WidgetToggle app={app} roomId={roomId} widgetApi={widgetApi} i18nApi={i18nApi} />, { wrapper });
        const button = screen.getByRole("button", { name: "Hide My Widget" });
        await user.click(button);
        expect(widgetApi.moveAppToContainer).toHaveBeenCalledWith(app, "right", roomId);
    });
});
