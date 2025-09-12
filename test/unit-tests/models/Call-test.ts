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
    Room,
    RoomEvent,
    MatrixEvent,
    RoomStateEvent,
    PendingEventOrdering,
    type IContent,
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
import {
    stubClient,
    mkEvent,
    mkRoomMember,
    setupAsyncStoreWithClient,
    mockPlatformPeg,
    MockEventEmitter,
} from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import WidgetStore from "../../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../../src/stores/widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../../../src/stores/ActiveWidgetStore";
import { ElementWidgetActions } from "../../../src/stores/widgets/ElementWidgetActions";
import SettingsStore from "../../../src/settings/SettingsStore";
import { Anonymity, PosthogAnalytics } from "../../../src/PosthogAnalytics";
import { type SettingKey } from "../../../src/settings/Settings.tsx";
import SdkConfig from "../../../src/SdkConfig.ts";
import DMRoomMap from "../../../src/utils/DMRoomMap.ts";

const enabledSettings = new Set(["feature_group_calls", "feature_video_rooms", "feature_element_call_video_rooms"]);
jest.spyOn(SettingsStore, "getValue").mockImplementation(
    (settingName): any => enabledSettings.has(settingName) || undefined,
);

const setUpClientRoomAndStores = (): {
    client: Mocked<MatrixClient>;
    room: Room;
    alice: RoomMember;
    bob: RoomMember;
    carol: RoomMember;
    roomSession: Mocked<MatrixRTCSession>;
} => {
    stubClient();
    const client = mocked<MatrixClient>(MatrixClientPeg.safeGet());
    DMRoomMap.makeShared(client);

    const room = new Room("!1:example.org", client, "@alice:example.org", {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });

    const alice = mkRoomMember(room.roomId, "@alice:example.org");
    const bob = mkRoomMember(room.roomId, "@bob:example.org");
    const carol = mkRoomMember(room.roomId, "@carol:example.org");
    jest.spyOn(room, "getMember").mockImplementation((userId) => {
        switch (userId) {
            case alice.userId:
                return alice;
            case bob.userId:
                return bob;
            case carol.userId:
                return carol;
            default:
                return null;
        }
    });

    jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);

    client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));

    const roomSession = new MockEventEmitter({
        memberships: [],
        getOldestMembership: jest.fn().mockReturnValue(undefined),
    }) as Mocked<MatrixRTCSession>;

    client.matrixRTC.getRoomSession.mockReturnValue(roomSession);
    client.getRooms.mockReturnValue([room]);
    client.getUserId.mockReturnValue(alice.userId);
    client.getDeviceId.mockReturnValue("alices_device");
    client.reEmitter.reEmit(room, [RoomStateEvent.Events]);
    client.sendStateEvent.mockImplementation(async (roomId, eventType, content, stateKey = "") => {
        if (roomId !== room.roomId) throw new Error("Unknown room");
        const event = mkEvent({
            event: true,
            type: eventType,
            room: roomId,
            user: alice.userId,
            skey: stateKey,
            content: content as IContent,
        });
        room.addLiveEvents([event], { addToState: true });
        return { event_id: event.getId()! };
    });

    setupAsyncStoreWithClient(WidgetStore.instance, client);
    setupAsyncStoreWithClient(WidgetMessagingStore.instance, client);

    return { client, room, alice, bob, carol, roomSession };
};

const cleanUpClientRoomAndStores = (client: MatrixClient, room: Room) => {
    client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
};

const setUpWidget = (call: Call): { widget: Widget; messaging: Mocked<ClientWidgetApi> } => {
    call.widget.data = { ...call.widget, skipLobby: true };
    const widget = new Widget(call.widget);

    const eventEmitter = new EventEmitter();
    const messaging = {
        on: eventEmitter.on.bind(eventEmitter),
        off: eventEmitter.off.bind(eventEmitter),
        once: eventEmitter.once.bind(eventEmitter),
        emit: eventEmitter.emit.bind(eventEmitter),
        stop: jest.fn(),
        transport: {
            send: jest.fn(),
            reply: jest.fn(),
        },
    } as unknown as Mocked<ClientWidgetApi>;
    WidgetMessagingStore.instance.storeMessaging(widget, call.roomId, messaging);

    return { widget, messaging };
};

