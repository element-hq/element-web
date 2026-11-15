/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatrixCapabilities, MatrixWidgetType } from "matrix-widget-api";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { mkRoom, stubClient } from "test-utils";
import { waitFor } from "test-utils-rtl";

import { loadWidgetHostBindings } from "./bindings";
import { createFakeBindings, FakeWidgetHostDriver } from "./bindings-mock";
import { isWidgetHostEligible, WidgetHostMessaging } from "./WidgetHostMessaging";
import { ElementWidgetHostPlatform } from "./ElementWidgetHostPlatform";
import { WidgetMessagingEvent } from "../IWidgetMessaging";
import * as WidgetMessagingModule from "../WidgetMessaging";
import { WidgetMessagingStore } from "../WidgetMessagingStore";
import { ElementWidgetCapabilities } from "../ElementWidgetCapabilities";
import ActiveWidgetStore from "../../ActiveWidgetStore";
import SettingsStore from "../../../settings/SettingsStore";
import { type IApp } from "../../../utils/WidgetUtils-types";
import { WidgetType } from "../../../widgets/WidgetType";

vi.mock("./bindings", () => ({
    loadWidgetHostBindings: vi.fn(),
}));

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

const ROOM_ID = "!room:example.org";

describe("isWidgetHostEligible", () => {
    const app: IApp = {
        id: "widget-1",
        creatorUserId: "@alice:example.org",
        type: MatrixWidgetType.Custom,
        url: "https://widget.example/",
        roomId: ROOM_ID,
    };
    const room = { roomId: ROOM_ID } as Room;

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("is off without the labs flag", () => {
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        expect(isWidgetHostEligible(app, room)).toBe(false);
    });

    it("covers generic room widgets only", () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name) => name === "feature_msc4412_widget_host");
        expect(isWidgetHostEligible(app, room)).toBe(true);
        expect(isWidgetHostEligible(app, undefined)).toBe(false);
        expect(isWidgetHostEligible({ ...app, type: WidgetType.CALL.preferred }, room)).toBe(false);
        expect(isWidgetHostEligible({ ...app, type: WidgetType.JITSI.preferred }, room)).toBe(false);
        expect(isWidgetHostEligible({ ...app, type: WidgetType.STICKERPICKER.preferred }, room)).toBe(false);
    });
});

