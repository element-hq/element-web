/*
Copyright 2017 Vector Creations Ltd
Copyright 2019, 2022 The Matrix.org Foundation C.I.C.

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

import { ReceiptType } from "../../src/@types/read_receipts";
import { IJoinedRoom, ISyncResponse, SyncAccumulator } from "../../src/sync-accumulator";
import { IRoomSummary } from "../../src";

// The event body & unsigned object get frozen to assert that they don't get altered
// by the impl
const RES_WITH_AGE = {
    next_batch: "abc",
    rooms: {
        invite: {},
        leave: {},
        join: {
            "!foo:bar": {
                account_data: { events: [] },
                ephemeral: { events: [] },
                unread_notifications: {},
                unread_thread_notifications: {
                    "$143273582443PhrSn:example.org": {
                        highlight_count: 0,
                        notification_count: 1,
                    },
                },
                timeline: {
                    events: [
                        Object.freeze({
                            content: {
                                body: "This thing is happening right now!",
                            },
                            origin_server_ts: 123456789,
                            sender: "@alice:localhost",
                            type: "m.room.message",
                            unsigned: Object.freeze({
                                age: 50,
                            }),
                        }),
                    ],
                    prev_batch: "something",
                },
            },
        },
    },
} as unknown as ISyncResponse;

describe("SyncAccumulator", function () {
    let sa: SyncAccumulator;

    beforeEach(function () {
        sa = new SyncAccumulator({
            maxTimelineEntries: 10,
        });
    });

    it("should return the same /sync response if accumulated exactly once", () => {
        // technically cheating since we also cheekily pre-populate keys we
        // know that the sync accumulator will pre-populate.
        // It isn't 100% transitive.
        const res = {
            next_batch: "abc",
            rooms: {
                invite: {},
                leave: {},
                join: {
                    "!foo:bar": {
                        account_data: { events: [] },
                        ephemeral: { events: [] },
                        unread_notifications: {},
                        state: {
                            events: [member("alice", "join"), member("bob", "join")],
                        },
                        summary: {
                            "m.heroes": undefined,
                            "m.joined_member_count": undefined,
                            "m.invited_member_count": undefined,
                        },
                        timeline: {
                            events: [msg("alice", "hi")],
                            prev_batch: "something",
                        },
                    },
                },
            },
        } as unknown as ISyncResponse;
        sa.accumulate(res);
        const output = sa.getJSON();
        expect(output.nextBatch).toEqual(res.next_batch);
        expect(output.roomsData).toEqual(res.rooms);
    });

    it("should prune the timeline to the oldest prev_batch within the limit", () => {
        // maxTimelineEntries is 10 so we should get back all
        // 10 timeline messages with a prev_batch of "pinned_to_1"
        sa.accumulate(
            syncSkeleton({
                state: { events: [member("alice", "join")] },
                timeline: {
                    events: [
                        msg("alice", "1"),
                        msg("alice", "2"),
                        msg("alice", "3"),
                        msg("alice", "4"),
                        msg("alice", "5"),
                        msg("alice", "6"),
                        msg("alice", "7"),
                    ],
                    prev_batch: "pinned_to_1",
                },
            }),
        );
        sa.accumulate(
            syncSkeleton({
                state: { events: [] },
                timeline: {
                    events: [msg("alice", "8")],
                    prev_batch: "pinned_to_8",
                },
            }),
        );
        sa.accumulate(
            syncSkeleton({
                state: { events: [] },
                timeline: {
                    events: [msg("alice", "9"), msg("alice", "10")],
                    prev_batch: "pinned_to_10",
                },
            }),
        );

        let output = sa.getJSON().roomsData.join["!foo:bar"];

        expect(output.timeline.events.length).toEqual(10);
        output.timeline.events.forEach((e, i) => {
            expect(e.content.body).toEqual("" + (i + 1));
        });
        expect(output.timeline.prev_batch).toEqual("pinned_to_1");

        // accumulate more messages. Now it can't have a prev_batch of "pinned to 1"
        // AND give us <= 10 messages without losing messages in-between.
        // It should try to find the oldest prev_batch which still fits into 10
        // messages, which is "pinned to 8".
        sa.accumulate(
            syncSkeleton({
                state: { events: [] },
                timeline: {
                    events: [
                        msg("alice", "11"),
                        msg("alice", "12"),
                        msg("alice", "13"),
                        msg("alice", "14"),
                        msg("alice", "15"),
                        msg("alice", "16"),
                        msg("alice", "17"),
                    ],
                    prev_batch: "pinned_to_11",
                },
            }),
        );

        output = sa.getJSON().roomsData.join["!foo:bar"];

        expect(output.timeline.events.length).toEqual(10);
        output.timeline.events.forEach((e, i) => {
            expect(e.content.body).toEqual("" + (i + 8));
        });
        expect(output.timeline.prev_batch).toEqual("pinned_to_8");
    });

    it("should remove the stored timeline on limited syncs", () => {
        sa.accumulate(
            syncSkeleton({
                state: { events: [member("alice", "join")] },
                timeline: {
                    events: [msg("alice", "1"), msg("alice", "2"), msg("alice", "3")],
                    prev_batch: "pinned_to_1",
                },
            }),
        );
        // some time passes and now we get a limited sync
        sa.accumulate(
            syncSkeleton({
                state: { events: [] },
                timeline: {
                    limited: true,
                    events: [msg("alice", "51"), msg("alice", "52"), msg("alice", "53")],
                    prev_batch: "pinned_to_51",
                },
            }),
        );

        const output = sa.getJSON().roomsData.join["!foo:bar"];

        expect(output.timeline.events.length).toEqual(3);
        output.timeline.events.forEach((e, i) => {
            expect(e.content.body).toEqual("" + (i + 51));
        });
        expect(output.timeline.prev_batch).toEqual("pinned_to_51");
    });

    it("should drop typing notifications", () => {
        const res = syncSkeleton({
            ephemeral: {
                events: [
                    {
                        type: "m.typing",
                        content: {
                            user_ids: ["@alice:localhost"],
                        },
                    },
                ],
            },
        });
        sa.accumulate(res);
        expect(sa.getJSON().roomsData.join["!foo:bar"].ephemeral.events.length).toEqual(0);
    });

    it("should clobber account data based on event type", () => {
        const acc1 = {
            type: "favourite.food",
            content: {
                food: "banana",
            },
        };
        const acc2 = {
            type: "favourite.food",
            content: {
                food: "apple",
            },
        };
        sa.accumulate(
            syncSkeleton({
                account_data: {
                    events: [acc1],
                },
            }),
        );
        sa.accumulate(
            syncSkeleton({
                account_data: {
                    events: [acc2],
                },
            }),
        );
        expect(sa.getJSON().roomsData.join["!foo:bar"].account_data.events.length).toEqual(1);
        expect(sa.getJSON().roomsData.join["!foo:bar"].account_data.events[0]).toEqual(acc2);
    });

    it("should clobber global account data based on event type", () => {
        const acc1 = {
            type: "favourite.food",
            content: {
                food: "banana",
            },
        };
        const acc2 = {
            type: "favourite.food",
            content: {
                food: "apple",
            },
        };
        sa.accumulate({
            account_data: {
                events: [acc1],
            },
        } as unknown as ISyncResponse);
        sa.accumulate({
            account_data: {
                events: [acc2],
            },
        } as unknown as ISyncResponse);
        expect(sa.getJSON().accountData.length).toEqual(1);
        expect(sa.getJSON().accountData[0]).toEqual(acc2);
    });

    it("should accumulate read receipts", () => {
        const receipt1 = {
            type: "m.receipt",
            room_id: "!foo:bar",
            content: {
                "$event1:localhost": {
                    [ReceiptType.Read]: {
                        "@alice:localhost": { ts: 1 },
                        "@bob:localhost": { ts: 2 },
                    },
                    [ReceiptType.ReadPrivate]: {
                        "@dan:localhost": { ts: 4 },
                    },
                    "some.other.receipt.type": {
                        "@should_be_ignored:localhost": { key: "val" },
                    },
                },
            },
        };
        const receipt2 = {
            type: "m.receipt",
            room_id: "!foo:bar",
            content: {
                "$event2:localhost": {
                    [ReceiptType.Read]: {
                        "@bob:localhost": { ts: 2 }, // clobbers event1 receipt
                        "@charlie:localhost": { ts: 3 },
                    },
                },
            },
        };
        sa.accumulate(
            syncSkeleton({
                ephemeral: {
                    events: [receipt1],
                },
            }),
        );
        sa.accumulate(
            syncSkeleton({
                ephemeral: {
                    events: [receipt2],
                },
            }),
        );

        expect(sa.getJSON().roomsData.join["!foo:bar"].ephemeral.events.length).toEqual(1);
        expect(sa.getJSON().roomsData.join["!foo:bar"].ephemeral.events[0]).toEqual({
            type: "m.receipt",
            room_id: "!foo:bar",
            content: {
                "$event1:localhost": {
                    [ReceiptType.Read]: {
                        "@alice:localhost": { ts: 1 },
                    },
                    [ReceiptType.ReadPrivate]: {
                        "@dan:localhost": { ts: 4 },
                    },
                },
                "$event2:localhost": {
                    [ReceiptType.Read]: {
                        "@bob:localhost": { ts: 2 },
                        "@charlie:localhost": { ts: 3 },
                    },
                },
            },
        });
    });

    it("can handle large numbers of identical receipts", () => {
        const testSize = 1000; // Make this big to check performance (e.g. 10 million ~= 10s)

        const newReceipt = (ts: number) => {
            return {
                type: "m.receipt",
                room_id: "!foo:bar",
                content: {
                    "$event1:localhost": {
                        [ReceiptType.Read]: {
                            "@alice:localhost": { ts },
                        },
                    },
                },
            };
        };

        const receipts = [];
        for (let i = 0; i < testSize; i++) {
            receipts.push(newReceipt(testSize - i));
        }

        sa.accumulate(
            syncSkeleton({
                ephemeral: {
                    events: receipts,
                },
            }),
        );

        const events = sa.getJSON().roomsData.join["!foo:bar"].ephemeral.events;
        expect(events.length).toEqual(1);
        expect(events[0]).toEqual(newReceipt(1));
    });

    it("can handle large numbers of receipts for different users and events", () => {
        const testSize = 100; // Make this big to check performance (e.g. 1 million ~= 10s)

        const newReceipt = (ts: number) => {
            return {
                type: "m.receipt",
                room_id: "!foo:bar",
                content: {
                    [`$event${ts}:localhost`]: {
                        [ReceiptType.Read]: {
                            [`@alice${ts}:localhost`]: { ts },
                        },
                    },
                },
            };
        };

        const receipts = [];
        for (let i = 0; i < testSize; i++) {
            receipts.push(newReceipt(testSize - i));
        }

        sa.accumulate(
            syncSkeleton({
                ephemeral: {
                    events: receipts,
                },
            }),
        );

        const events = sa.getJSON().roomsData.join["!foo:bar"].ephemeral.events;
        expect(events.length).toEqual(1);
        expect(events[0]["content"]["$event1:localhost"]).toEqual({ "m.read": { "@alice1:localhost": { ts: 1 } } });
        expect(Object.keys(events[0]["content"]).length).toEqual(testSize);
    });

    it("should accumulate threaded read receipts", () => {
        const receipt1 = {
            type: "m.receipt",
            room_id: "!foo:bar",
            content: {
                "$event1:localhost": {
                    [ReceiptType.Read]: {
                        "@alice:localhost": { ts: 1, thread_id: "main" },
                    },
                },
            },
        };
        const receipt2 = {
            type: "m.receipt",
            room_id: "!foo:bar",
            content: {
                "$event2:localhost": {
                    [ReceiptType.Read]: {
                        "@alice:localhost": { ts: 2, thread_id: "$123" }, // does not clobbers event1 receipt
                    },
                },
            },
        };
        sa.accumulate(
            syncSkeleton({
                ephemeral: {
                    events: [receipt1],
                },
            }),
        );
        sa.accumulate(
            syncSkeleton({
                ephemeral: {
                    events: [receipt2],
                },
            }),
        );

        expect(sa.getJSON().roomsData.join["!foo:bar"].ephemeral.events.length).toEqual(1);
        expect(sa.getJSON().roomsData.join["!foo:bar"].ephemeral.events[0]).toEqual({
            type: "m.receipt",
            room_id: "!foo:bar",
            content: {
                "$event1:localhost": {
                    [ReceiptType.Read]: {
                        "@alice:localhost": { ts: 1, thread_id: "main" },
                    },
                },
                "$event2:localhost": {
                    [ReceiptType.Read]: {
                        "@alice:localhost": { ts: 2, thread_id: "$123" },
                    },
                },
            },
        });
    });

    describe("summary field", function () {
        function createSyncResponseWithSummary(summary: IRoomSummary): ISyncResponse {
            return {
                next_batch: "abc",
                rooms: {
                    invite: {},
                    leave: {},
                    join: {
                        "!foo:bar": {
                            account_data: { events: [] },
                            ephemeral: { events: [] },
                            unread_notifications: {},
                            state: {
                                events: [],
                            },
                            summary: summary,
                            timeline: {
                                events: [],
                                prev_batch: "something",
                            },
                        },
                    },
                },
            } as unknown as ISyncResponse;
        }

        afterEach(() => {
            jest.spyOn(global.Date, "now").mockRestore();
        });

        it("should copy summary properties", function () {
            sa.accumulate(
                createSyncResponseWithSummary({
                    "m.heroes": ["@alice:bar"],
                    "m.invited_member_count": 2,
                }),
            );
            const summary = sa.getJSON().roomsData.join["!foo:bar"].summary;
            expect(summary["m.invited_member_count"]).toEqual(2);
            expect(summary["m.heroes"]).toEqual(["@alice:bar"]);
        });

        it("should accumulate summary properties", function () {
            sa.accumulate(
                createSyncResponseWithSummary({
                    "m.heroes": ["@alice:bar"],
                    "m.invited_member_count": 2,
                }),
            );
            sa.accumulate(
                createSyncResponseWithSummary({
                    "m.heroes": ["@bob:bar"],
                    "m.joined_member_count": 5,
                }),
            );
            const summary = sa.getJSON().roomsData.join["!foo:bar"].summary;
            expect(summary["m.invited_member_count"]).toEqual(2);
            expect(summary["m.joined_member_count"]).toEqual(5);
            expect(summary["m.heroes"]).toEqual(["@bob:bar"]);
        });

        it("should correctly update summary properties to zero", function () {
            // When we receive updates of a summary property, the last of which is 0
            sa.accumulate(
                createSyncResponseWithSummary({
                    "m.heroes": ["@alice:bar"],
                    "m.invited_member_count": 2,
                }),
            );
            sa.accumulate(
                createSyncResponseWithSummary({
                    "m.heroes": ["@alice:bar"],
                    "m.invited_member_count": 0,
                }),
            );
            const summary = sa.getJSON().roomsData.join["!foo:bar"].summary;
            // Then we give an answer of 0
            expect(summary["m.invited_member_count"]).toEqual(0);
        });

        it("should return correctly adjusted age attributes", () => {
            const delta = 1000;
            const startingTs = 1000;

            jest.spyOn(global.Date, "now").mockReturnValue(startingTs);

            sa.accumulate(RES_WITH_AGE);

            jest.spyOn(global.Date, "now").mockReturnValue(startingTs + delta);

            const output = sa.getJSON();
            expect(output.roomsData.join["!foo:bar"].timeline.events[0].unsigned?.age).toEqual(
                RES_WITH_AGE.rooms.join["!foo:bar"].timeline.events[0].unsigned!.age! + delta,
            );
            expect(Object.keys(output.roomsData.join["!foo:bar"].timeline.events[0])).toEqual(
                Object.keys(RES_WITH_AGE.rooms.join["!foo:bar"].timeline.events[0]),
            );
        });

        it("should mangle age without adding extra keys", () => {
            sa.accumulate(RES_WITH_AGE);
            const output = sa.getJSON();
            expect(Object.keys(output.roomsData.join["!foo:bar"].timeline.events[0])).toEqual(
                Object.keys(RES_WITH_AGE.rooms.join["!foo:bar"].timeline.events[0]),
            );
        });

        it("should retrieve unread thread notifications", () => {
            sa.accumulate(RES_WITH_AGE);
            const output = sa.getJSON();
            expect(
                output.roomsData.join["!foo:bar"].unread_thread_notifications!["$143273582443PhrSn:example.org"],
            ).not.toBeUndefined();
        });
    });
});

function syncSkeleton(joinObj: Partial<IJoinedRoom>): ISyncResponse {
    joinObj = joinObj || {};
    return {
        next_batch: "abc",
        rooms: {
            join: {
                "!foo:bar": joinObj,
            },
        },
    } as unknown as ISyncResponse;
}

function msg(localpart: string, text: string) {
    return {
        event_id: "$" + Math.random(),
        content: {
            body: text,
        },
        origin_server_ts: 123456789,
        sender: "@" + localpart + ":localhost",
        type: "m.room.message",
    };
}

function member(localpart: string, membership: string) {
    return {
        event_id: "$" + Math.random(),
        content: {
            membership: membership,
        },
        origin_server_ts: 123456789,
        state_key: "@" + localpart + ":localhost",
        sender: "@" + localpart + ":localhost",
        type: "m.room.member",
    };
}
