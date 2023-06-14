/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import EventEmitter from "events";
import { mocked } from "jest-mock";
import { waitFor } from "@testing-library/react";
import { RoomType } from "matrix-js-sdk/src/@types/event";
import { PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { Widget } from "matrix-widget-api";
import { GroupCallIntent } from "matrix-js-sdk/src/webrtc/groupCall";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import type { Mocked } from "jest-mock";
import type { MatrixClient, IMyDevice } from "matrix-js-sdk/src/client";
import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import type { ClientWidgetApi } from "matrix-widget-api";
import { JitsiCallMemberContent, Layout } from "../../src/models/Call";
import { stubClient, mkEvent, mkRoomMember, setupAsyncStoreWithClient, mockPlatformPeg } from "../test-utils";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../src/MediaDeviceHandler";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { Call, CallEvent, ConnectionState, JitsiCall, ElementCall } from "../../src/models/Call";
import WidgetStore from "../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../src/stores/widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../../src/stores/ActiveWidgetStore";
import { ElementWidgetActions } from "../../src/stores/widgets/ElementWidgetActions";
import SettingsStore from "../../src/settings/SettingsStore";
import Modal, { IHandle } from "../../src/Modal";
import PlatformPeg from "../../src/PlatformPeg";
import { PosthogAnalytics } from "../../src/PosthogAnalytics";

jest.spyOn(MediaDeviceHandler, "getDevices").mockResolvedValue({
    [MediaDeviceKindEnum.AudioInput]: [
        { deviceId: "1", groupId: "1", kind: "audioinput", label: "Headphones", toJSON: () => {} },
    ],
    [MediaDeviceKindEnum.VideoInput]: [
        { deviceId: "2", groupId: "2", kind: "videoinput", label: "Built-in webcam", toJSON: () => {} },
    ],
    [MediaDeviceKindEnum.AudioOutput]: [],
});
jest.spyOn(MediaDeviceHandler, "getAudioInput").mockReturnValue("1");
jest.spyOn(MediaDeviceHandler, "getVideoInput").mockReturnValue("2");

const enabledSettings = new Set(["feature_group_calls", "feature_video_rooms", "feature_element_call_video_rooms"]);
jest.spyOn(SettingsStore, "getValue").mockImplementation(
    (settingName) => enabledSettings.has(settingName) || undefined,
);

const setUpClientRoomAndStores = (): {
    client: Mocked<MatrixClient>;
    room: Room;
    alice: RoomMember;
    bob: RoomMember;
    carol: RoomMember;
} => {
    stubClient();
    const client = mocked<MatrixClient>(MatrixClientPeg.safeGet());

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
    jest.spyOn(room, "getMyMembership").mockReturnValue("join");

    client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
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
            content,
        });
        room.addLiveEvents([event]);
        return { event_id: event.getId()! };
    });

    setupAsyncStoreWithClient(WidgetStore.instance, client);
    setupAsyncStoreWithClient(WidgetMessagingStore.instance, client);

    return { client, room, alice, bob, carol };
};

const cleanUpClientRoomAndStores = (client: MatrixClient, room: Room) => {
    client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
};

const setUpWidget = (
    call: Call,
): {
    widget: Widget;
    messaging: Mocked<ClientWidgetApi>;
    audioMutedSpy: jest.SpyInstance<boolean, []>;
    videoMutedSpy: jest.SpyInstance<boolean, []>;
} => {
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

    const audioMutedSpy = jest.spyOn(MediaDeviceHandler, "startWithAudioMuted", "get");
    const videoMutedSpy = jest.spyOn(MediaDeviceHandler, "startWithVideoMuted", "get");

    return { widget, messaging, audioMutedSpy, videoMutedSpy };
};

