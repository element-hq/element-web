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
import { isEqual } from "lodash";
import { mocked } from "jest-mock";
import { waitFor } from "@testing-library/react";
import { PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { Widget } from "matrix-widget-api";

import type { Mocked } from "jest-mock";
import type { MatrixClient } from "matrix-js-sdk/src/client";
import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import type { ClientWidgetApi } from "matrix-widget-api";
import type { Call } from "../../src/models/Call";
import { stubClient, mkEvent, mkRoomMember, setupAsyncStoreWithClient, mockPlatformPeg } from "../test-utils";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../src/MediaDeviceHandler";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { CallEvent, ConnectionState, JitsiCall } from "../../src/models/Call";
import WidgetStore from "../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../src/stores/widgets/WidgetMessagingStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../../src/stores/ActiveWidgetStore";
import { ElementWidgetActions } from "../../src/stores/widgets/ElementWidgetActions";

describe("JitsiCall", () => {
    mockPlatformPeg({ supportsJitsiScreensharing: () => true });
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

    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let bob: RoomMember;
    let carol: RoomMember;
    let call: Call;
    let widget: Widget;
    let messaging: Mocked<ClientWidgetApi>;
    let audioMutedSpy: jest.SpyInstance<boolean, []>;
    let videoMutedSpy: jest.SpyInstance<boolean, []>;

    beforeEach(async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);

        stubClient();
        client = mocked(MatrixClientPeg.get());

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        alice = mkRoomMember(room.roomId, "@alice:example.org");
        bob = mkRoomMember(room.roomId, "@bob:example.org");
        carol = mkRoomMember(room.roomId, "@carol:example.org");
        jest.spyOn(room, "getMember").mockImplementation(userId => {
            switch (userId) {
                case alice.userId: return alice;
                case bob.userId: return bob;
                case carol.userId: return carol;
                default: return null;
            }
        });
        jest.spyOn(room, "getMyMembership").mockReturnValue("join");

        client.getRoom.mockImplementation(roomId => roomId === room.roomId ? room : null);
        client.getRooms.mockReturnValue([room]);
        client.getUserId.mockReturnValue(alice.userId);
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
            return { event_id: event.getId() };
        });

        setupAsyncStoreWithClient(WidgetStore.instance, client);
        setupAsyncStoreWithClient(WidgetMessagingStore.instance, client);

        await JitsiCall.create(room);
        call = JitsiCall.get(room);
        if (call === null) throw new Error("Failed to create call");

        widget = new Widget(call.widget);

        const eventEmitter = new EventEmitter();
        messaging = {
            on: eventEmitter.on.bind(eventEmitter),
            off: eventEmitter.off.bind(eventEmitter),
            once: eventEmitter.once.bind(eventEmitter),
            emit: eventEmitter.emit.bind(eventEmitter),
            stop: jest.fn(),
            transport: {
                send: jest.fn(async action => {
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
                }),
                reply: jest.fn(),
            },
        } as unknown as Mocked<ClientWidgetApi>;
        WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, messaging);

        audioMutedSpy = jest.spyOn(MediaDeviceHandler, "startWithAudioMuted", "get");
        videoMutedSpy = jest.spyOn(MediaDeviceHandler, "startWithVideoMuted", "get");
    });

    afterEach(() => {
        call.destroy();
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
        WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        jest.clearAllMocks();
        audioMutedSpy.mockRestore();
        videoMutedSpy.mockRestore();
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
        mocked(messaging.transport).send.mockImplementation(async action => {
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

    it("tracks participants in room state", async () => {
        expect([...call.participants]).toEqual([]);

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
        expect([...call.participants]).toEqual([bob, alice]);

        await call.disconnect();
        expect([...call.participants]).toEqual([bob]);
    });

    it("updates room state when connecting and disconnecting", async () => {
        const now1 = Date.now();
        await call.connect();
        await waitFor(() => expect(
            room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE, alice.userId).getContent(),
        ).toEqual({
            devices: [client.getDeviceId()],
            expires_ts: now1 + JitsiCall.STUCK_DEVICE_TIMEOUT_MS,
        }), { interval: 5 });

        const now2 = Date.now();
        await call.disconnect();
        await waitFor(() => expect(
            room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE, alice.userId).getContent(),
        ).toEqual({
            devices: [],
            expires_ts: now2 + JitsiCall.STUCK_DEVICE_TIMEOUT_MS,
        }), { interval: 5 });
    });

    it("repeatedly updates room state while connected", async () => {
        await call.connect();
        await waitFor(() => expect(client.sendStateEvent).toHaveBeenLastCalledWith(
            room.roomId,
            JitsiCall.MEMBER_EVENT_TYPE,
            { devices: [client.getDeviceId()], expires_ts: expect.any(Number) },
            alice.userId,
        ), { interval: 5 });

        client.sendStateEvent.mockClear();
        jest.advanceTimersByTime(JitsiCall.STUCK_DEVICE_TIMEOUT_MS);
        await waitFor(() => expect(client.sendStateEvent).toHaveBeenLastCalledWith(
            room.roomId,
            JitsiCall.MEMBER_EVENT_TYPE,
            { devices: [client.getDeviceId()], expires_ts: expect.any(Number) },
            alice.userId,
        ), { interval: 5 });
    });

    it("emits events when connection state changes", async () => {
        const events: ConnectionState[] = [];
        const onConnectionState = (state: ConnectionState) => events.push(state);
        call.on(CallEvent.ConnectionState, onConnectionState);

        await call.connect();
        await call.disconnect();
        expect(events).toEqual([
            ConnectionState.Connecting,
            ConnectionState.Connected,
            ConnectionState.Disconnecting,
            ConnectionState.Disconnected,
        ]);
    });

    it("emits events when participants change", async () => {
        const events: Set<RoomMember>[] = [];
        const onParticipants = (participants: Set<RoomMember>) => {
            if (!isEqual(participants, events[events.length - 1])) events.push(participants);
        };
        call.on(CallEvent.Participants, onParticipants);

        await call.connect();
        await call.disconnect();
        expect(events).toEqual([new Set([alice]), new Set()]);
    });

    it("switches to spotlight layout when the widget becomes a PiP", async () => {
        await call.connect();
        ActiveWidgetStore.instance.emit(ActiveWidgetStoreEvent.Undock);
        expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.SpotlightLayout, {});
        ActiveWidgetStore.instance.emit(ActiveWidgetStoreEvent.Dock);
        expect(messaging.transport.send).toHaveBeenCalledWith(ElementWidgetActions.TileLayout, {});
    });
});