describe("WidgetHostMessaging", () => {
    let client: MatrixClient;
    let room: Room;
    let app: IApp;
    let messaging: WidgetHostMessaging;
    let iframe: HTMLIFrameElement;
    let contentWindow: Window;
    let bindingsReady: PromiseWithResolvers<ReturnType<typeof createFakeBindings>>;

    const driver = (): FakeWidgetHostDriver => FakeWidgetHostDriver.instances.at(-1)!;

    /** Posts a message as the wrapper in our iframe would. */
    const postFromWidget = (data: unknown, overrides: Partial<MessageEventInit> = {}): void => {
        window.dispatchEvent(
            new MessageEvent("message", {
                data,
                origin: window.location.origin,
                source: contentWindow,
                ...overrides,
            }),
        );
    };

    beforeEach(() => {
        client = stubClient();
        room = mkRoom(client, ROOM_ID);
        app = {
            id: "widget-1",
            creatorUserId: "@alice:example.org",
            type: MatrixWidgetType.Custom,
            url: "https://widget.example/?user=$matrix_user_id",
            roomId: ROOM_ID,
        };
        contentWindow = {} as Window;
        iframe = { contentWindow, src: "" } as unknown as HTMLIFrameElement;
        FakeWidgetHostDriver.instances = [];
        bindingsReady = Promise.withResolvers();
        vi.mocked(loadWidgetHostBindings).mockReturnValue(bindingsReady.promise);
        vi.spyOn(ActiveWidgetStore.instance, "getWidgetPersistence").mockReturnValue(false);
        messaging = new WidgetHostMessaging(app, {
            app,
            room,
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
        });
    });

    afterEach(() => {
        messaging.stop({ forceDestroy: true });
        vi.restoreAllMocks();
    });

    it("refuses account widgets", () => {
        expect(
            () =>
                new WidgetHostMessaging(app, {
                    app,
                    userId: "@alice:example.org",
                    creatorUserId: "@alice:example.org",
                    waitForIframeLoad: true,
                    userWidget: true,
                }),
        ).toThrow();
    });

    it("embeds the widget through the compat wrapper and pops it out templated", async () => {
        const token = vi.spyOn(WidgetMessagingModule, "fetchScalarTokenIfNeeded").mockResolvedValue("tok");

        expect(new URL(messaging.embedUrl).pathname).toBe("/widgets/compat-wrapper/");
        await messaging.prepare();
        expect(token).toHaveBeenCalledWith(app.url);
        expect(new URL(messaging.embedUrl).searchParams.get("legacy_widget_url")).toContain("scalar_token=tok");
        expect(messaging.popoutUrl).toBe("https://widget.example/?user=%40userId%3Amatrix.org");
        expect(messaging.widgetApi).toBeNull();
    });

    it("starts the driver once the bindings are loaded and replays early messages", async () => {
        const onStart = vi.fn();
        messaging.on(WidgetMessagingEvent.Start, onStart);

        messaging.start(iframe);
        expect(messaging.isStarted).toBe(false);
        // The wrapper talks before the (first) wasm load is done
        postFromWidget({ action: "request_capabilities", requestId: "1" });

        bindingsReady.resolve(createFakeBindings());
        await waitFor(() => expect(messaging.isStarted).toBe(true));

        expect(onStart).toHaveBeenCalledWith(null);
        expect(driver().platform).toBeInstanceOf(ElementWidgetHostPlatform);
        expect(driver().setAutoApproved).toHaveBeenCalledWith(
            expect.arrayContaining([
                "widget:org.matrix.mscXXXX.get_matrix_context",
                "widget:org.matrix.mscXXXX.get_client_context",
                ElementWidgetCapabilities.RequiresClient,
            ]),
        );
        expect(driver().handleMessageFromWidget).toHaveBeenCalledWith(
            JSON.stringify({ action: "request_capabilities", requestId: "1" }),
        );
    });

    it("only accepts messages from the wrapper in our iframe on our origin", async () => {
        messaging.start(iframe);
        bindingsReady.resolve(createFakeBindings());
        await waitFor(() => expect(messaging.isStarted).toBe(true));

        postFromWidget({ action: "a" }, { source: {} as Window });
        postFromWidget({ action: "b" }, { origin: "https://evil.example" });
        postFromWidget('{"action":"c"}');

        expect(driver().handleMessageFromWidget).toHaveBeenCalledTimes(1);
        expect(driver().handleMessageFromWidget).toHaveBeenCalledWith('{"action":"c"}');
    });

    it("reports readiness and capabilities from the driver", async () => {
        const onReady = vi.fn();
        const onCapabilities = vi.fn();
        messaging.on(WidgetMessagingEvent.Ready, onReady);
        messaging.on(WidgetMessagingEvent.CapabilitiesChanged, onCapabilities);
        messaging.start(iframe);
        bindingsReady.resolve(createFakeBindings());
        await waitFor(() => expect(messaging.isStarted).toBe(true));

        const platform = driver().platform as ElementWidgetHostPlatform;
        platform.onReady();
        expect(onReady).toHaveBeenCalledTimes(1);

        driver().approved = [ElementWidgetCapabilities.RequiresClient, "widget:org.matrix.mscXXXX.send_event"];
        expect(messaging.hasCapability(ElementWidgetCapabilities.RequiresClient)).toBe(true);
        expect(messaging.hasCapability(MatrixCapabilities.Screenshots)).toBe(false);
    });

    it("keeps the widget on screen once the tile is ready for it, and stops instantly", async () => {
        const setPersistence = vi.spyOn(ActiveWidgetStore.instance, "setWidgetPersistence").mockReturnValue();
        const sticky = Promise.withResolvers<void>();
        messaging = new WidgetHostMessaging(app, {
            app,
            room,
            userId: "@alice:example.org",
            creatorUserId: "@alice:example.org",
            waitForIframeLoad: true,
            userWidget: false,
            stickyPromise: () => sticky.promise,
        });
        messaging.start(iframe);
        bindingsReady.resolve(createFakeBindings());
        await waitFor(() => expect(messaging.isStarted).toBe(true));
        const platform = driver().platform as ElementWidgetHostPlatform;

        expect(platform.setAlwaysOnScreen(true)).toBe(true);
        expect(setPersistence).not.toHaveBeenCalled();
        sticky.resolve();
        await waitFor(() => expect(setPersistence).toHaveBeenCalledWith("widget-1", ROOM_ID, true));

        expect(platform.setAlwaysOnScreen(false)).toBe(true);
        expect(setPersistence).toHaveBeenLastCalledWith("widget-1", ROOM_ID, false);
    });

    it("does not start a driver when stopped while the bindings load", async () => {
        messaging.start(iframe);
        messaging.stop({ forceDestroy: true });
        bindingsReady.resolve(createFakeBindings());
        await bindingsReady.promise;
        await Promise.resolve();

        expect(FakeWidgetHostDriver.instances).toHaveLength(0);
        expect(messaging.isStarted).toBe(false);
    });

    it("tears everything down on stop and tells the store", async () => {
        const onStop = vi.fn();
        messaging.on(WidgetMessagingEvent.Stop, onStop);
        const stopMessaging = vi.spyOn(WidgetMessagingStore.instance, "stopMessaging");
        messaging.start(iframe);
        bindingsReady.resolve(createFakeBindings());
        await waitFor(() => expect(messaging.isStarted).toBe(true));

        messaging.stop({ forceDestroy: true });

        expect(iframe.src).toBe("about:blank");
        expect(driver().uniffiDestroy).toHaveBeenCalled();
        expect(onStop).toHaveBeenCalledWith(null);
        expect(stopMessaging).toHaveBeenCalledWith(app, ROOM_ID);
        expect(messaging.isStarted).toBe(false);
        postFromWidget({ action: "late" });
        expect(driver().handleMessageFromWidget).not.toHaveBeenCalled();
    });

    it("keeps a persistent widget running unless destruction is forced", async () => {
        vi.mocked(ActiveWidgetStore.instance.getWidgetPersistence).mockReturnValue(true);
        messaging.start(iframe);
        bindingsReady.resolve(createFakeBindings());
        await waitFor(() => expect(messaging.isStarted).toBe(true));

        messaging.stop();
        expect(messaging.isStarted).toBe(true);

        messaging.stop({ forceDestroy: true });
        expect(messaging.isStarted).toBe(false);
    });
});
