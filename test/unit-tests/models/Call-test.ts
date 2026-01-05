/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { mocked } from "jest-mock";
import { waitFor } from "jest-matrix-react";
import {
    RoomType,
    type Room,
    RoomEvent,
    MatrixEvent,
    type MatrixClient,
    type IMyDevice,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { Widget } from "matrix-widget-api";
import {
    type CallMembership,
    MatrixRTCSessionManagerEvents,
    MatrixRTCSession,
    MatrixRTCSessionEvent,
} from "matrix-js-sdk/src/matrixrtc";

import type { Mocked } from "jest-mock";
import type { ClientWidgetApi } from "matrix-widget-api";
import {
    type JitsiCallMemberContent,
    Call,
    CallEvent,
    ConnectionState,
    JitsiCall,
    ElementCall,
    ElementCallIntent,
} from "../../../src/models/Call";
import { cleanUpClientRoomAndStores, mockPlatformPeg, setUpClientRoomAndStores } from "../../test-utils";
import { WidgetMessagingStore } from "../../../src/stores/widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../../../src/stores/ActiveWidgetStore";
import { ElementWidgetActions } from "../../../src/stores/widgets/ElementWidgetActions";
import SettingsStore from "../../../src/settings/SettingsStore";
import { Anonymity, PosthogAnalytics } from "../../../src/PosthogAnalytics";
import { type SettingKey } from "../../../src/settings/Settings.tsx";
import SdkConfig from "../../../src/SdkConfig.ts";
import DMRoomMap from "../../../src/utils/DMRoomMap.ts";
import { WidgetMessagingEvent, type WidgetMessaging } from "../../../src/stores/widgets/WidgetMessaging.ts";

const setUpWidget = (
    call: Call,
): { widget: Widget; messaging: Mocked<WidgetMessaging>; widgetApi: Mocked<ClientWidgetApi> } => {
    call.widget.data = { ...call.widget, skipLobby: true };
    const widget = new Widget(call.widget);

    const widgetApi = new (class extends EventEmitter {
        transport = {
            send: jest.fn(),
            reply: jest.fn(),
        };
    })() as unknown as Mocked<ClientWidgetApi>;
    const messaging = new (class extends EventEmitter {
        stop = jest.fn();
        widgetApi = widgetApi;
    })() as unknown as Mocked<WidgetMessaging>;
    WidgetMessagingStore.instance.storeMessaging(widget, call.roomId, messaging);

    return { widget, messaging, widgetApi };
};

async function connect(call: Call, widgetApi: Mocked<ClientWidgetApi>, startWidget = true): Promise<void> {
    async function sessionConnect() {
        await new Promise<void>((r) => {
            setTimeout(() => r(), 400);
        });
        widgetApi.emit(`action:${ElementWidgetActions.JoinCall}`, new CustomEvent("widgetapirequest", {}));
    }
    async function runTimers() {
        jest.advanceTimersByTime(500);
        jest.advanceTimersByTime(500);
    }
    sessionConnect();
    await Promise.all([...(startWidget ? [call.start()] : []), runTimers()]);
}

async function disconnect(call: Call, widgetApi: Mocked<ClientWidgetApi>): Promise<void> {
    async function sessionDisconnect() {
        await new Promise<void>((r) => {
            setTimeout(() => r(), 400);
        });
        widgetApi.emit(`action:${ElementWidgetActions.HangupCall}`, new CustomEvent("widgetapirequest", {}));
    }
    async function runTimers() {
        jest.advanceTimersByTime(500);
        jest.advanceTimersByTime(500);
    }
    sessionDisconnect();
    const promise = call.disconnect();
    runTimers();
    await promise;
}

const cleanUpCallAndWidget = (call: Call, widget: Widget) => {
    call.destroy();
    jest.clearAllMocks();
    WidgetMessagingStore.instance.stopMessaging(widget, call.roomId);
};

describe("JitsiCall", () => {
    mockPlatformPeg({ supportsJitsiScreensharing: () => true });

    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let bob: RoomMember;
    let carol: RoomMember;

    beforeEach(() => {
        ({ client, room, alice, bob, carol } = setUpClientRoomAndStores());
        jest.spyOn(room, "getType").mockReturnValue(RoomType.ElementVideo);
    });

    afterEach(() => cleanUpClientRoomAndStores(client, room));

    describe("get", () => {
        it("finds no calls", () => {
            expect(Call.get(room)).toBeNull();
        });

        it("finds calls", async () => {
            await JitsiCall.create(room);
            expect(Call.get(room)).toBeInstanceOf(JitsiCall);
        });

        it("ignores terminated calls", async () => {
            await JitsiCall.create(room);

            // Terminate the call
            const [event] = room.currentState.getStateEvents("im.vector.modular.widgets");
            await client.sendStateEvent(room.roomId, "im.vector.modular.widgets", {}, event.getStateKey()!);

            expect(Call.get(room)).toBeNull();
        });
    });

    describe("instance in a video room", () => {
        let call: JitsiCall;
        let widget: Widget;
        let messaging: Mocked<WidgetMessaging>;
        let widgetApi: Mocked<ClientWidgetApi>;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            await JitsiCall.create(room);
            const maybeCall = JitsiCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, messaging, widgetApi } = setUpWidget(call));

            mocked(widgetApi.transport).send.mockImplementation(async (action, data): Promise<any> => {
                if (action === ElementWidgetActions.JoinCall) {
                    widgetApi.emit(
                        `action:${ElementWidgetActions.JoinCall}`,
                        new CustomEvent("widgetapirequest", { detail: { data } }),
                    );
                } else if (action === ElementWidgetActions.HangupCall) {
                    widgetApi.emit(
                        `action:${ElementWidgetActions.HangupCall}`,
                        new CustomEvent("widgetapirequest", { detail: { data } }),
                    );
                }
                return {};
            });
        });

        afterEach(() => cleanUpCallAndWidget(call, widget));

        it("connects", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("waits for messaging when starting", async () => {
            // Temporarily remove the messaging to simulate connecting while the
            // widget is still initializing
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            const startup = call.start();
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);
            await startup;
            await connect(call, widgetApi, false);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("fails to disconnect if the widget returns an error", async () => {
            await connect(call, widgetApi);
            mocked(widgetApi.transport).send.mockRejectedValue(new Error("never!"));
            await expect(call.disconnect()).rejects.toBeDefined();
        });

        it("handles remote disconnection", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);

            const callback = jest.fn();

            call.on(CallEvent.ConnectionState, callback);

            widgetApi.emit(`action:${ElementWidgetActions.HangupCall}`, new CustomEvent("widgetapirequest", {}));
            await waitFor(() => {
                expect(callback).toHaveBeenNthCalledWith(1, ConnectionState.Disconnected, ConnectionState.Connected);
            });
            // in video rooms we expect the call to immediately reconnect
            call.off(CallEvent.ConnectionState, callback);
        });

        it("disconnects", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await call.disconnect();
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("disconnects when we leave the room", async () => {
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Leave);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("reconnects after disconnect in video rooms", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await call.disconnect();
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("remains connected if we stay in the room", async () => {
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Join);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("tracks participants in room state", async () => {
            expect(call.participants).toEqual(new Map());

            // A participant with multiple devices (should only show up once)
            await client.sendStateEvent(
                room.roomId,
                JitsiCall.MEMBER_EVENT_TYPE,
                { devices: ["bobweb", "bobdesktop"], expires_ts: 1000 * 60 * 10 },
                bob.userId,
            );
            // A participant with an expired device (should not show up)
            await client.sendStateEvent(
                room.roomId,
                JitsiCall.MEMBER_EVENT_TYPE,
                { devices: ["carolandroid"], expires_ts: -1000 * 60 },
                carol.userId,
            );

            // Now, stub out client.sendStateEvent so we can test our local echo
            client.sendStateEvent.mockReset();
            await connect(call, widgetApi);
            expect(call.participants).toEqual(
                new Map([
                    [alice, new Set(["alices_device"])],
                    [bob, new Set(["bobweb", "bobdesktop"])],
                ]),
            );

            await call.disconnect();
            expect(call.participants).toEqual(new Map([[bob, new Set(["bobweb", "bobdesktop"])]]));
        });

        it("updates room state when connecting and disconnecting", async () => {
            await connect(call, widgetApi);
            const now1 = Date.now();
            await waitFor(
                () =>
                    expect(
                        room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE, alice.userId)?.getContent(),
                    ).toEqual({
                        devices: [client.getDeviceId()],
                        expires_ts: now1 + call.STUCK_DEVICE_TIMEOUT_MS,
                    }),
                { interval: 5 },
            );

            const now2 = Date.now();
            await call.disconnect();
            await waitFor(
                () =>
                    expect(
                        room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE, alice.userId)?.getContent(),
                    ).toEqual({
                        devices: [],
                        expires_ts: now2 + call.STUCK_DEVICE_TIMEOUT_MS,
                    }),
                { interval: 5 },
            );
        });

        it("repeatedly updates room state while connected", async () => {
            await connect(call, widgetApi);
            await waitFor(
                () =>
                    expect(client.sendStateEvent).toHaveBeenLastCalledWith(
                        room.roomId,
                        JitsiCall.MEMBER_EVENT_TYPE,
                        { devices: [client.getDeviceId()], expires_ts: expect.any(Number) },
                        alice.userId,
                    ),
                { interval: 5 },
            );

            client.sendStateEvent.mockClear();
            jest.advanceTimersByTime(call.STUCK_DEVICE_TIMEOUT_MS);
            await waitFor(
                () =>
                    expect(client.sendStateEvent).toHaveBeenLastCalledWith(
                        room.roomId,
                        JitsiCall.MEMBER_EVENT_TYPE,
                        { devices: [client.getDeviceId()], expires_ts: expect.any(Number) },
                        alice.userId,
                    ),
                { interval: 5 },
            );
        });

        it("emits events when connection state changes", async () => {
            const onConnectionState = jest.fn();
            call.on(CallEvent.ConnectionState, onConnectionState);

            await connect(call, widgetApi);
            await call.disconnect();
            expect(onConnectionState.mock.calls).toEqual([
                [ConnectionState.Connected, ConnectionState.Disconnected],
                [ConnectionState.Disconnecting, ConnectionState.Connected],
                [ConnectionState.Disconnected, ConnectionState.Disconnecting],
            ]);

            call.off(CallEvent.ConnectionState, onConnectionState);
        });

        it("emits events when participants change", async () => {
            const onParticipants = jest.fn();
            call.on(CallEvent.Participants, onParticipants);

            await connect(call, widgetApi);
            await call.disconnect();
            expect(onParticipants.mock.calls).toEqual([
                [new Map([[alice, new Set(["alices_device"])]]), new Map()],
                [new Map([[alice, new Set(["alices_device"])]]), new Map([[alice, new Set(["alices_device"])]])],
                [new Map(), new Map([[alice, new Set(["alices_device"])]])],
                [new Map(), new Map()],
            ]);

            call.off(CallEvent.Participants, onParticipants);
        });

        it("switches to spotlight layout when the widget becomes a PiP", async () => {
            await connect(call, widgetApi);
            ActiveWidgetStore.instance.emit(ActiveWidgetStoreEvent.Undock);
            expect(widgetApi.transport.send).toHaveBeenCalledWith(ElementWidgetActions.SpotlightLayout, {});
            ActiveWidgetStore.instance.emit(ActiveWidgetStoreEvent.Dock);
            expect(widgetApi.transport.send).toHaveBeenCalledWith(ElementWidgetActions.TileLayout, {});
        });

        describe("clean", () => {
            const aliceWeb: IMyDevice = {
                device_id: "aliceweb",
                last_seen_ts: 0,
            };
            const aliceDesktop: IMyDevice = {
                device_id: "alicedesktop",
                last_seen_ts: 0,
            };
            const aliceDesktopOffline: IMyDevice = {
                device_id: "alicedesktopoffline",
                last_seen_ts: 1000 * 60 * 60 * -2, // 2 hours ago
            };
            const aliceDesktopNeverOnline: IMyDevice = {
                device_id: "alicedesktopneveronline",
            };

            const mkContent = (devices: IMyDevice[]): JitsiCallMemberContent => ({
                expires_ts: 1000 * 60 * 10,
                devices: devices.map((d) => d.device_id),
            });
            const expectDevices = (devices: IMyDevice[]) =>
                expect(
                    room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE, alice.userId)?.getContent(),
                ).toEqual({
                    expires_ts: expect.any(Number),
                    devices: devices.map((d) => d.device_id),
                });

            beforeEach(() => {
                client.getDeviceId.mockReturnValue(aliceWeb.device_id);
                client.getDevices.mockResolvedValue({
                    devices: [aliceWeb, aliceDesktop, aliceDesktopOffline, aliceDesktopNeverOnline],
                });
            });

            it("doesn't clean up valid devices", async () => {
                await connect(call, widgetApi);
                await client.sendStateEvent(
                    room.roomId,
                    JitsiCall.MEMBER_EVENT_TYPE,
                    mkContent([aliceWeb, aliceDesktop]),
                    alice.userId,
                );

                await call.clean();
                expectDevices([aliceWeb, aliceDesktop]);
            });

            it("cleans up our own device if we're disconnected", async () => {
                await client.sendStateEvent(
                    room.roomId,
                    JitsiCall.MEMBER_EVENT_TYPE,
                    mkContent([aliceWeb, aliceDesktop]),
                    alice.userId,
                );

                await call.clean();
                expectDevices([aliceDesktop]);
            });

            it("cleans up devices that have been offline for too long", async () => {
                await client.sendStateEvent(
                    room.roomId,
                    JitsiCall.MEMBER_EVENT_TYPE,
                    mkContent([aliceDesktop, aliceDesktopOffline]),
                    alice.userId,
                );

                await call.clean();
                expectDevices([aliceDesktop]);
            });

            it("cleans up devices that have never been online", async () => {
                await client.sendStateEvent(
                    room.roomId,
                    JitsiCall.MEMBER_EVENT_TYPE,
                    mkContent([aliceDesktop, aliceDesktopNeverOnline]),
                    alice.userId,
                );

                await call.clean();
                expectDevices([aliceDesktop]);
            });

            it("no-ops if there are no state events", async () => {
                await call.clean();
                expect(room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE, alice.userId)).toBe(null);
            });
        });
    });
});

