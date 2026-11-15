/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { type IApp } from "../../../utils/WidgetUtils-types";
import { buildCompatWrapperUrl, isCompatWrapperUrlAllowed } from "./compatWrapperUrl";

describe("buildCompatWrapperUrl", () => {
    const app: IApp = {
        id: "widget-1",
        creatorUserId: "@alice:example.org",
        type: "m.custom",
        url: "https://widget.example/app/?user=$matrix_user_id&theme=$org.matrix.msc2873.client_theme",
        roomId: "!room:example.org",
    };

    it("embeds the untemplated widget URL in the bundled wrapper", () => {
        const url = new URL(buildCompatWrapperUrl(app));

        expect(url.origin + url.pathname).toBe(`${window.location.origin}/widgets/compat-wrapper/`);
        expect(url.searchParams.get("legacy_widget_url")).toBe(app.url);
        expect(url.searchParams.get("legacy_widget_id")).toBe("widget-1");
        expect(url.searchParams.get("legacy_widget_name")).toBe("widget-1");
        expect(url.searchParams.get("legacy_wait_for_iframe_load")).toBe("true");
        expect(url.searchParams.get("legacy_widget_data")).toBeNull();
        expect(url.searchParams.get("client_origin")).toBe(window.location.origin);
    });

    it("passes the name, widget data and the waitForIframeLoad flag through", () => {
        const url = new URL(
            buildCompatWrapperUrl({ ...app, name: "Notes", waitForIframeLoad: false, data: { title: "Notes & more" } }),
        );

        expect(url.searchParams.get("legacy_widget_name")).toBe("Notes");

        expect(url.searchParams.get("legacy_wait_for_iframe_load")).toBe("false");
        expect(JSON.parse(url.searchParams.get("legacy_widget_data")!)).toEqual({ title: "Notes & more" });
    });

    it("appends the integration manager token to the widget URL without touching template variables", () => {
        const url = new URL(buildCompatWrapperUrl(app, { scalarToken: "tok/en" }));

        expect(url.searchParams.get("legacy_widget_url")).toBe(`${app.url}&scalar_token=tok%2Fen`);
    });

    it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "blob:https://a/b", "$url", ""])(
        "refuses to embed %s",
        (url) => {
            expect(isCompatWrapperUrlAllowed(url)).toBe(false);
            expect(() => buildCompatWrapperUrl({ ...app, url })).toThrow("not a web page");
        },
    );

    it("allows http and https widget URLs", () => {
        expect(isCompatWrapperUrlAllowed("http://localhost:8080/widget")).toBe(true);
        expect(isCompatWrapperUrlAllowed(app.url)).toBe(true);
    });

    it("starts the query of a widget URL without one", () => {
        const url = new URL(buildCompatWrapperUrl({ ...app, url: "https://widget.example/" }, { scalarToken: "t" }));

        expect(url.searchParams.get("legacy_widget_url")).toBe("https://widget.example/?scalar_token=t");
    });
});
