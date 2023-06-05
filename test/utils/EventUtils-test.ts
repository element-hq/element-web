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

import { M_LOCATION } from "matrix-js-sdk/src/@types/location";
import {
    EventStatus,
    EventType,
    IEvent,
    MatrixClient,
    MatrixEvent,
    MsgType,
    PendingEventOrdering,
    RelationType,
    Room,
} from "matrix-js-sdk/src/matrix";
import { Thread } from "matrix-js-sdk/src/models/thread";

import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import {
    canCancel,
    canEditContent,
    canEditOwnEvent,
    fetchInitialEvent,
    findEditableEvent,
    highlightEvent,
    isContentActionable,
    isLocationEvent,
    isVoiceMessage,
} from "../../src/utils/EventUtils";
import { getMockClientWithEventEmitter, makeBeaconInfoEvent, makePollStartEvent, stubClient } from "../test-utils";
import dis from "../../src/dispatcher/dispatcher";
import { Action } from "../../src/dispatcher/actions";
import { mkVoiceBroadcastInfoStateEvent } from "../voice-broadcast/utils/test-utils";
import { VoiceBroadcastInfoState } from "../../src/voice-broadcast/types";

jest.mock("../../src/dispatcher/dispatcher");

describe("EventUtils", () => {
    const userId = "@user:server";
    const roomId = "!room:server";
    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(userId),
    });

    beforeEach(() => {
        mockClient.getUserId.mockClear().mockReturnValue(userId);
    });
    afterAll(() => {
        jest.spyOn(MatrixClientPeg, "get").mockRestore();
    });

    // setup events
    const unsentEvent = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
    });
    unsentEvent.status = EventStatus.ENCRYPTING;

    const redactedEvent = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
    });
    redactedEvent.makeRedacted(redactedEvent);

    const stateEvent = new MatrixEvent({
        type: EventType.RoomTopic,
        state_key: "",
    });
    const beaconInfoEvent = makeBeaconInfoEvent(userId, roomId);

    const roomMemberEvent = new MatrixEvent({
        type: EventType.RoomMember,
        sender: userId,
    });

    const stickerEvent = new MatrixEvent({
        type: EventType.Sticker,
        sender: userId,
    });

    const pollStartEvent = makePollStartEvent("What?", userId);

    const notDecryptedEvent = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
        content: {
            msgtype: "m.bad.encrypted",
        },
    });

    const noMsgType = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
        content: {
            msgtype: undefined,
        },
    });

    const noContentBody = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
        content: {
            msgtype: MsgType.Image,
        },
    });

    const emptyContentBody = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
        content: {
            msgtype: MsgType.Text,
            body: "",
        },
    });

    const objectContentBody = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
        content: {
            msgtype: MsgType.File,
            body: {},
        },
    });

    const niceTextMessage = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: userId,
        content: {
            msgtype: MsgType.Text,
            body: "Hello",
        },
    });

    const bobsTextMessage = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: "@bob:server",
        content: {
            msgtype: MsgType.Text,
            body: "Hello from Bob",
        },
    });

    const voiceBroadcastStart = mkVoiceBroadcastInfoStateEvent(
        "!room:example.com",
        VoiceBroadcastInfoState.Started,
        "@user:example.com",
        "ABC123",
    );

    const voiceBroadcastStop = mkVoiceBroadcastInfoStateEvent(
        "!room:example.com",
        VoiceBroadcastInfoState.Stopped,
        "@user:example.com",
        "ABC123",
    );

    describe("isContentActionable()", () => {
        type TestCase = [string, MatrixEvent];
        it.each<TestCase>([
            ["unsent event", unsentEvent],
            ["redacted event", redactedEvent],
            ["state event", stateEvent],
            ["undecrypted event", notDecryptedEvent],
            ["room member event", roomMemberEvent],
            ["event without msgtype", noMsgType],
            ["event without content body property", noContentBody],
            ["broadcast stop event", voiceBroadcastStop],
        ])("returns false for %s", (_description, event) => {
            expect(isContentActionable(event)).toBe(false);
        });

        it.each<TestCase>([
            ["sticker event", stickerEvent],
            ["poll start event", pollStartEvent],
            ["event with empty content body", emptyContentBody],
            ["event with a content body", niceTextMessage],
            ["beacon_info event", beaconInfoEvent],
            ["broadcast start event", voiceBroadcastStart],
        ])("returns true for %s", (_description, event) => {
            expect(isContentActionable(event)).toBe(true);
        });
    });

    describe("editable content helpers", () => {
        const replaceRelationEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            sender: userId,
            content: {
                msgtype: MsgType.Text,
                body: "Hello",
                ["m.relates_to"]: {
                    rel_type: RelationType.Replace,
                    event_id: "1",
                },
            },
        });

        const referenceRelationEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            sender: userId,
            content: {
                msgtype: MsgType.Text,
                body: "Hello",
                ["m.relates_to"]: {
                    rel_type: RelationType.Reference,
                    event_id: "1",
                },
            },
        });

        const emoteEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            sender: userId,
            content: {
                msgtype: MsgType.Emote,
                body: "🧪",
            },
        });

        type TestCase = [string, MatrixEvent];

        const uneditableCases: TestCase[] = [
            ["redacted event", redactedEvent],
            ["state event", stateEvent],
            ["event that is not room message", roomMemberEvent],
            ["event without msgtype", noMsgType],
            ["event without content body property", noContentBody],
            ["event with empty content body property", emptyContentBody],
            ["event with non-string body", objectContentBody],
            ["event not sent by current user", bobsTextMessage],
            ["event with a replace relation", replaceRelationEvent],
        ];

        const editableCases: TestCase[] = [
            ["event with reference relation", referenceRelationEvent],
            ["emote event", emoteEvent],
            ["poll start event", pollStartEvent],
            ["event with a content body", niceTextMessage],
        ];

        describe("canEditContent()", () => {
            it.each<TestCase>(uneditableCases)("returns false for %s", (_description, event) => {
                expect(canEditContent(mockClient, event)).toBe(false);
            });

            it.each<TestCase>(editableCases)("returns true for %s", (_description, event) => {
                expect(canEditContent(mockClient, event)).toBe(true);
            });
        });
        describe("canEditOwnContent()", () => {
            it.each<TestCase>(uneditableCases)("returns false for %s", (_description, event) => {
                expect(canEditOwnEvent(mockClient, event)).toBe(false);
            });

            it.each<TestCase>(editableCases)("returns true for %s", (_description, event) => {
                expect(canEditOwnEvent(mockClient, event)).toBe(true);
            });
        });
    });

    describe("isVoiceMessage()", () => {
        it("returns true for an event with msc2516.voice content", () => {
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                content: {
                    ["org.matrix.msc2516.voice"]: {},
                },
            });

            expect(isVoiceMessage(event)).toBe(true);
        });

        it("returns true for an event with msc3245.voice content", () => {
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                content: {
                    ["org.matrix.msc3245.voice"]: {},
                },
            });

            expect(isVoiceMessage(event)).toBe(true);
        });

        it("returns false for an event with voice content", () => {
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                content: {
                    body: "hello",
                },
            });

            expect(isVoiceMessage(event)).toBe(false);
        });
    });

    describe("isLocationEvent()", () => {
        it("returns true for an event with m.location stable type", () => {
            const event = new MatrixEvent({
                type: M_LOCATION.altName,
            });
            expect(isLocationEvent(event)).toBe(true);
        });
        it("returns true for an event with m.location unstable prefixed type", () => {
            const event = new MatrixEvent({
                type: M_LOCATION.name,
            });
            expect(isLocationEvent(event)).toBe(true);
        });
        it("returns true for a room message with stable m.location msgtype", () => {
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                content: {
                    msgtype: M_LOCATION.altName,
                },
            });
            expect(isLocationEvent(event)).toBe(true);
        });
        it("returns true for a room message with unstable m.location msgtype", () => {
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                content: {
                    msgtype: M_LOCATION.name,
                },
            });
            expect(isLocationEvent(event)).toBe(true);
        });
        it("returns false for a non location event", () => {
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                content: {
                    body: "Hello",
                },
            });
            expect(isLocationEvent(event)).toBe(false);
        });
    });

    describe("canCancel()", () => {
        it.each([[EventStatus.QUEUED], [EventStatus.NOT_SENT], [EventStatus.ENCRYPTING]])(
            "return true for status %s",
            (status) => {
                expect(canCancel(status)).toBe(true);
            },
        );

        it.each([
            [EventStatus.SENDING],
            [EventStatus.CANCELLED],
            [EventStatus.SENT],
            ["invalid-status" as unknown as EventStatus],
        ])("return false for status %s", (status) => {
            expect(canCancel(status)).toBe(false);
        });
    });

    describe("fetchInitialEvent", () => {
        const ROOM_ID = "!roomId:example.org";
        let room: Room;
        let client: MatrixClient;

        const NORMAL_EVENT = "$normalEvent";
        const THREAD_ROOT = "$threadRoot";
        const THREAD_REPLY = "$threadReply";

        const events: Record<string, Partial<IEvent>> = {
            [NORMAL_EVENT]: {
                event_id: NORMAL_EVENT,
                type: EventType.RoomMessage,
                content: {
                    body: "Classic event",
                    msgtype: MsgType.Text,
                },
            },
            [THREAD_ROOT]: {
                event_id: THREAD_ROOT,
                type: EventType.RoomMessage,
                content: {
                    body: "Thread root",
                    msgtype: "m.text",
                },
                unsigned: {
                    "m.relations": {
                        [RelationType.Thread]: {
                            latest_event: {
                                event_id: THREAD_REPLY,
                                type: EventType.RoomMessage,
                                content: {
                                    "body": "Thread reply",
                                    "msgtype": MsgType.Text,
                                    "m.relates_to": {
                                        event_id: "$threadRoot",
                                        rel_type: RelationType.Thread,
                                    },
                                },
                            },
                            count: 1,
                            current_user_participated: false,
                        },
                    },
                },
            },
            [THREAD_REPLY]: {
                event_id: THREAD_REPLY,
                type: EventType.RoomMessage,
                content: {
                    "body": "Thread reply",
                    "msgtype": MsgType.Text,
                    "m.relates_to": {
                        event_id: THREAD_ROOT,
                        rel_type: RelationType.Thread,
                    },
                },
            },
        };

        beforeEach(() => {
            jest.clearAllMocks();

            stubClient();
            client = MatrixClientPeg.safeGet();

            room = new Room(ROOM_ID, client, client.getUserId()!, {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });

            jest.spyOn(client, "supportsThreads").mockReturnValue(true);
            jest.spyOn(client, "getRoom").mockReturnValue(room);
            jest.spyOn(client, "fetchRoomEvent").mockImplementation(async (roomId, eventId) => {
                return events[eventId] ?? Promise.reject();
            });
        });

        it("returns null for unknown events", async () => {
            expect(await fetchInitialEvent(client, room.roomId, "$UNKNOWN")).toBeNull();
            expect(await fetchInitialEvent(client, room.roomId, NORMAL_EVENT)).toBeInstanceOf(MatrixEvent);
        });

        it("creates a thread when needed", async () => {
            await fetchInitialEvent(client, room.roomId, THREAD_REPLY);
            expect(room.getThread(THREAD_ROOT)).toBeInstanceOf(Thread);
        });
    });

    describe("findEditableEvent", () => {
        it("should not explode when given empty events array", () => {
            expect(
                findEditableEvent({
                    events: [],
                    isForward: true,
                    matrixClient: mockClient,
                }),
            ).toBeUndefined();
        });
    });

    describe("highlightEvent", () => {
        const eventId = "$zLg9jResFQmMO_UKFeWpgLgOgyWrL8qIgLgZ5VywrCQ";

        it("should dispatch an action to view the event", () => {
            highlightEvent(roomId, eventId);
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                event_id: eventId,
                highlighted: true,
                room_id: roomId,
                metricsTrigger: undefined,
            });
        });
    });
});