describe("ElementCall", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let roomSession: Mocked<MatrixRTCSession>;
    function setRoomMembers(memberIds: string[]) {
        jest.spyOn(room, "getJoinedMembers").mockReturnValue(memberIds.map((id) => ({ userId: id }) as RoomMember));
    }

    beforeEach(() => {
        jest.useFakeTimers();
        ({ client, room, alice, roomSession } = setUpClientRoomAndStores());
        SdkConfig.reset();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        cleanUpClientRoomAndStores(client, room);
    });

    describe("get", () => {
        let getUserIdForRoomIdSpy: jest.SpyInstance;

        beforeEach(() => {
            getUserIdForRoomIdSpy = jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId");
        });

        afterEach(() => {
            Call.get(room)?.destroy();
            getUserIdForRoomIdSpy.mockRestore();
        });

        it("finds no calls", () => {
            expect(Call.get(room)).toBeNull();
        });

        it("finds calls", async () => {
            ElementCall.create(room);
            expect(Call.get(room)).toBeInstanceOf(ElementCall);
        });

        it("should use element call URL from developer settings if present", async () => {
            const originalGetValue = SettingsStore.getValue;
            SettingsStore.getValue = (name: SettingKey, roomId: string | null = null, excludeDefault = false): any => {
                if (name === "Developer.elementCallUrl") {
                    return "https://call.element.dev";
                }
                return excludeDefault
                    ? originalGetValue(name, roomId, excludeDefault)
                    : originalGetValue(name, roomId, excludeDefault);
            };
            await ElementCall.create(room);
            const call = ElementCall.get(room);
            expect(call?.widget.url.startsWith("https://call.element.dev/")).toBeTruthy();
            SettingsStore.getValue = originalGetValue;
        });

        it("finds ongoing calls that are created by the session manager", async () => {
            // There is an existing session created by another user in this room.
            roomSession.memberships.push({} as CallMembership);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");
        });

        it("passes font settings through widget URL", async () => {
            const originalGetValue = SettingsStore.getValue;
            SettingsStore.getValue = (name: SettingKey, roomId: string | null = null, excludeDefault = false): any => {
                switch (name) {
                    case "fontSizeDelta":
                        return 4;
                    case "useSystemFont":
                        return true;
                    case "systemFont":
                        return "OpenDyslexic, DejaVu Sans";
                    default:
                        return excludeDefault
                            ? originalGetValue(name, roomId, excludeDefault)
                            : originalGetValue(name, roomId, excludeDefault);
                }
            };
            document.documentElement.style.fontSize = "12px";

            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("fontScale")).toBe("1.5");
            expect(urlParams.getAll("font")).toEqual(["OpenDyslexic", "DejaVu Sans"]);

            SettingsStore.getValue = originalGetValue;
        });

        describe("Echo cancellation & Noise Suppression", () => {
            it("passes echo cancellation settings through widget URL if needed", async () => {
                const originalGetValue = SettingsStore.getValue;
                SettingsStore.getValue = (
                    name: SettingKey,
                    roomId: string | null = null,
                    excludeDefault = false,
                ): any => {
                    switch (name) {
                        case "webrtc_audio_echoCancellation":
                            return false;
                    }
                };
                ElementCall.create(room);
                const call = Call.get(room);
                if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

                const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
                expect(urlParams.get("echoCancellation")).toBe("false");

                SettingsStore.getValue = originalGetValue;
            });

            it("does not pass echo cancellation settings through widget URL if not needed", async () => {
                const originalGetValue = SettingsStore.getValue;
                SettingsStore.getValue = (
                    name: SettingKey,
                    roomId: string | null = null,
                    excludeDefault = false,
                ): any => {
                    switch (name) {
                        case "webrtc_audio_echoCancellation":
                            return true;
                    }
                };
                ElementCall.create(room);
                const call = Call.get(room);
                if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

                const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
                expect(urlParams.get("echoCancellation")).toBeNull();

                SettingsStore.getValue = originalGetValue;
            });

            it("passes noise suppression settings through widget URL if needed", async () => {
                const originalGetValue = SettingsStore.getValue;
                SettingsStore.getValue = (
                    name: SettingKey,
                    roomId: string | null = null,
                    excludeDefault = false,
                ): any => {
                    switch (name) {
                        case "webrtc_audio_noiseSuppression":
                            return false;
                    }
                };
                ElementCall.create(room);
                const call = Call.get(room);
                if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

                const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
                expect(urlParams.get("noiseSuppression")).toBe("false");

                SettingsStore.getValue = originalGetValue;
            });

            it("does not pass noise suppression settings through widget URL if not needed", async () => {
                const originalGetValue = SettingsStore.getValue;
                SettingsStore.getValue = (
                    name: SettingKey,
                    roomId: string | null = null,
                    excludeDefault = false,
                ): any => {
                    switch (name) {
                        case "webrtc_audio_noiseSuppression":
                            return true;
                    }
                };
                ElementCall.create(room);
                const call = Call.get(room);
                if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

                const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
                expect(urlParams.get("noiseSuppression")).toBeNull();

                SettingsStore.getValue = originalGetValue;
            });
        });

        it("passes ICE fallback preference through widget URL", async () => {
            // Test with the preference set to false
            ElementCall.create(room);
            const call1 = Call.get(room);
            if (!(call1 instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams1 = new URLSearchParams(new URL(call1.widget.url).hash.slice(1));
            expect(urlParams1.has("allowIceFallback")).toBe(false);
            call1.destroy();

            // Now test with the preference set to true
            const originalGetValue = SettingsStore.getValue;
            SettingsStore.getValue = (name: SettingKey, roomId: string | null = null, excludeDefault = false): any => {
                switch (name) {
                    case "fallbackICEServerAllowed":
                        return true;
                    default:
                        return excludeDefault
                            ? originalGetValue(name, roomId, excludeDefault)
                            : originalGetValue(name, roomId, excludeDefault);
                }
            };

            ElementCall.create(room);
            const call2 = Call.get(room);
            if (!(call2 instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams2 = new URLSearchParams(new URL(call2.widget.url).hash.slice(1));
            expect(urlParams2.has("allowIceFallback")).toBe(true);

            SettingsStore.getValue = originalGetValue;
        });

        it("passes analyticsID and posthog params through widget URL", async () => {
            SdkConfig.put({
                posthog: {
                    api_host: "https://posthog",
                    project_api_key: "DEADBEEF",
                },
            });
            jest.spyOn(PosthogAnalytics.instance, "getAnonymity").mockReturnValue(Anonymity.Pseudonymous);
            client.getAccountData.mockImplementation((eventType: string) => {
                if (eventType === PosthogAnalytics.ANALYTICS_EVENT_TYPE) {
                    return new MatrixEvent({ content: { id: "123456789987654321", pseudonymousAnalyticsOptIn: true } });
                }
                return undefined;
            });
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("analyticsID")).toBe("123456789987654321");
            expect(urlParams.get("posthogUserId")).toBe("123456789987654321");
            expect(urlParams.get("posthogApiHost")).toBe("https://posthog");
            expect(urlParams.get("posthogApiKey")).toBe("DEADBEEF");
        });

        it("does not pass analyticsID if `pseudonymousAnalyticsOptIn` set to false", async () => {
            client.getAccountData.mockImplementation((eventType: string) => {
                if (eventType === PosthogAnalytics.ANALYTICS_EVENT_TYPE) {
                    return new MatrixEvent({
                        content: { id: "123456789987654321", pseudonymousAnalyticsOptIn: false },
                    });
                }
                return undefined;
            });
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("analyticsID")).toBeFalsy();
        });

        it("passes empty analyticsID if the id is not in the account data", async () => {
            client.getAccountData.mockImplementation((eventType: string) => {
                if (eventType === PosthogAnalytics.ANALYTICS_EVENT_TYPE) {
                    return new MatrixEvent({ content: {} });
                }
                return undefined;
            });
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("analyticsID")).toBeFalsy();
        });

        it("requests correct intent in DMs", async () => {
            getUserIdForRoomIdSpy.mockImplementation((roomId: string) =>
                room.roomId === roomId ? "any-user" : undefined,
            );
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("intent")).toBe(ElementCallIntent.StartCallDM);
        });

        it("requests correct intent when answering DMs", async () => {
            roomSession.getOldestMembership.mockReturnValue({} as CallMembership);
            getUserIdForRoomIdSpy.mockImplementation((roomId: string) =>
                room.roomId === roomId ? "any-user" : undefined,
            );
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("intent")).toBe(ElementCallIntent.JoinExistingDM);
        });

        it("requests correct intent when creating a non-DM call", async () => {
            roomSession.getOldestMembership.mockReturnValue(undefined);
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("intent")).toBe(ElementCallIntent.StartCall);
        });

        it("requests correct intent when joining a non-DM call", async () => {
            roomSession.getOldestMembership.mockReturnValue({} as CallMembership);
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("intent")).toBe(ElementCallIntent.JoinExisting);
        });
    });

    describe("instance in a non-video room", () => {
        let call: ElementCall;
        let widget: Widget;
        let messaging: Mocked<WidgetMessaging>;
        let widgetApi: Mocked<ClientWidgetApi>;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            ElementCall.create(room);
            const maybeCall = ElementCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, messaging, widgetApi } = setUpWidget(call));
        });

        afterEach(() => cleanUpCallAndWidget(call, widget));

        // TODO refactor initial device configuration to use the EW settings.
        // Add tests for passing EW device configuration to the widget.

        it("waits for messaging when starting (widget API available immediately)", async () => {
            // Temporarily remove the messaging to simulate connecting while the
            // widget is still initializing
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            const startup = call.start({});
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);
            await startup;
            await connect(call, widgetApi, false);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("waits for messaging when starting (widget API started asynchronously)", async () => {
            // Temporarily remove the messaging to simulate connecting while the
            // widget is still initializing
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            // Also remove the widget API from said messaging until later
            let storedWidgetApi: Mocked<ClientWidgetApi> | null = null;
            Object.defineProperty(messaging, "widgetApi", {
                get() {
                    return storedWidgetApi;
                },
            });
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            const startup = call.start({});
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);
            // Yield the event loop to the Call.start promise, then simulate the
            // widget API being started asynchronously
            await Promise.resolve();
            storedWidgetApi = widgetApi;
            messaging.emit(WidgetMessagingEvent.Start, storedWidgetApi);
            await startup;
            await connect(call, widgetApi, false);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("waits for messaging when starting (even if messaging is replaced during startup)", async () => {
            const firstMessaging = messaging;
            // Entirely remove the widget API from this first messaging
            Object.defineProperty(firstMessaging, "widgetApi", {
                get() {
                    return null;
                },
            });
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            const startup = call.start({});
            // Now imagine that the messaging gets abandoned and replaced by an
            // entirely new messaging object
            ({ widget, messaging, widgetApi } = setUpWidget(call));
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);
            await startup;
            await connect(call, widgetApi, false);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            expect(firstMessaging.listenerCount(WidgetMessagingEvent.Start)).toBe(0); // No leaks
        });

        it("fails to disconnect if the widget returns an error", async () => {
            await connect(call, widgetApi);
            mocked(widgetApi.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.disconnect()).rejects.toBeDefined();
        });

        it("handles remote disconnection", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);

            widgetApi.emit(`action:${ElementWidgetActions.HangupCall}`, new CustomEvent("widgetapirequest", {}));
            widgetApi.emit(`action:${ElementWidgetActions.Close}`, new CustomEvent("widgetapirequest", {}));
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Disconnected), { interval: 5 });
        });

        it("disconnects", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await disconnect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("disconnects when we leave the room", async () => {
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Leave);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("remains connected if we stay in the room", async () => {
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Join);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("disconnects if the widget dies", async () => {
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("acknowledges mute_device widget action", async () => {
            await connect(call, widgetApi);
            const preventDefault = jest.fn();
            const mockEv = {
                preventDefault,
                detail: { video_enabled: false },
            };
            widgetApi.emit(`action:${ElementWidgetActions.DeviceMute}`, mockEv);
            expect(widgetApi.transport.reply).toHaveBeenCalledWith({ video_enabled: false }, {});
            expect(preventDefault).toHaveBeenCalled();
        });

        it("emits events when connection state changes", async () => {
            // const wait = jest.spyOn(CallModule, "waitForEvent");
            const onConnectionState = jest.fn();
            call.on(CallEvent.ConnectionState, onConnectionState);

            await connect(call, widgetApi);
            await disconnect(call, widgetApi);
            expect(onConnectionState.mock.calls).toEqual([
                [ConnectionState.Connected, ConnectionState.Disconnected],
                [ConnectionState.Disconnecting, ConnectionState.Connected],
                [ConnectionState.Disconnected, ConnectionState.Disconnecting],
            ]);

            call.off(CallEvent.ConnectionState, onConnectionState);
        });

        it("emits events when participants change", async () => {
            const onParticipants = jest.fn();
            call.session.memberships = [{ sender: alice.userId, deviceId: "alices_device" } as CallMembership];
            call.on(CallEvent.Participants, onParticipants);
            call.session.emit(MatrixRTCSessionEvent.MembershipsChanged, [], []);

            expect(onParticipants.mock.calls).toEqual([[new Map([[alice, new Set(["alices_device"])]]), new Map()]]);

            call.off(CallEvent.Participants, onParticipants);
        });

        it("ends the call immediately if the session ended", async () => {
            await connect(call, widgetApi);
            const onDestroy = jest.fn();
            call.on(CallEvent.Destroy, onDestroy);
            await disconnect(call, widgetApi);
            // this will be called automatically
            // disconnect -> widget sends state event -> session manager notices no-one left
            client.matrixRTC.emit(
                MatrixRTCSessionManagerEvents.SessionEnded,
                room.roomId,
                {} as unknown as MatrixRTCSession,
            );
            expect(onDestroy).toHaveBeenCalled();
            call.off(CallEvent.Destroy, onDestroy);
        });

        it("clears widget persistence when destroyed", async () => {
            const destroyPersistentWidgetSpy = jest.spyOn(ActiveWidgetStore.instance, "destroyPersistentWidget");
            call.destroy();
            expect(destroyPersistentWidgetSpy).toHaveBeenCalled();
        });
    });

    describe("instance in a video room", () => {
        let call: ElementCall;
        let widget: Widget;
        let widgetApi: Mocked<ClientWidgetApi>;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            jest.spyOn(room, "getType").mockReturnValue(RoomType.UnstableCall);

            ElementCall.create(room);
            const maybeCall = ElementCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, widgetApi } = setUpWidget(call));
        });

        afterEach(() => cleanUpCallAndWidget(call, widget));

        it("doesn't end the call when the last participant leaves", async () => {
            await connect(call, widgetApi);
            const onDestroy = jest.fn();
            call.on(CallEvent.Destroy, onDestroy);
            await disconnect(call, widgetApi);
            expect(onDestroy).not.toHaveBeenCalled();
            call.off(CallEvent.Destroy, onDestroy);
        });

        it("handles remote disconnection and reconnect right after", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, widgetApi);
            expect(call.connectionState).toBe(ConnectionState.Connected);

            widgetApi.emit(`action:${ElementWidgetActions.HangupCall}`, new CustomEvent("widgetapirequest", {}));
            // We should now be able to reconnect without manually starting the widget
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, widgetApi, false);
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Connected), { interval: 5 });
        });
    });
    describe("create call", () => {
        beforeEach(async () => {
            setRoomMembers(["@user:example.com", "@user2:example.com", "@user4:example.com"]);
        });
        it("don't sent notify event if there are existing room call members", async () => {
            jest.spyOn(MatrixRTCSession, "callMembershipsForRoom").mockReturnValue([
                { application: "m.call", callId: "" } as unknown as CallMembership,
            ]);
            const sendEventSpy = jest.spyOn(room.client, "sendEvent");
            ElementCall.create(room);
            expect(sendEventSpy).not.toHaveBeenCalled();
        });
    });
});