const cleanUpCallAndWidget = (
    call: Call,
    widget: Widget,
    audioMutedSpy: jest.SpyInstance<boolean, []>,
    videoMutedSpy: jest.SpyInstance<boolean, []>,
) => {
    call.destroy();
    jest.clearAllMocks();
    WidgetMessagingStore.instance.stopMessaging(widget, call.roomId);
    audioMutedSpy.mockRestore();
    videoMutedSpy.mockRestore();
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
        let audioMutedSpy: jest.SpyInstance<boolean, []>;
        let videoMutedSpy: jest.SpyInstance<boolean, []>;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            await JitsiCall.create(room);
            const maybeCall = JitsiCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, messaging, audioMutedSpy, videoMutedSpy } = setUpWidget(call));

            mocked(messaging.transport).send.mockImplementation(async (action: string): Promise<any> => {
                if (action === ElementWidgetActions.JoinCall) {
                    messaging.emit(
                        `action:${ElementWidgetActions.JoinCall}`,
                        new CustomEvent("widgetapirequest", { detail: {} }),
                    );
                } else if (action === ElementWidgetActions.HangupCall) {
                    messaging.emit(
                        `action:${ElementWidgetActions.HangupCall}`,
                        new CustomEvent("widgetapirequest", { detail: {} }),
                    );
                }
                return {};
            });
        });

        afterEach(() => cleanUpCallAndWidget(call, widget, audioMutedSpy, videoMutedSpy));

        it("connects muted", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            audioMutedSpy.mockReturnValue(true);
            videoMutedSpy.mockReturnValue(true);

            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.JoinCall, {
                audioInput: null,
                videoInput: null,
            });
        });

        it("connects unmuted", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            audioMutedSpy.mockReturnValue(false);
            videoMutedSpy.mockReturnValue(false);

            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.JoinCall, {
                audioInput: "Headphones",
                videoInput: "Built-in webcam",
            });
        });

        it("waits for messaging when connecting", async () => {
            // Temporarily remove the messaging to simulate connecting while the
            // widget is still initializing
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            const connect = call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connecting);

            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);
            await connect;
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("fails to connect if the widget returns an error", async () => {
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.connect()).rejects.toBeDefined();
        });

        it("fails to disconnect if the widget returns an error", async () => {
            await call.connect();
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.disconnect()).rejects.toBeDefined();
        });

        it("handles remote disconnection", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);

            messaging.emit(
                `action:${ElementWidgetActions.HangupCall}`,
                new CustomEvent("widgetapirequest", { detail: {} }),
            );
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Disconnected), { interval: 5 });
        });

        it("handles instant remote disconnection when connecting", async () => {
            mocked(messaging.transport).send.mockImplementation(async (action): Promise<any> => {
                if (action === ElementWidgetActions.JoinCall) {
                    // Emit the hangup event *before* the join event to fully
                    // exercise the race condition
                    messaging.emit(
                        `action:${ElementWidgetActions.HangupCall}`,
                        new CustomEvent("widgetapirequest", { detail: {} }),
                    );
                    messaging.emit(
                        `action:${ElementWidgetActions.JoinCall}`,
                        new CustomEvent("widgetapirequest", { detail: {} }),
                    );
                }
                return {};
            });
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            // Should disconnect on its own almost instantly
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Disconnected), { interval: 5 });
        });

        it("disconnects", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await call.disconnect();
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("disconnects when we leave the room", async () => {
            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, "leave");
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("remains connected if we stay in the room", async () => {
            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, "join");
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
            await call.connect();
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
            const now1 = Date.now();
            await call.connect();
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
            await call.connect();
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

            await call.connect();
            await call.disconnect();
            expect(onConnectionState.mock.calls).toEqual([
                [ConnectionState.Connecting, ConnectionState.Disconnected],
                [ConnectionState.Connected, ConnectionState.Connecting],
                [ConnectionState.Disconnecting, ConnectionState.Connected],
                [ConnectionState.Disconnected, ConnectionState.Disconnecting],
            ]);

            call.off(CallEvent.ConnectionState, onConnectionState);
        });

        it("emits events when participants change", async () => {
            const onParticipants = jest.fn();
            call.on(CallEvent.Participants, onParticipants);

            await call.connect();
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
            await call.connect();
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
                await call.connect();
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
    let bob: RoomMember;
    let carol: RoomMember;

    beforeEach(() => {
        ({ client, room, alice, bob, carol } = setUpClientRoomAndStores());
    });

    afterEach(() => cleanUpClientRoomAndStores(client, room));

    describe("get", () => {
        it("finds no calls", () => {
            expect(Call.get(room)).toBeNull();
        });

        it("finds calls", async () => {
            await ElementCall.create(room);
            expect(Call.get(room)).toBeInstanceOf(ElementCall);
        });

        it("ignores terminated calls", async () => {
            await ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            // Terminate the call
            await call.groupCall.terminate();

            expect(Call.get(room)).toBeNull();
        });

        it("passes font settings through widget URL", async () => {
            const originalGetValue = SettingsStore.getValue;
            SettingsStore.getValue = <T>(name: string, roomId?: string, excludeDefault?: boolean) => {
                switch (name) {
                    case "baseFontSize":
                        return 12 as T;
                    case "useSystemFont":
                        return true as T;
                    case "systemFont":
                        return "OpenDyslexic, DejaVu Sans" as T;
                    default:
                        return originalGetValue<T>(name, roomId, excludeDefault);
                }
            };

            await ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("fontScale")).toBe("1.2");
            expect(urlParams.getAll("font")).toEqual(["OpenDyslexic", "DejaVu Sans"]);

            SettingsStore.getValue = originalGetValue;
        });

        it("passes ICE fallback preference through widget URL", async () => {
            // Test with the preference set to false
            await ElementCall.create(room);
            const call1 = Call.get(room);
            if (!(call1 instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams1 = new URLSearchParams(new URL(call1.widget.url).hash.slice(1));
            expect(urlParams1.has("allowIceFallback")).toBe(false);

            // Now test with the preference set to true
            const originalGetValue = SettingsStore.getValue;
            SettingsStore.getValue = <T>(name: string, roomId?: string, excludeDefault?: boolean) => {
                switch (name) {
                    case "fallbackICEServerAllowed":
                        return true as T;
                    default:
                        return originalGetValue<T>(name, roomId, excludeDefault);
                }
            };

            await ElementCall.create(room);
            const call2 = Call.get(room);
            if (!(call2 instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams2 = new URLSearchParams(new URL(call2.widget.url).hash.slice(1));
            expect(urlParams2.has("allowIceFallback")).toBe(true);

            SettingsStore.getValue = originalGetValue;
        });

        it("passes analyticsID through widget URL", async () => {
            client.getAccountData.mockImplementation((eventType: string) => {
                if (eventType === PosthogAnalytics.ANALYTICS_EVENT_TYPE) {
                    return new MatrixEvent({ content: { id: "123456789987654321", pseudonymousAnalyticsOptIn: true } });
                }
                return undefined;
            });
            await ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("analyticsID")).toBe("123456789987654321");
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
            await ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("analyticsID")).toBe("");
        });

        it("passes empty analyticsID if the id is not in the account data", async () => {
            client.getAccountData.mockImplementation((eventType: string) => {
                if (eventType === PosthogAnalytics.ANALYTICS_EVENT_TYPE) {
                    return new MatrixEvent({ content: {} });
                }
                return undefined;
            });
            await ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("analyticsID")).toBe("");
        });
    });

    describe("instance in a non-video room", () => {
        let call: ElementCall;
        let widget: Widget;
        let messaging: Mocked<ClientWidgetApi>;
        let audioMutedSpy: jest.SpyInstance<boolean, []>;
        let videoMutedSpy: jest.SpyInstance<boolean, []>;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            await ElementCall.create(room);
            const maybeCall = ElementCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, messaging, audioMutedSpy, videoMutedSpy } = setUpWidget(call));
        });

        afterEach(() => cleanUpCallAndWidget(call, widget, audioMutedSpy, videoMutedSpy));

        it("has prompt intent", () => {
            expect(call.groupCall.intent).toBe(GroupCallIntent.Prompt);
        });

        it("connects muted", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            audioMutedSpy.mockReturnValue(true);
            videoMutedSpy.mockReturnValue(true);

            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.JoinCall, {
                audioInput: null,
                videoInput: null,
            });
        });

        it("connects unmuted", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            audioMutedSpy.mockReturnValue(false);
            videoMutedSpy.mockReturnValue(false);

            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.JoinCall, {
                audioInput: "Headphones",
                videoInput: "Built-in webcam",
            });
        });

        it("waits for messaging when connecting", async () => {
            // Temporarily remove the messaging to simulate connecting while the
            // widget is still initializing
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            const connect = call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connecting);

            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);
            await connect;
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("fails to connect if the widget returns an error", async () => {
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.connect()).rejects.toBeDefined();
        });

        it("fails to disconnect if the widget returns an error", async () => {
            await call.connect();
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.disconnect()).rejects.toBeDefined();
        });

        it("handles remote disconnection", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);

            messaging.emit(
                `action:${ElementWidgetActions.HangupCall}`,
                new CustomEvent("widgetapirequest", { detail: {} }),
            );
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Disconnected), { interval: 5 });
        });

        it("disconnects", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await call.disconnect();
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("disconnects when we leave the room", async () => {
            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, "leave");
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("remains connected if we stay in the room", async () => {
            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, "join");
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("disconnects if the widget dies", async () => {
            await call.connect();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("tracks participants in room state", async () => {
            expect(call.participants).toEqual(new Map());

            // A participant with multiple devices (should only show up once)
            await client.sendStateEvent(
                room.roomId,
                ElementCall.MEMBER_EVENT_TYPE.name,
                {
                    "m.calls": [
                        {
                            "m.call_id": call.groupCall.groupCallId,
                            "m.devices": [
                                { device_id: "bobweb", session_id: "1", feeds: [], expires_ts: 1000 * 60 * 10 },
                                { device_id: "bobdesktop", session_id: "1", feeds: [], expires_ts: 1000 * 60 * 10 },
                            ],
                        },
                    ],
                },
                bob.userId,
            );
            // A participant with an expired device (should not show up)
            await client.sendStateEvent(
                room.roomId,
                ElementCall.MEMBER_EVENT_TYPE.name,
                {
                    "m.calls": [
                        {
                            "m.call_id": call.groupCall.groupCallId,
                            "m.devices": [
                                { device_id: "carolandroid", session_id: "1", feeds: [], expires_ts: -1000 * 60 },
                            ],
                        },
                    ],
                },
                carol.userId,
            );

            // Now, stub out client.sendStateEvent so we can test our local echo
            client.sendStateEvent.mockReset();
            await call.connect();
            expect(call.participants).toEqual(
                new Map([
                    [alice, new Set(["alices_device"])],
                    [bob, new Set(["bobweb", "bobdesktop"])],
                ]),
            );

            await call.disconnect();
            expect(call.participants).toEqual(new Map([[bob, new Set(["bobweb", "bobdesktop"])]]));
        });

        it("tracks layout", async () => {
            await call.connect();
            expect(call.layout).toBe(Layout.Tile);

            messaging.emit(
                `action:${ElementWidgetActions.SpotlightLayout}`,
                new CustomEvent("widgetapirequest", { detail: {} }),
            );
            expect(call.layout).toBe(Layout.Spotlight);

            messaging.emit(
                `action:${ElementWidgetActions.TileLayout}`,
                new CustomEvent("widgetapirequest", { detail: {} }),
            );
            expect(call.layout).toBe(Layout.Tile);
        });

        it("sets layout", async () => {
            await call.connect();

            await call.setLayout(Layout.Spotlight);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.SpotlightLayout, {});

            await call.setLayout(Layout.Tile);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.TileLayout, {});
        });

        it("emits events when connection state changes", async () => {
            const onConnectionState = jest.fn();
            call.on(CallEvent.ConnectionState, onConnectionState);

            await call.connect();
            await call.disconnect();
            expect(onConnectionState.mock.calls).toEqual([
                [ConnectionState.Connecting, ConnectionState.Disconnected],
                [ConnectionState.Connected, ConnectionState.Connecting],
                [ConnectionState.Disconnecting, ConnectionState.Connected],
                [ConnectionState.Disconnected, ConnectionState.Disconnecting],
            ]);

            call.off(CallEvent.ConnectionState, onConnectionState);
        });

        it("emits events when participants change", async () => {
            const onParticipants = jest.fn();
            call.on(CallEvent.Participants, onParticipants);

            await call.connect();
            await call.disconnect();
            expect(onParticipants.mock.calls).toEqual([
                [new Map([[alice, new Set(["alices_device"])]]), new Map()],
                [new Map(), new Map([[alice, new Set(["alices_device"])]])],
            ]);

            call.off(CallEvent.Participants, onParticipants);
        });

        it("emits events when layout changes", async () => {
            await call.connect();
            const onLayout = jest.fn();
            call.on(CallEvent.Layout, onLayout);

            messaging.emit(
                `action:${ElementWidgetActions.SpotlightLayout}`,
                new CustomEvent("widgetapirequest", { detail: {} }),
            );
            messaging.emit(
                `action:${ElementWidgetActions.TileLayout}`,
                new CustomEvent("widgetapirequest", { detail: {} }),
            );
            expect(onLayout.mock.calls).toEqual([[Layout.Spotlight], [Layout.Tile]]);

            call.off(CallEvent.Layout, onLayout);
        });

        describe("screensharing", () => {
            it("passes source id if we can get it", async () => {
                const sourceId = "source_id";
                jest.spyOn(Modal, "createDialog").mockReturnValue({
                    finished: new Promise((r) => r([sourceId])),
                } as IHandle<any>);
                jest.spyOn(PlatformPeg.get()!, "supportsDesktopCapturer").mockReturnValue(true);

                await call.connect();

                messaging.emit(
                    `action:${ElementWidgetActions.ScreenshareRequest}`,
                    new CustomEvent("widgetapirequest", { detail: {} }),
                );

                await waitFor(() => {
                    expect(messaging!.transport.reply).toHaveBeenCalledWith(
                        expect.objectContaining({}),
                        expect.objectContaining({ pending: true }),
                    );
                });

                await waitFor(() => {
                    expect(messaging!.transport.send).toHaveBeenCalledWith(
                        "io.element.screenshare_start",
                        expect.objectContaining({ desktopCapturerSourceId: sourceId }),
                    );
                });
            });

            it("sends ScreenshareStop if we couldn't get a source id", async () => {
                jest.spyOn(Modal, "createDialog").mockReturnValue({
                    finished: new Promise((r) => r([null])),
                } as IHandle<any>);
                jest.spyOn(PlatformPeg.get()!, "supportsDesktopCapturer").mockReturnValue(true);

                await call.connect();

                messaging.emit(
                    `action:${ElementWidgetActions.ScreenshareRequest}`,
                    new CustomEvent("widgetapirequest", { detail: {} }),
                );

                await waitFor(() => {
                    expect(messaging!.transport.reply).toHaveBeenCalledWith(
                        expect.objectContaining({}),
                        expect.objectContaining({ pending: true }),
                    );
                });

                await waitFor(() => {
                    expect(messaging!.transport.send).toHaveBeenCalledWith(
                        "io.element.screenshare_stop",
                        expect.objectContaining({}),
                    );
                });
            });

            it("replies with pending: false if we don't support desktop capturer", async () => {
                jest.spyOn(PlatformPeg.get()!, "supportsDesktopCapturer").mockReturnValue(false);

                await call.connect();

                messaging.emit(
                    `action:${ElementWidgetActions.ScreenshareRequest}`,
                    new CustomEvent("widgetapirequest", { detail: {} }),
                );

                await waitFor(() => {
                    expect(messaging!.transport.reply).toHaveBeenCalledWith(
                        expect.objectContaining({}),
                        expect.objectContaining({ pending: false }),
                    );
                });
            });
        });

        it("ends the call immediately if we're the last participant to leave", async () => {
            await call.connect();
            const onDestroy = jest.fn();
            call.on(CallEvent.Destroy, onDestroy);
            await call.disconnect();
            expect(onDestroy).toHaveBeenCalled();
            call.off(CallEvent.Destroy, onDestroy);
        });

        it("ends the call after a random delay if the last participant leaves without ending it", async () => {
            // Bob connects
            await client.sendStateEvent(
                room.roomId,
                ElementCall.MEMBER_EVENT_TYPE.name,
                {
                    "m.calls": [
                        {
                            "m.call_id": call.groupCall.groupCallId,
                            "m.devices": [
                                { device_id: "bobweb", session_id: "1", feeds: [], expires_ts: 1000 * 60 * 10 },
                            ],
                        },
                    ],
                },
                bob.userId,
            );

            const onDestroy = jest.fn();
            call.on(CallEvent.Destroy, onDestroy);

            // Bob disconnects
            await client.sendStateEvent(
                room.roomId,
                ElementCall.MEMBER_EVENT_TYPE.name,
                {
                    "m.calls": [
                        {
                            "m.call_id": call.groupCall.groupCallId,
                            "m.devices": [],
                        },
                    ],
                },
                bob.userId,
            );

            // Nothing should happen for at least a second, to give Bob a chance
            // to end the call on his own
            jest.advanceTimersByTime(1000);
            expect(onDestroy).not.toHaveBeenCalled();

            // Within 10 seconds, our client should end the call on behalf of Bob
            jest.advanceTimersByTime(9000);
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
        let audioMutedSpy: jest.SpyInstance<boolean, []>;
        let videoMutedSpy: jest.SpyInstance<boolean, []>;

        beforeEach(async () => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            jest.spyOn(room, "getType").mockReturnValue(RoomType.UnstableCall);

            await ElementCall.create(room);
            const maybeCall = ElementCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, audioMutedSpy, videoMutedSpy } = setUpWidget(call));
        });

        afterEach(() => cleanUpCallAndWidget(call, widget, audioMutedSpy, videoMutedSpy));

        it("has room intent", () => {
            expect(call.groupCall.intent).toBe(GroupCallIntent.Room);
        });

        it("doesn't end the call when the last participant leaves", async () => {
            await call.connect();
            const onDestroy = jest.fn();
            call.on(CallEvent.Destroy, onDestroy);
            await call.disconnect();
            expect(onDestroy).not.toHaveBeenCalled();
            call.off(CallEvent.Destroy, onDestroy);
        });
    });
});
