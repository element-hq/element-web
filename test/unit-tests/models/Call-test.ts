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
    Layout,
    Call,
    CallEvent,
    ConnectionState,
    JitsiCall,
    ElementCall,
} from "../../../src/models/Call";
import { stubClient, mkEvent, mkRoomMember, setupAsyncStoreWithClient, mockPlatformPeg } from "../../test-utils";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../../src/MediaDeviceHandler";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import WidgetStore from "../../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../../src/stores/widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../../../src/stores/ActiveWidgetStore";
import { ElementWidgetActions } from "../../../src/stores/widgets/ElementWidgetActions";
import SettingsStore from "../../../src/settings/SettingsStore";
import { PosthogAnalytics } from "../../../src/PosthogAnalytics";
import { type SettingKey } from "../../../src/settings/Settings.tsx";

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
    (settingName): any => enabledSettings.has(settingName) || undefined,
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

    jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);

    client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
    client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
    client.matrixRTC.getRoomSession.mockImplementation((roomId) => {
        const session = new EventEmitter() as MatrixRTCSession;
        session.memberships = [];
        return session;
    });
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

            await call.start();
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

            await call.start();
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

            const connect = call.start();
            expect(call.connectionState).toBe(ConnectionState.WidgetLoading);

            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);
            await connect;
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("doesn't stop messaging when connecting", async () => {
            // Temporarily remove the messaging to simulate connecting while the
            // widget is still initializing
            jest.useFakeTimers();
            const oldSendMock = messaging.transport.send;
            mocked(messaging.transport).send.mockImplementation(async (action: string): Promise<any> => {
                if (action === ElementWidgetActions.JoinCall) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    messaging.emit(
                        `action:${ElementWidgetActions.JoinCall}`,
                        new CustomEvent("widgetapirequest", { detail: {} }),
                    );
                }
            });
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            const connect = call.start();
            expect(call.connectionState).toBe(ConnectionState.WidgetLoading);
            async function runTimers() {
                jest.advanceTimersByTime(500);
                jest.advanceTimersByTime(1000);
            }
            async function runStopMessaging() {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            }
            runStopMessaging();
            runTimers();
            let connectError;
            try {
                await connect;
            } catch (e) {
                console.log(e);
                connectError = e;
            }
            expect(connectError).toBeDefined();
            // const connect2 = await connect;
            // expect(connect2).toThrow();
            messaging.transport.send = oldSendMock;
            jest.useRealTimers();
        });

        it("fails to connect if the widget returns an error", async () => {
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.start()).rejects.toBeDefined();
        });

        it("fails to disconnect if the widget returns an error", async () => {
            await call.start();
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.disconnect()).rejects.toBeDefined();
        });

        it("handles remote disconnection", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            await call.start();
            expect(call.connectionState).toBe(ConnectionState.Connected);

            const callback = jest.fn();

            call.on(CallEvent.ConnectionState, callback);

            messaging.emit(
                `action:${ElementWidgetActions.HangupCall}`,
                new CustomEvent("widgetapirequest", { detail: {} }),
            );
            await waitFor(() => {
                expect(callback).toHaveBeenNthCalledWith(1, ConnectionState.Disconnected, ConnectionState.Connected);
                expect(callback).toHaveBeenNthCalledWith(
                    2,
                    ConnectionState.WidgetLoading,
                    ConnectionState.Disconnected,
                );
                expect(callback).toHaveBeenNthCalledWith(3, ConnectionState.Connecting, ConnectionState.WidgetLoading);
            });
            // in video rooms we expect the call to immediately reconnect
            call.off(CallEvent.ConnectionState, callback);
        });

        it("disconnects", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await call.start();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await call.disconnect();
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("disconnects when we leave the room", async () => {
            await call.start();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Leave);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("reconnects after disconnect in video rooms", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await call.start();
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await call.disconnect();
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("remains connected if we stay in the room", async () => {
            await call.start();
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
            await call.start();
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
            await call.start();
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
            await call.start();
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

            await call.start();
            await call.disconnect();
            expect(onConnectionState.mock.calls).toEqual([
                [ConnectionState.WidgetLoading, ConnectionState.Disconnected],
                [ConnectionState.Connecting, ConnectionState.WidgetLoading],
                [ConnectionState.Lobby, ConnectionState.Connecting],
                [ConnectionState.Connected, ConnectionState.Lobby],
                [ConnectionState.Disconnecting, ConnectionState.Connected],
                [ConnectionState.Disconnected, ConnectionState.Disconnecting],
            ]);

            call.off(CallEvent.ConnectionState, onConnectionState);
        });

        it("emits events when participants change", async () => {
            const onParticipants = jest.fn();
            call.on(CallEvent.Participants, onParticipants);

            await call.start();
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
            await call.start();
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
                await call.start();
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

    function setRoomMembers(memberIds: string[]) {
        jest.spyOn(room, "getJoinedMembers").mockReturnValue(memberIds.map((id) => ({ userId: id }) as RoomMember));
    }

    const callConnectProcedure: (call: ElementCall) => Promise<void> = async (call) => {
        async function sessionConnect() {
            await new Promise<void>((r) => {
                setTimeout(() => r(), 400);
            });
            client.matrixRTC.emit(MatrixRTCSessionManagerEvents.SessionStarted, call.roomId, {
                sessionId: undefined,
            } as unknown as MatrixRTCSession);
            call.session?.emit(
                MatrixRTCSessionEvent.MembershipsChanged,
                [],
                [{ sender: client.getUserId() } as CallMembership],
            );
        }
        async function runTimers() {
            jest.advanceTimersByTime(500);
            jest.advanceTimersByTime(500);
        }
        sessionConnect();
        const promise = call.start();
        runTimers();
        await promise;
    };
    const callDisconnectionProcedure: (call: ElementCall) => Promise<void> = async (call) => {
        async function sessionDisconnect() {
            await new Promise<void>((r) => {
                setTimeout(() => r(), 400);
            });
            client.matrixRTC.emit(MatrixRTCSessionManagerEvents.SessionStarted, call.roomId, {
                sessionId: undefined,
            } as unknown as MatrixRTCSession);
            call.session?.emit(MatrixRTCSessionEvent.MembershipsChanged, [], []);
        }
        async function runTimers() {
            jest.advanceTimersByTime(500);
            jest.advanceTimersByTime(500);
        }
        sessionDisconnect();
        const promise = call.disconnect();
        runTimers();
        await promise;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        ({ client, room, alice } = setUpClientRoomAndStores());
    });

    afterEach(() => {
        jest.useRealTimers();
        cleanUpClientRoomAndStores(client, room);
    });

    describe("get", () => {
        it("finds no calls", () => {
            expect(Call.get(room)).toBeNull();
        });

        it("finds calls", async () => {
            await ElementCall.create(room);
            expect(Call.get(room)).toBeInstanceOf(ElementCall);
            Call.get(room)?.destroy();
        });

        it("finds ongoing calls that are created by the session manager", async () => {
            // There is an existing session created by another user in this room.
            client.matrixRTC.getRoomSession.mockReturnValue({
                on: (ev: any, fn: any) => {},
                off: (ev: any, fn: any) => {},
                memberships: [{ fakeVal: "fake membership" }],
            } as unknown as MatrixRTCSession);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");
            call.destroy();
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

            await ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("fontScale")).toBe("1.5");
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

            call2.destroy();
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
            call.destroy();
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
            call.destroy();
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
            await ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");

            const urlParams = new URLSearchParams(new URL(call.widget.url).hash.slice(1));
            expect(urlParams.get("allowVoipWithNoMedia")).toBe("true");
            SettingsStore.getValue = originalGetValue;
            call.destroy();
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

            await ElementCall.create(room, true);
            const maybeCall = ElementCall.get(room);
            if (maybeCall === null) throw new Error("Failed to create call");
            call = maybeCall;

            ({ widget, messaging, audioMutedSpy, videoMutedSpy } = setUpWidget(call));
        });

        afterEach(() => cleanUpCallAndWidget(call, widget, audioMutedSpy, videoMutedSpy));
        // TODO refactor initial device configuration to use the EW settings.
        // Add tests for passing EW device configuration to the widget.
        it("waits for messaging when connecting", async () => {
            // Temporarily remove the messaging to simulate connecting while the
            // widget is still initializing

            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            const connect = callConnectProcedure(call);

            expect(call.connectionState).toBe(ConnectionState.WidgetLoading);

            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);
            await connect;
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("fails to connect if the widget returns an error", async () => {
            // we only send a JoinCall action if the widget is preloading
            call.widget.data = { ...call.widget, preload: true };
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.start()).rejects.toBeDefined();
        });

        it("fails to disconnect if the widget returns an error", async () => {
            await callConnectProcedure(call);
            mocked(messaging.transport).send.mockRejectedValue(new Error("never!!1! >:("));
            await expect(call.disconnect()).rejects.toBeDefined();
        });

        it("handles remote disconnection", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);

            await callConnectProcedure(call);
            expect(call.connectionState).toBe(ConnectionState.Connected);

            messaging.emit(
                `action:${ElementWidgetActions.HangupCall}`,
                new CustomEvent("widgetapirequest", { detail: {} }),
            );
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Disconnected), { interval: 5 });
        });

        it("disconnects", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await callConnectProcedure(call);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            await callDisconnectionProcedure(call);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("disconnects when we leave the room", async () => {
            await callConnectProcedure(call);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Leave);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("remains connected if we stay in the room", async () => {
            await callConnectProcedure(call);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            room.emit(RoomEvent.MyMembership, room, KnownMembership.Join);
            expect(call.connectionState).toBe(ConnectionState.Connected);
        });

        it("disconnects if the widget dies", async () => {
            await callConnectProcedure(call);
            expect(call.connectionState).toBe(ConnectionState.Connected);
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
        });

        it("tracks layout", async () => {
            await callConnectProcedure(call);
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
            await callConnectProcedure(call);

            await call.setLayout(Layout.Spotlight);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.SpotlightLayout, {});

            await call.setLayout(Layout.Tile);
            expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.TileLayout, {});
        });

        it("acknowledges mute_device widget action", async () => {
            await callConnectProcedure(call);
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

            await callConnectProcedure(call);
            await callDisconnectionProcedure(call);
            expect(onConnectionState.mock.calls).toEqual([
                [ConnectionState.WidgetLoading, ConnectionState.Disconnected],
                [ConnectionState.Connecting, ConnectionState.WidgetLoading],
                [ConnectionState.Connected, ConnectionState.Connecting],
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

        it("emits events when layout changes", async () => {
            await callConnectProcedure(call);
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

        it("ends the call immediately if the session ended", async () => {
            await callConnectProcedure(call);
            const onDestroy = jest.fn();
            call.on(CallEvent.Destroy, onDestroy);
            await callDisconnectionProcedure(call);
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

        it("sends notify event on connect in a room with more than two members", async () => {
            const sendEventSpy = jest.spyOn(room.client, "sendEvent");
            await ElementCall.create(room);
            await callConnectProcedure(Call.get(room) as ElementCall);
            expect(sendEventSpy).toHaveBeenCalledWith("!1:example.org", "org.matrix.msc4075.call.notify", {
                "application": "m.call",
                "call_id": "",
                "m.mentions": { room: true, user_ids: [] },
                "notify_type": "notify",
            });
        });
        it("sends ring on create in a DM (two participants) room", async () => {
            setRoomMembers(["@user:example.com", "@user2:example.com"]);

            const sendEventSpy = jest.spyOn(room.client, "sendEvent");
            await ElementCall.create(room);
            await callConnectProcedure(Call.get(room) as ElementCall);
            expect(sendEventSpy).toHaveBeenCalledWith("!1:example.org", "org.matrix.msc4075.call.notify", {
                "application": "m.call",
                "call_id": "",
                "m.mentions": { room: true, user_ids: [] },
                "notify_type": "ring",
            });
        });
    });

    describe("instance in a video room", () => {
        let call: ElementCall;
        let widget: Widget;
        let messaging: Mocked<ClientWidgetApi>;
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

            ({ widget, messaging, audioMutedSpy, videoMutedSpy } = setUpWidget(call));
        });

        afterEach(() => cleanUpCallAndWidget(call, widget, audioMutedSpy, videoMutedSpy));

        it("doesn't end the call when the last participant leaves", async () => {
            await callConnectProcedure(call);
            const onDestroy = jest.fn();
            call.on(CallEvent.Destroy, onDestroy);
            await callDisconnectionProcedure(call);
            expect(onDestroy).not.toHaveBeenCalled();
            call.off(CallEvent.Destroy, onDestroy);
        });

        it("connect to call with ongoing session", async () => {
            // Mock membership getter used by `roomSessionForRoom`.
            // This makes sure the roomSession will not be empty.
            jest.spyOn(MatrixRTCSession, "callMembershipsForRoom").mockImplementation(() => [
                { fakeVal: "fake membership", getMsUntilExpiry: () => 1000 } as unknown as CallMembership,
            ]);
            // Create ongoing session
            const roomSession = MatrixRTCSession.roomSessionForRoom(client, room);
            const roomSessionEmitSpy = jest.spyOn(roomSession, "emit");

            // Make sure the created session ends up in the call.
            // `getActiveRoomSession` will be used during `call.connect`
            // `getRoomSession` will be used during `Call.get`
            client.matrixRTC.getActiveRoomSession.mockImplementation(() => {
                return roomSession;
            });
            client.matrixRTC.getRoomSession.mockImplementation(() => {
                return roomSession;
            });

            await ElementCall.create(room);
            const call = Call.get(room);
            if (!(call instanceof ElementCall)) throw new Error("Failed to create call");
            expect(call.session).toBe(roomSession);
            await callConnectProcedure(call);
            expect(roomSessionEmitSpy).toHaveBeenCalledWith(
                "memberships_changed",
                [],
                [{ sender: "@alice:example.org" }],
            );
            expect(call.connectionState).toBe(ConnectionState.Connected);
            call.destroy();
        });

        it("handles remote disconnection and reconnect right after", async () => {
            expect(call.connectionState).toBe(ConnectionState.Disconnected);
            await callConnectProcedure(call);
            expect(call.connectionState).toBe(ConnectionState.Connected);

            messaging.emit(
                `action:${ElementWidgetActions.HangupCall}`,
                new CustomEvent("widgetapirequest", { detail: {} }),
            );
            // We want the call to be connecting after the hangup.
            waitFor(() => expect(call.connectionState).toBe(ConnectionState.Connecting), { interval: 5 });
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
            await ElementCall.create(room);
            expect(sendEventSpy).not.toHaveBeenCalled();
        });
    });
});
