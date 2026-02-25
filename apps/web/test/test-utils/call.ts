/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixWidgetType } from "matrix-widget-api";
import {
    type GroupCall,
    Room,
    type RoomMember,
    type MatrixEvent,
    type MatrixClient,
    PendingEventOrdering,
    KnownMembership,
    RoomStateEvent,
    type IContent,
} from "matrix-js-sdk/src/matrix";
import { mocked, type Mocked } from "jest-mock";
import { type MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";

import { mkEvent, mkRoomMember, setupAsyncStoreWithClient, stubClient } from "./test-utils";
import { Call, type ConnectionState, ElementCall, JitsiCall } from "../../src/models/Call";
import { CallStore } from "../../src/stores/CallStore";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import DMRoomMap from "../../src/utils/DMRoomMap";
import { MockEventEmitter } from "./client";
import WidgetStore from "../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../src/stores/widgets/WidgetMessagingStore";
import SettingsStore from "../../src/settings/SettingsStore";

export class MockedCall extends Call {
    public static readonly EVENT_TYPE = "org.example.mocked_call";
    public readonly STUCK_DEVICE_TIMEOUT_MS = 1000 * 60 * 60; // 1 hour

    private constructor(
        room: Room,
        public readonly event: MatrixEvent,
    ) {
        super(
            {
                id: event.getStateKey()!,
                eventId: "$1:example.org",
                roomId: room.roomId,
                type: MatrixWidgetType.Custom,
                url: "https://example.org",
                name: "Group call",
                creatorUserId: "@alice:example.org",
                // waitForIframeLoad = false, makes the widget API wait for the 'contentLoaded' event.
                waitForIframeLoad: false,
            },
            room.client,
        );
        this.groupCall = { creationTs: this.event.getTs() } as unknown as GroupCall;
    }

    public static get(room: Room): MockedCall | null {
        const [event] = room.currentState.getStateEvents(this.EVENT_TYPE);
        return event === undefined || "m.terminated" in event.getContent() ? null : new MockedCall(room, event);
    }

    public static create(room: Room, id: string) {
        room.addLiveEvents(
            [
                mkEvent({
                    event: true,
                    type: this.EVENT_TYPE,
                    room: room.roomId,
                    user: "@alice:example.org",
                    content: { "m.type": "m.video", "m.intent": "m.prompt" },
                    skey: id,
                    ts: Date.now(),
                }),
            ],
            { addToState: true },
        );
        // @ts-ignore deliberately calling a private method
        // Let CallStore know that a call might now exist
        CallStore.instance.updateRoom(room);
    }

    public readonly groupCall: GroupCall;

    public get participants(): Map<RoomMember, Set<string>> {
        return super.participants;
    }
    public set participants(value: Map<RoomMember, Set<string>>) {
        super.participants = value;
    }

    public setConnectionState(value: ConnectionState): void {
        super.connectionState = value;
    }

    // No action needed for any of the following methods since this is just a mock
    public async clean(): Promise<void> {}
    // Public to allow spying
    public async performDisconnection(): Promise<void> {}

    public destroy() {
        // Terminate the call for good measure
        this.room.addLiveEvents(
            [
                mkEvent({
                    event: true,
                    type: MockedCall.EVENT_TYPE,
                    room: this.room.roomId,
                    user: "@alice:example.org",
                    content: { ...this.event.getContent(), "m.terminated": "Call ended" },
                    skey: this.widget.id,
                    ts: Date.now(),
                }),
            ],
            { addToState: true },
        );

        super.destroy();
    }
}

/**
 * Sets up the call store to use mocked calls.
 */
export function useMockedCalls() {
    Call.get = (room) => MockedCall.get(room);
    JitsiCall.create = async (room) => MockedCall.create(room, "1");
    ElementCall.create = (room) => MockedCall.create(room, "1");
}

/**
 * Enables the feature flags required for call tests.
 */
export function enableCalls(): { enabledSettings: Set<string> } {
    const enabledSettings = new Set(["feature_group_calls", "feature_video_rooms", "feature_element_call_video_rooms"]);
    jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName): any => {
        if (settingName.startsWith("feature_")) return enabledSettings.has(settingName);
        if (settingName === "activeCallRoomIds") return [];
        return undefined;
    });
    return { enabledSettings };
}

export function setUpClientRoomAndStores(): {
    client: Mocked<MatrixClient>;
    room: Room;
    alice: RoomMember;
    bob: RoomMember;
    carol: RoomMember;
    roomSession: Mocked<MatrixRTCSession>;
} {
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
        getConsensusCallIntent: jest.fn().mockReturnValue(undefined),
        room,
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
}

export function cleanUpClientRoomAndStores(client: MatrixClient, room: Room) {
    client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
}
