/*
Copyright 2025 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IResultRoomEvents } from "matrix-js-sdk/src/matrix";

import eventSearch from "../../src/Searching";
import EventIndexPeg from "../../src/indexing/EventIndexPeg";
import { createTestClient } from "../test-utils";

describe("Searching", () => {
    const mockClient = createTestClient();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("localSearch", () => {
        it("removes state_key: null from search results", async () => {
            // Mock search results from Seshat that include state_key: null
            const mockSearchResults: IResultRoomEvents = {
                count: 2,
                results: [
                    {
                        rank: 1,
                        result: {
                            event_id: "$event1",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1234567890,
                            content: { body: "test message 1", msgtype: "m.text" },
                            // Seshat incorrectly includes state_key: null for non-state events
                            state_key: null,
                        } as any,
                        context: {
                            events_before: [
                                {
                                    event_id: "$before1",
                                    room_id: "!room:example.org",
                                    sender: "@user:example.org",
                                    type: "m.room.message",
                                    origin_server_ts: 1234567889,
                                    content: { body: "before message", msgtype: "m.text" },
                                    state_key: null,
                                } as any,
                            ],
                            events_after: [
                                {
                                    event_id: "$after1",
                                    room_id: "!room:example.org",
                                    sender: "@user:example.org",
                                    type: "m.room.message",
                                    origin_server_ts: 1234567891,
                                    content: { body: "after message", msgtype: "m.text" },
                                    state_key: null,
                                } as any,
                            ],
                            profile_info: {},
                        },
                    },
                    {
                        rank: 2,
                        result: {
                            event_id: "$event2",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1234567880,
                            content: { body: "test message 2", msgtype: "m.text" },
                            state_key: null,
                        } as any,
                        context: {
                            events_before: [],
                            events_after: [],
                            profile_info: {},
                        },
                    },
                ],
                highlights: ["test"],
            };

            // Mock EventIndex.search to return results with state_key: null
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue(mockSearchResults),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);

            // Mock crypto to indicate room is encrypted
            jest.spyOn(mockClient, "getCrypto").mockReturnValue({
                isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(true),
            } as any);

            // Perform search in an encrypted room
            const roomId = "!room:example.org";
            await eventSearch(mockClient, "test", roomId);

            // Verify that state_key: null was removed from the search arguments passed to search
            expect(mockEventIndex.search).toHaveBeenCalled();

            // Get the mock search results that were passed to processRoomEventsSearch
            // The state_key should have been deleted from the original results object
            const mainEventResult = mockSearchResults.results![0].result as unknown as Record<string, unknown>;
            expect(mainEventResult.state_key).toBeUndefined();

            const beforeEvent = mockSearchResults.results![0].context!.events_before![0] as unknown as Record<
                string,
                unknown
            >;
            expect(beforeEvent.state_key).toBeUndefined();

            const afterEvent = mockSearchResults.results![0].context!.events_after![0] as unknown as Record<
                string,
                unknown
            >;
            expect(afterEvent.state_key).toBeUndefined();

            const secondResult = mockSearchResults.results![1].result as unknown as Record<string, unknown>;
            expect(secondResult.state_key).toBeUndefined();
        });

        it("does not modify events without state_key: null", async () => {
            const mockSearchResults: IResultRoomEvents = {
                count: 1,
                results: [
                    {
                        rank: 1,
                        result: {
                            event_id: "$event1",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1234567890,
                            content: { body: "test message", msgtype: "m.text" },
                            // No state_key property at all (correct behavior)
                        } as any,
                        context: {
                            events_before: [],
                            events_after: [],
                            profile_info: {},
                        },
                    },
                ],
                highlights: ["test"],
            };

            const mockEventIndex = {
                search: jest.fn().mockResolvedValue(mockSearchResults),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);

            jest.spyOn(mockClient, "getCrypto").mockReturnValue({
                isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(true),
            } as any);

            const roomId = "!room:example.org";
            await eventSearch(mockClient, "test", roomId);

            // Verify state_key is still undefined (not accidentally set to something)
            const eventResult = mockSearchResults.results![0].result as unknown as Record<string, unknown>;
            expect("state_key" in eventResult).toBe(false);
        });

        it("handles missing context fields and empty result sets", async () => {
            const mockSearchResults: IResultRoomEvents = {
                count: 3,
                results: [
                    {
                        rank: 1,
                        result: {
                            event_id: "$event1",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1234567890,
                            content: { body: "test message", msgtype: "m.text" },
                            state_key: null,
                        } as any,
                        context: {
                            events_before: [{ event_id: "$before1", state_key: "not-null" } as any],
                            events_after: [{ event_id: "$after1", state_key: "not-null" } as any],
                            profile_info: {},
                        },
                    },
                    {
                        rank: 2,
                        result: {
                            event_id: "$event2",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1234567891,
                            content: { body: "test message 2", msgtype: "m.text" },
                            state_key: null,
                        } as any,
                        context: {
                            profile_info: {},
                        } as any,
                    },
                    {
                        rank: 3,
                        result: {
                            event_id: "$event3",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1234567892,
                            content: { body: "test message 3", msgtype: "m.text" },
                            state_key: null,
                        } as any,
                        context: undefined as any,
                    },
                ],
                highlights: ["test"],
            };

            const mockEventIndex = {
                search: jest
                    .fn()
                    .mockResolvedValueOnce(mockSearchResults)
                    .mockResolvedValueOnce({ count: 0, highlights: ["test"] } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);

            jest.spyOn(mockClient, "getCrypto").mockReturnValue({
                isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(true),
            } as any);

            const roomId = "!room:example.org";
            await eventSearch(mockClient, "test", roomId);
            await eventSearch(mockClient, "test", roomId);

            const firstMainEvent = mockSearchResults.results![0].result as unknown as Record<string, unknown>;
            expect(firstMainEvent.state_key).toBeUndefined();

            const beforeEvent = mockSearchResults.results![0].context!.events_before![0] as unknown as Record<
                string,
                unknown
            >;
            expect(beforeEvent.state_key).toBe("not-null");

            const afterEvent = mockSearchResults.results![0].context!.events_after![0] as unknown as Record<
                string,
                unknown
            >;
            expect(afterEvent.state_key).toBe("not-null");

            const secondMainEvent = mockSearchResults.results![1].result as unknown as Record<string, unknown>;
            expect(secondMainEvent.state_key).toBeUndefined();

            const thirdMainEvent = mockSearchResults.results![2].result as unknown as Record<string, unknown>;
            expect(thirdMainEvent.state_key).toBeUndefined();
        });

        it("filters out edit events (m.replace) from context events", async () => {
            // Scenario: User searches for "CCCCCCC" which is the content of an edit event
            // The context (events_before) contains a previous edit event "BBBBBB"
            // This should be filtered out to avoid showing edit history as "previous messages"
            const mockSearchResults: IResultRoomEvents = {
                count: 1,
                results: [
                    {
                        rank: 1,
                        result: {
                            event_id: "$edit2",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1234567892,
                            content: {
                                "body": "* CCCCCCC",
                                "msgtype": "m.text",
                                "m.new_content": {
                                    body: "CCCCCCC",
                                    msgtype: "m.text",
                                },
                                "m.relates_to": {
                                    rel_type: "m.replace",
                                    event_id: "$original",
                                },
                            },
                        } as any,
                        context: {
                            events_before: [
                                // This is a previous edit of the same message - should be filtered out
                                {
                                    event_id: "$edit1",
                                    room_id: "!room:example.org",
                                    sender: "@user:example.org",
                                    type: "m.room.message",
                                    origin_server_ts: 1234567891,
                                    content: {
                                        "body": "* BBBBBB",
                                        "msgtype": "m.text",
                                        "m.new_content": {
                                            body: "BBBBBB",
                                            msgtype: "m.text",
                                        },
                                        "m.relates_to": {
                                            rel_type: "m.replace",
                                            event_id: "$original",
                                        },
                                    },
                                } as any,
                                // This is a regular message - should NOT be filtered out
                                {
                                    event_id: "$regular",
                                    room_id: "!room:example.org",
                                    sender: "@other:example.org",
                                    type: "m.room.message",
                                    origin_server_ts: 1234567880,
                                    content: {
                                        body: "A regular message",
                                        msgtype: "m.text",
                                    },
                                } as any,
                            ],
                            events_after: [
                                // Edit event in events_after - should be filtered out
                                {
                                    event_id: "$edit3",
                                    room_id: "!room:example.org",
                                    sender: "@user:example.org",
                                    type: "m.room.message",
                                    origin_server_ts: 1234567893,
                                    content: {
                                        "body": "* DDDDDD",
                                        "msgtype": "m.text",
                                        "m.new_content": {
                                            body: "DDDDDD",
                                            msgtype: "m.text",
                                        },
                                        "m.relates_to": {
                                            rel_type: "m.replace",
                                            event_id: "$another",
                                        },
                                    },
                                } as any,
                            ],
                            profile_info: {},
                        },
                    },
                ],
                highlights: ["CCCCCCC"],
            };

            const mockEventIndex = {
                search: jest.fn().mockResolvedValue(mockSearchResults),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);

            jest.spyOn(mockClient, "getCrypto").mockReturnValue({
                isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(true),
            } as any);

            const roomId = "!room:example.org";
            await eventSearch(mockClient, "CCCCCCC", roomId);

            // Verify edit events were filtered from context
            const context = mockSearchResults.results![0].context!;

            // events_before should only contain the regular message, not the edit event
            expect(context.events_before).toHaveLength(1);
            expect((context.events_before![0] as any).event_id).toBe("$regular");

            // events_after should be empty (the only event was an edit)
            expect(context.events_after).toHaveLength(0);
        });

        it("preserves non-edit events in context", async () => {
            const mockSearchResults: IResultRoomEvents = {
                count: 1,
                results: [
                    {
                        rank: 1,
                        result: {
                            event_id: "$event1",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1234567890,
                            content: { body: "search result", msgtype: "m.text" },
                        } as any,
                        context: {
                            events_before: [
                                {
                                    event_id: "$before1",
                                    room_id: "!room:example.org",
                                    sender: "@user:example.org",
                                    type: "m.room.message",
                                    origin_server_ts: 1234567889,
                                    content: { body: "before message", msgtype: "m.text" },
                                } as any,
                            ],
                            events_after: [
                                {
                                    event_id: "$after1",
                                    room_id: "!room:example.org",
                                    sender: "@user:example.org",
                                    type: "m.room.message",
                                    origin_server_ts: 1234567891,
                                    content: { body: "after message", msgtype: "m.text" },
                                } as any,
                            ],
                            profile_info: {},
                        },
                    },
                ],
                highlights: ["search"],
            };

            const mockEventIndex = {
                search: jest.fn().mockResolvedValue(mockSearchResults),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);

            jest.spyOn(mockClient, "getCrypto").mockReturnValue({
                isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(true),
            } as any);

            const roomId = "!room:example.org";
            await eventSearch(mockClient, "search", roomId);

            // Verify non-edit events are preserved in context
            const context = mockSearchResults.results![0].context!;
            expect(context.events_before).toHaveLength(1);
            expect(context.events_after).toHaveLength(1);
        });
    });
});
