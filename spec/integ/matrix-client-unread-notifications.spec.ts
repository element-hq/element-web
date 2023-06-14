/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import "fake-indexeddb/auto";

import HttpBackend from "matrix-mock-request";

import {
    Category,
    ClientEvent,
    EventType,
    ISyncResponse,
    MatrixClient,
    MatrixEvent,
    NotificationCountType,
    RelationType,
    Room,
} from "../../src";
import { TestClient } from "../TestClient";
import { ReceiptType } from "../../src/@types/read_receipts";
import { mkThread } from "../test-utils/thread";
import { SyncState } from "../../src/sync";

describe("MatrixClient syncing", () => {
    const userA = "@alice:localhost";
    const userB = "@bob:localhost";

    const selfUserId = userA;
    const selfAccessToken = "aseukfgwef";

    let client: MatrixClient | undefined;
    let httpBackend: HttpBackend | undefined;

    const setupTestClient = (): [MatrixClient, HttpBackend] => {
        const testClient = new TestClient(selfUserId, "DEVICE", selfAccessToken);
        const httpBackend = testClient.httpBackend;
        const client = testClient.client;
        httpBackend!.when("GET", "/versions").respond(200, {});
        httpBackend!.when("GET", "/pushrules").respond(200, {});
        httpBackend!.when("POST", "/filter").respond(200, { filter_id: "a filter id" });
        return [client, httpBackend];
    };

    beforeEach(() => {
        [client, httpBackend] = setupTestClient();
    });

    afterEach(() => {
        httpBackend!.verifyNoOutstandingExpectation();
        client!.stopClient();
        return httpBackend!.stop();
    });

    it("reactions in thread set the correct timeline to unread", async () => {
        const roomId = "!room:localhost";

        // start the client, and wait for it to initialise
        httpBackend!.when("GET", "/sync").respond(200, {
            next_batch: "s_5_3",
            rooms: {
                [Category.Join]: {},
                [Category.Leave]: {},
                [Category.Invite]: {},
            },
        });
        client!.startClient({ threadSupport: true });
        await Promise.all([
            httpBackend?.flushAllExpected(),
            new Promise<void>((resolve) => {
                client!.on(ClientEvent.Sync, (state) => state === SyncState.Syncing && resolve());
            }),
        ]);

        const room = new Room(roomId, client!, selfUserId);
        jest.spyOn(client!, "getRoom").mockImplementation((id) => (id === roomId ? room : null));

        const thread = mkThread({ room, client: client!, authorId: selfUserId, participantUserIds: [selfUserId] });
        const threadReply = thread.events.at(-1)!;
        await room.addLiveEvents([thread.rootEvent]);

        // Initialize read receipt datastructure before testing the reaction
        room.addReceiptToStructure(thread.rootEvent.getId()!, ReceiptType.Read, selfUserId, { ts: 1 }, false);
        thread.thread.addReceiptToStructure(
            threadReply.getId()!,
            ReceiptType.Read,
            selfUserId,
            { thread_id: thread.thread.id, ts: 1 },
            false,
        );
        expect(room.getReadReceiptForUserId(selfUserId, false)?.eventId).toEqual(thread.rootEvent.getId());
        expect(thread.thread.getReadReceiptForUserId(selfUserId, false)?.eventId).toEqual(threadReply.getId());

        const reactionEventId = `$9-${Math.random()}-${Math.random()}`;
        let lastEvent: MatrixEvent | null = null;
        jest.spyOn(client! as any, "sendEventHttpRequest").mockImplementation((event) => {
            lastEvent = event as MatrixEvent;
            return { event_id: reactionEventId };
        });

        await client!.sendEvent(roomId, EventType.Reaction, {
            "m.relates_to": {
                rel_type: RelationType.Annotation,
                event_id: threadReply.getId(),
                key: "",
            },
        });

        expect(lastEvent!.getId()).toEqual(reactionEventId);
        room.handleRemoteEcho(new MatrixEvent(lastEvent!.event), lastEvent!);

        // Our ideal state after this is the following:
        //
        // Room: [synthetic: threadroot, actual: threadroot]
        // Thread: [synthetic: threadreaction, actual: threadreply]
        //
        // The reaction and reply are both in the thread, and their receipts should be isolated to the thread.
        // The reaction has not been acknowledged in a dedicated read receipt message, so only the synthetic receipt
        // should be updated.

        // Ensure the synthetic receipt for the room has not been updated
        expect(room.getReadReceiptForUserId(selfUserId, false)?.eventId).toEqual(thread.rootEvent.getId());
        expect(room.getEventReadUpTo(selfUserId, false)).toEqual(thread.rootEvent.getId());
        // Ensure the actual receipt for the room has not been updated
        expect(room.getReadReceiptForUserId(selfUserId, true)?.eventId).toEqual(thread.rootEvent.getId());
        expect(room.getEventReadUpTo(selfUserId, true)).toEqual(thread.rootEvent.getId());
        // Ensure the synthetic receipt for the thread has been updated
        expect(thread.thread.getReadReceiptForUserId(selfUserId, false)?.eventId).toEqual(reactionEventId);
        expect(thread.thread.getEventReadUpTo(selfUserId, false)).toEqual(reactionEventId);
        // Ensure the actual receipt for the thread has not been updated
        expect(thread.thread.getReadReceiptForUserId(selfUserId, true)?.eventId).toEqual(threadReply.getId());
        expect(thread.thread.getEventReadUpTo(selfUserId, true)).toEqual(threadReply.getId());
    });

    describe("Stuck unread notifications integration tests", () => {
        const ROOM_ID = "!room:localhost";

        const syncData = getSampleStuckNotificationSyncResponse(ROOM_ID);

        it("resets notifications if the last event originates from the logged in user", async () => {
            httpBackend!
                .when("GET", "/sync")
                .check((req) => {
                    expect(req.queryParams!.filter).toEqual("a filter id");
                })
                .respond(200, syncData);

            client!.store.getSavedSyncToken = jest.fn().mockResolvedValue("this-is-a-token");
            client!.startClient({ initialSyncLimit: 1 });

            await httpBackend!.flushAllExpected();

            const room = client?.getRoom(ROOM_ID);

            expect(room).toBeInstanceOf(Room);
            expect(room?.getUnreadNotificationCount(NotificationCountType.Total)).toBe(0);
        });
    });

    function getSampleStuckNotificationSyncResponse(roomId: string): Partial<ISyncResponse> {
        return {
            next_batch: "batch_token",
            rooms: {
                [Category.Join]: {
                    [roomId]: {
                        timeline: {
                            events: [
                                {
                                    content: {
                                        creator: userB,
                                        room_version: "9",
                                    },
                                    origin_server_ts: 1,
                                    sender: userB,
                                    state_key: "",
                                    type: "m.room.create",
                                    event_id: "$event1",
                                },
                                {
                                    content: {
                                        avatar_url: "",
                                        displayname: userB,
                                        membership: "join",
                                    },
                                    origin_server_ts: 2,
                                    sender: userB,
                                    state_key: userB,
                                    type: "m.room.member",
                                    event_id: "$event2",
                                },
                                {
                                    content: {
                                        ban: 50,
                                        events: {
                                            "m.room.avatar": 50,
                                            "m.room.canonical_alias": 50,
                                            "m.room.encryption": 100,
                                            "m.room.history_visibility": 100,
                                            "m.room.name": 50,
                                            "m.room.power_levels": 100,
                                            "m.room.server_acl": 100,
                                            "m.room.tombstone": 100,
                                        },
                                        events_default: 0,
                                        historical: 100,
                                        invite: 0,
                                        kick: 50,
                                        redact: 50,
                                        state_default: 50,
                                        users: {
                                            [userA]: 100,
                                            [userB]: 100,
                                        },
                                        users_default: 0,
                                    },
                                    origin_server_ts: 3,
                                    sender: userB,
                                    state_key: "",
                                    type: "m.room.power_levels",
                                    event_id: "$event3",
                                },
                                {
                                    content: {
                                        join_rule: "invite",
                                    },
                                    origin_server_ts: 4,
                                    sender: userB,
                                    state_key: "",
                                    type: "m.room.join_rules",
                                    event_id: "$event4",
                                },
                                {
                                    content: {
                                        history_visibility: "shared",
                                    },
                                    origin_server_ts: 5,
                                    sender: userB,
                                    state_key: "",
                                    type: "m.room.history_visibility",
                                    event_id: "$event5",
                                },
                                {
                                    content: {
                                        guest_access: "can_join",
                                    },
                                    origin_server_ts: 6,
                                    sender: userB,
                                    state_key: "",
                                    type: "m.room.guest_access",
                                    unsigned: {
                                        age: 1651569,
                                    },
                                    event_id: "$event6",
                                },
                                {
                                    content: {
                                        algorithm: "m.megolm.v1.aes-sha2",
                                    },
                                    origin_server_ts: 7,
                                    sender: userB,
                                    state_key: "",
                                    type: "m.room.encryption",
                                    event_id: "$event7",
                                },
                                {
                                    content: {
                                        avatar_url: "",
                                        displayname: userA,
                                        is_direct: true,
                                        membership: "invite",
                                    },
                                    origin_server_ts: 8,
                                    sender: userB,
                                    state_key: userA,
                                    type: "m.room.member",
                                    event_id: "$event8",
                                },
                                {
                                    content: {
                                        msgtype: "m.text",
                                        body: "hello",
                                    },
                                    origin_server_ts: 9,
                                    sender: userB,
                                    type: "m.room.message",
                                    event_id: "$event9",
                                },
                                {
                                    content: {
                                        avatar_url: "",
                                        displayname: userA,
                                        membership: "join",
                                    },
                                    origin_server_ts: 10,
                                    sender: userA,
                                    state_key: userA,
                                    type: "m.room.member",
                                    event_id: "$event10",
                                },
                                {
                                    content: {
                                        msgtype: "m.text",
                                        body: "world",
                                    },
                                    origin_server_ts: 11,
                                    sender: userA,
                                    type: "m.room.message",
                                    event_id: "$event11",
                                },
                            ],
                            prev_batch: "123",
                            limited: false,
                        },
                        state: {
                            events: [],
                        },
                        account_data: {
                            events: [
                                {
                                    type: "m.fully_read",
                                    content: {
                                        event_id: "$dER5V1RCMxzAhHXQJoMjqyuoxpPtK2X6hCb9T8Jg2wU",
                                    },
                                },
                            ],
                        },
                        ephemeral: {
                            events: [
                                {
                                    type: "m.receipt",
                                    content: {
                                        $event9: {
                                            "m.read": {
                                                [userA]: {
                                                    ts: 100,
                                                },
                                            },
                                            "m.read.private": {
                                                [userA]: {
                                                    ts: 100,
                                                },
                                            },
                                        },
                                        dER5V1RCMxzAhHXQJoMjqyuoxpPtK2X6hCb9T8Jg2wU: {
                                            "m.read": {
                                                [userB]: {
                                                    ts: 666,
                                                },
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                        unread_notifications: {
                            notification_count: 1,
                            highlight_count: 0,
                        },
                        summary: {
                            "m.joined_member_count": 2,
                            "m.invited_member_count": 0,
                            "m.heroes": [userB],
                        },
                    },
                },
                [Category.Leave]: {},
                [Category.Invite]: {},
            },
        };
    }
});