async function connect(call: Call, messaging: Mocked<ClientWidgetApi>, startWidget = true): Promise<void> {
    async function sessionConnect() {
        await new Promise<void>((r) => {
            setTimeout(() => r(), 400);
        });
        messaging.emit(`action:${ElementWidgetActions.JoinCall}`, new CustomEvent("widgetapirequest", {}));
    }
    async function runTimers() {
        jest.advanceTimersByTime(500);
        jest.advanceTimersByTime(500);
    }
    sessionConnect();
    await Promise.all([...(startWidget ? [call.start()] : []), runTimers()]);
}

async function disconnect(call: Call, messaging: Mocked<ClientWidgetApi>): Promise<void> {
    async function sessionDisconnect() {
        await new Promise<void>((r) => {
            setTimeout(() => r(), 400);
        });
        messaging.emit(`action:${ElementWidgetActions.HangupCall}`, new CustomEvent("widgetapirequest", {}));
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
        let messaging: Mocked<ClientWidgetApi>;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            await JitsiCall.create(room);
            const maybeCall = JitsiCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, messaging } = setUpWidget(call));

            mocked(messaging.transport).send.mockImplementation(async (action, data): Promise<any> => {
                if (action === ElementWidgetActions.JoinCall) {
                    messaging.emit(
                        `action:${ElementWidgetActions.JoinCall}`,
                        new CustomEvent("widgetapirequest", { detail: { data } }),
                    );
                } else if (action === ElementWidgetActions.HangupCall) {
                    messaging.emit(
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
            await connect(call, messaging);
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
            await connect(call, messaging, false);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("fails to disconnect if the widget returns an error", async () => {
            await connect(call, messaging);
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!"));
            await expect(call.disconnect()).rejects.toBeDefined();
        });

        it("handles remote disconnection", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);

            const callback = jest.fn();

            call.on(CallEvent.ConnectionState, callback);

            messaging.emit(`action:${ElementWidgetActions.HangupCall}`, new CustomEvent("widgetapirequest", {}));
            await waitFor(() => {
                expect(callback).toHaveBeenNthCalledWith(1, ConnectionState.Disconnected, ConnectionState.Connected);
            });
            // in video rooms we expect the call to immediately reconnect
            call.off(CallEvent.ConnectionState, callback);
        });

        it("disconnects", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await call.disconnect();
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("disconnects when we leave the room", async () => {
            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Leave);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("reconnects after disconnect in video rooms", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await call.disconnect();
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("remains connected if we stay in the room", async () => {
            await connect(call, messaging);
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
            await connect(call, messaging);
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
            await connect(call, messaging);
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
            await connect(call, messaging);
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

            await connect(call, messaging);
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

            await connect(call, messaging);
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
            await connect(call, messaging);
            ActiveWidgetStore.instance.emit(ActiveWidgetStoreEvent.Undock);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.SpotlightLayout, {});
            ActiveWidgetStore.instance.emit(ActiveWidgetStoreEvent.Dock);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.TileLayout, {});
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
                await connect(call, messaging);
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

        it("passes feature_allow_screen_share_only_mode setting to allowVoipWithNoMedia url param", async () => {
            // Now test with the preference set to true
            const originalGetValue = SettingsStore.getValue;
            SettingsStore.getValue = (name: SettingKey, roomId: string | null = null, excludeDefault = false): any => {
                switch (name) {
                    case "feature_allow_screen_share_only_mode":
                        return true;
                    default:
                        return excludeDefault
                            ? originalGetValue(name, roomId, excludeDefault)
                            : originalGetValue(name, roomId, excludeDefault);
                }
            };
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("allowVoipWithNoMedia")).toBe("true");
            SettingsStore.getValue = originalGetValue;
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

        it("requests ringing notifications and correct intent in DMs", async () => {
            getUserIdForRoomIdSpy.mockImplementation((roomId: string) =>
                room.roomId === roomId ? "any-user" : undefined,
            );
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("sendNotificationType")).toBe("ring");
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

        it("requests visual notifications in non-DMs", async () => {
            ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("sendNotificationType")).toBe("notification");
        });
    });

    describe("instance in a non-video room", () => {
        let call: ElementCall;
        let widget: Widget;
        let messaging: Mocked<ClientWidgetApi>;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            ElementCall.create(room, true);
            const maybeCall = ElementCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, messaging } = setUpWidget(call));
        });

        afterEach(() => cleanUpCallAndWidget(call, widget));
        // TODO refactor initial device configuration to use the EW settings.
        // Add tests for passing EW device configuration to the widget.
        it("waits for messaging when starting", async () => {
            // Temporarily remove the messaging to simulate connecting while the
            // widget is still initializing

            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            const startup = call.start();
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);
            await startup;
            await connect(call, messaging, false);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("fails to disconnect if the widget returns an error", async () => {
            await connect(call, messaging);
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.disconnect()).rejects.toBeDefined();
        });

        it("handles remote disconnection", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);

            messaging.emit(`action:${ElementWidgetActions.HangupCall}`, new CustomEvent("widgetapirequest", {}));
            messaging.emit(`action:${ElementWidgetActions.Close}`, new CustomEvent("widgetapirequest", {}));
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Disconnected), { interval: 5 });
        });

        it("disconnects", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await disconnect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("disconnects when we leave the room", async () => {
            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Leave);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("remains connected if we stay in the room", async () => {
            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Join);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("disconnects if the widget dies", async () => {
            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("acknowledges mute_device widget action", async () => {
            await connect(call, messaging);
            const preventDefault = jest.fn();
            const mockEv = {
                preventDefault,
                detail: { video_enabled: false },
            };
            messaging.emit(`action:${ElementWidgetActions.DeviceMute}`, mockEv);
            expect(messaging.transport.reply).toHaveBeenCalledWith({ video_enabled: false }, {});
            expect(preventDefault).toHaveBeenCalled();
        });

        it("emits events when connection state changes", async () => {
            // const wait = jest.spyOn(CallModule, "waitForEvent");
            const onConnectionState = jest.fn();
            call.on(CallEvent.ConnectionState, onConnectionState);

            await connect(call, messaging);
            await disconnect(call, messaging);
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
            await connect(call, messaging);
            const onDestroy = jest.fn();
            call.on(CallEvent.Destroy, onDestroy);
            await disconnect(call, messaging);
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

        it("the perParticipantE2EE url flag is used in encrypted rooms while respecting the feature_disable_call_per_sender_encryption flag", async () => {
            // We destroy the call created in beforeEach because we test the call creation process.
            call.destroy();
            const addWidgetSpy = jest.spyOn(WidgetStore.instance, "addVirtualWidget");
            // If a room is not encrypted we will never add the perParticipantE2EE flag.
            const roomSpy = jest.spyOn(room, "hasEncryptionStateEvent").mockReturnValue(true);

            // should create call with perParticipantE2EE flag
            ElementCall.create(room);
            expect(Call.get(room)?.widget?.data?.perParticipantE2EE).toBe(true);

            // should create call without perParticipantE2EE flag
            enabledSettings.add("feature_disable_call_per_sender_encryption");
            expect(Call.get(room)?.widget?.data?.perParticipantE2EE).toBe(false);
            enabledSettings.delete("feature_disable_call_per_sender_encryption");
            roomSpy.mockRestore();
            addWidgetSpy.mockRestore();
        });
    });

    describe("instance in a video room", () => {
        let call: ElementCall;
        let widget: Widget;
        let messaging: Mocked<ClientWidgetApi>;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            jest.spyOn(room, "getType").mockReturnValue(RoomType.UnstableCall);

            ElementCall.create(room);
            const maybeCall = ElementCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, messaging } = setUpWidget(call));
        });

        afterEach(() => cleanUpCallAndWidget(call, widget));

        it("doesn't end the call when the last participant leaves", async () => {
            await connect(call, messaging);
            const onDestroy = jest.fn();
            call.on(CallEvent.Destroy, onDestroy);
            await disconnect(call, messaging);
            expect(onDestroy).not.toHaveBeenCalled();
            call.off(CallEvent.Destroy, onDestroy);
        });

        it("handles remote disconnection and reconnect right after", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, messaging);
            expect(call.connectionState).toBe(ConnectionState.Connected);

            messaging.emit(`action:${ElementWidgetActions.HangupCall}`, new CustomEvent("widgetapirequest", {}));
            // We should now be able to reconnect without manually starting the widget
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await connect(call, messaging, false);
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
