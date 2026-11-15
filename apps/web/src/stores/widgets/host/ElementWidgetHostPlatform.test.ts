/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from "vitest";
import { Widget, WidgetKind } from "matrix-widget-api";
import { waitFor } from "test-utils-rtl";

import { ElementWidgetHostPlatform } from "./ElementWidgetHostPlatform";
import * as WidgetCapabilityApproval from "../WidgetCapabilityApproval";
import * as WidgetOpenIdApproval from "../WidgetOpenIdApproval";
import { ELEMENT_CLIENT_ID } from "../../../identifiers";
import * as Navigator from "../../../utils/permalinks/navigator";

vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
}));

describe("ElementWidgetHostPlatform", () => {
    const widget = new Widget({
        id: "widget-1",
        creatorUserId: "@alice:example.org",
        type: "m.custom",
        url: "https://widget.example/",
    });
    const send = "org.matrix.msc2762.send.event:m.room.message";
    const receive = "org.matrix.msc2762.receive.event:m.room.message";

    let contentWindow: { postMessage: Mock<(message: unknown, origin: string) => void> };
    let iframe: HTMLIFrameElement | null;
    let driver: {
        approveCapabilities: Mock<(approved: string[]) => void>;
        resolveOpenid: Mock<(allowed: boolean) => Promise<void>>;
    };
    let onReady: Mock<() => void>;
    let setAlwaysOnScreen: Mock<(value: boolean) => boolean>;
    let onCapabilitiesChanged: Mock<() => void>;
    let approve: MockInstance<typeof WidgetCapabilityApproval.approveWidgetCapabilities>;
    let platform: ElementWidgetHostPlatform;

    beforeEach(() => {
        contentWindow = { postMessage: vi.fn() };
        iframe = { contentWindow } as unknown as HTMLIFrameElement;
        driver = { approveCapabilities: vi.fn(), resolveOpenid: vi.fn().mockResolvedValue(undefined) };
        onReady = vi.fn();
        setAlwaysOnScreen = vi.fn().mockReturnValue(true);
        onCapabilitiesChanged = vi.fn();
        approve = vi.spyOn(WidgetCapabilityApproval, "approveWidgetCapabilities");
        platform = new ElementWidgetHostPlatform({
            widget,
            widgetKind: WidgetKind.Room,
            roomId: "!room:example.org",
            getIframe: () => iframe,
            onReady,
            setAlwaysOnScreen,
            onCapabilitiesChanged,
        });
        platform.setDriver(driver);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("posts messages to the iframe on our own origin", () => {
        platform.sendToWidget(JSON.stringify({ action: "content_loaded" }));
        expect(contentWindow.postMessage).toHaveBeenCalledWith({ action: "content_loaded" }, window.location.origin);
    });

    it("drops messages when there is no iframe", () => {
        iframe = null;
        expect(() => platform.sendToWidget("{}")).not.toThrow();
        expect(contentWindow.postMessage).not.toHaveBeenCalled();
    });

    it("approves the capabilities the shared approval grants, asynchronously", async () => {
        approve.mockResolvedValue(new Set([send]));

        platform.onCapabilitiesRequested([send, receive]);
        // The decision must not be taken from within the driver's call
        expect(driver.approveCapabilities).not.toHaveBeenCalled();

        await waitFor(() => expect(driver.approveCapabilities).toHaveBeenCalledWith([send]));
        expect(approve).toHaveBeenCalledWith(
            expect.objectContaining({
                widget,
                widgetKind: WidgetKind.Room,
                roomId: "!room:example.org",
                requested: new Set([send, receive]),
            }),
        );
        expect(onCapabilitiesChanged).toHaveBeenCalledTimes(1);
    });

    it("decides one request at a time, in order", async () => {
        const first = Promise.withResolvers<Set<string>>();
        approve.mockReturnValueOnce(first.promise).mockResolvedValueOnce(new Set([receive]));

        platform.onCapabilitiesRequested([send]);
        platform.onCapabilitiesRequested([receive]);
        await Promise.resolve();
        expect(approve).toHaveBeenCalledTimes(1);

        first.resolve(new Set([send]));
        await waitFor(() => expect(driver.approveCapabilities).toHaveBeenCalledTimes(2));
        expect(driver.approveCapabilities.mock.calls).toEqual([[[send]], [[receive]]]);
    });

    it("denies everything when the decision fails, so the negotiation completes", async () => {
        approve.mockRejectedValue(new Error("boom"));

        platform.onCapabilitiesRequested([send]);

        await waitFor(() => expect(driver.approveCapabilities).toHaveBeenCalledWith([]));
    });

    it("resolves OpenID requests with the shared decision, asynchronously", async () => {
        const approveOpenId = vi.spyOn(WidgetOpenIdApproval, "approveWidgetOpenId").mockResolvedValue(true);

        platform.onOpenidRequested();
        expect(driver.resolveOpenid).not.toHaveBeenCalled();

        await waitFor(() => expect(driver.resolveOpenid).toHaveBeenCalledWith(true));
        expect(approveOpenId).toHaveBeenCalledWith(
            expect.objectContaining({ widget, widgetKind: WidgetKind.Room, roomId: "!room:example.org" }),
        );

        approveOpenId.mockRejectedValue(new Error("boom"));
        platform.onOpenidRequested();
        await waitFor(() => expect(driver.resolveOpenid).toHaveBeenCalledWith(false));
    });

    it("opens permalinks and passes on always-on-screen requests", () => {
        const navigate = vi.spyOn(Navigator, "navigateToPermalink").mockReturnValue();
        platform.navigate("https://matrix.to/#/!room:example.org");
        expect(navigate).toHaveBeenCalledWith("https://matrix.to/#/!room:example.org");

        expect(platform.setAlwaysOnScreen(true)).toBe(true);
        expect(setAlwaysOnScreen).toHaveBeenCalledWith(true);
    });

    it("reports readiness and the client context", () => {
        platform.onReady();
        expect(onReady).toHaveBeenCalledTimes(1);
        expect(platform.clientId()).toBe(ELEMENT_CLIENT_ID);
        expect(typeof platform.clientTheme()).toBe("string");
        expect(typeof platform.clientLanguage()).toBe("string");
    });
});
