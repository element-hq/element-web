/*
Copyright 2025 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IResultRoomEvents, SearchOrderBy } from "matrix-js-sdk/src/matrix";

import eventSearch, { searchPagination } from "../../src/Searching";
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
    });

    describe("from:/sender filter", () => {
        const rawResult = (sender: string, eventId: string, ts: number): any => ({
            rank: 1,
            result: {
                event_id: eventId,
                room_id: "!room:example.org",
                sender,
                type: "m.room.message",
                origin_server_ts: ts,
                content: { body: "hello", msgtype: "m.text" },
            },
            context: { events_before: [], events_after: [], profile_info: {} },
        });

        // Pretend the searched room is encrypted so eventSearch takes the local (Seshat) path.
        const mockEncryptedRoom = (): void => {
            jest.spyOn(mockClient, "getCrypto").mockReturnValue({
                isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(true),
            } as any);
        };

        const captureProcessed = (): { get: () => any } => {
            let captured: any;
            jest.spyOn(mockClient, "processRoomEventsSearch").mockImplementation(((sr: any, response: any) => {
                captured = response;
                return { ...sr, results: [], highlights: [] };
            }) as any);
            return { get: () => captured };
        };

        it("sets filter.senders on the homeserver search body when senders are given", async () => {
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(null); // no local index -> server-side path
            const searchSpy = jest.spyOn(mockClient, "search").mockResolvedValue({
                search_categories: { room_events: { results: [], count: 0, highlights: [] } },
            } as any);

            await eventSearch(mockClient, "hello", "!room:example.org", undefined, ["@alice:example.org"]);

            const body = (searchSpy.mock.calls[0][0] as any).body;
            expect(body.search_categories.room_events.filter.senders).toEqual(["@alice:example.org"]);
            // The room scope is preserved alongside the new sender scope.
            expect(body.search_categories.room_events.filter.rooms).toEqual(["!room:example.org"]);
        });

        it("carries filter.senders into the stored _query so server-side pagination keeps it", async () => {
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(null);
            jest.spyOn(mockClient, "search").mockResolvedValue({
                search_categories: { room_events: { results: [], count: 0, highlights: [] } },
            } as any);
            jest.spyOn(mockClient, "processRoomEventsSearch").mockImplementation(((sr: any) => sr) as any);

            const result: any = await eventSearch(mockClient, "hello", "!room:example.org", undefined, [
                "@alice:example.org",
            ]);

            expect(result._query.search_categories.room_events.filter.senders).toEqual(["@alice:example.org"]);
        });

        it("over-fetches the Seshat limit when a sender filter is active", async () => {
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({ count: 0, results: [], highlights: [] } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "hello", "!room:example.org", undefined, ["@bob:example.org"]);

            expect(mockEventIndex.search.mock.calls[0][0].limit).toBeGreaterThan(10);
        });

        it("keeps the default Seshat limit when no sender filter is given", async () => {
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({ count: 0, results: [], highlights: [] } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "hello", "!room:example.org");

            expect(mockEventIndex.search.mock.calls[0][0].limit).toBe(10);
        });

        it("post-filters Seshat results to the selected sender", async () => {
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({
                    count: 2,
                    results: [rawResult("@alice:example.org", "$a", 200), rawResult("@bob:example.org", "$b", 100)],
                    highlights: [],
                } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();
            const processed = captureProcessed();

            await eventSearch(mockClient, "hello", "!room:example.org", undefined, ["@bob:example.org"]);

            const senders = processed.get().search_categories.room_events.results.map((r: any) => r.result.sender);
            expect(senders).toEqual(["@bob:example.org"]);
        });

        it("returns an empty result without throwing when the sender has no matches", async () => {
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({
                    count: 1,
                    results: [rawResult("@alice:example.org", "$a", 200)],
                    highlights: [],
                } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();
            const processed = captureProcessed();

            await expect(
                eventSearch(mockClient, "hello", "!room:example.org", undefined, ["@nobody:example.org"]),
            ).resolves.toBeDefined();

            expect(processed.get().search_categories.room_events.results).toEqual([]);
        });

        it("re-applies the sender post-filter on Seshat pagination", async () => {
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({
                    count: 2,
                    results: [rawResult("@alice:example.org", "$a2", 80), rawResult("@bob:example.org", "$b2", 70)],
                    highlights: [],
                } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            const processed = captureProcessed();

            const searchResult: any = {
                results: [],
                highlights: [],
                seshatQuery: { search_term: "hello", room_id: "!room:example.org", limit: 50, next_batch: "n1" },
                senderFilter: ["@bob:example.org"],
            };

            await searchPagination(mockClient, searchResult);

            const senders = processed.get().search_categories.room_events.results.map((r: any) => r.result.sender);
            expect(senders).toEqual(["@bob:example.org"]);
        });

        it("filters both the homeserver and Seshat legs for an all-rooms search", async () => {
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({
                    count: 2,
                    results: [rawResult("@alice:example.org", "$e", 90), rawResult("@bob:example.org", "$f", 80)],
                    highlights: [],
                } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            const searchSpy = jest.spyOn(mockClient, "search").mockResolvedValue({
                search_categories: { room_events: { results: [], count: 0, highlights: [] } },
            } as any);
            const processed = captureProcessed();

            // roomId undefined => All Rooms => combinedSearch
            await eventSearch(mockClient, "hello", undefined, undefined, ["@bob:example.org"]);

            const body = (searchSpy.mock.calls[0][0] as any).body;
            expect(body.search_categories.room_events.filter.senders).toEqual(["@bob:example.org"]);
            const senders = processed.get().search_categories.room_events.results.map((r: any) => r.result.sender);
            expect(senders).toEqual(["@bob:example.org"]);
        });

        it("does not set filter.senders on the homeserver body when no sender filter is given", async () => {
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(null);
            const searchSpy = jest.spyOn(mockClient, "search").mockResolvedValue({
                search_categories: { room_events: { results: [], count: 0, highlights: [] } },
            } as any);

            await eventSearch(mockClient, "hello", "!room:example.org");

            const body = (searchSpy.mock.calls[0][0] as any).body;
            expect(body.search_categories.room_events.filter.senders).toBeUndefined();
        });

        it("treats an empty senders array as no filter (the cleared-filter case)", async () => {
            // The Clear action passes []; it must behave exactly like undefined — no homeserver filter, no Seshat
            // over-fetch, no post-filter dropping results.
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({
                    count: 2,
                    results: [rawResult("@alice:example.org", "$a", 200), rawResult("@bob:example.org", "$b", 100)],
                    highlights: [],
                } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();
            const processed = captureProcessed();

            await eventSearch(mockClient, "hello", "!room:example.org", undefined, []);

            // Default Seshat limit (no over-fetch) and every sender preserved (no post-filter).
            expect(mockEventIndex.search.mock.calls[0][0].limit).toBe(10);
            const senders = processed.get().search_categories.room_events.results.map((r: any) => r.result.sender);
            expect(senders).toEqual(["@alice:example.org", "@bob:example.org"]);
        });
    });

    describe("relevance-vs-recency order", () => {
        // Pretend the searched room is encrypted so eventSearch takes the local (Seshat) path.
        const mockEncryptedRoom = (): void => {
            jest.spyOn(mockClient, "getCrypto").mockReturnValue({
                isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(true),
            } as any);
        };

        it("sets order_by: Rank on the homeserver body when relevance order is requested", async () => {
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(null); // no local index -> server-side path
            const searchSpy = jest.spyOn(mockClient, "search").mockResolvedValue({
                search_categories: { room_events: { results: [], count: 0, highlights: [] } },
            } as any);

            await eventSearch(mockClient, "hello", "!room:example.org", undefined, undefined, SearchOrderBy.Rank);

            const body = (searchSpy.mock.calls[0][0] as any).body;
            expect(body.search_categories.room_events.order_by).toBe(SearchOrderBy.Rank);
        });

        it("defaults the homeserver body to Recent order", async () => {
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(null);
            const searchSpy = jest.spyOn(mockClient, "search").mockResolvedValue({
                search_categories: { room_events: { results: [], count: 0, highlights: [] } },
            } as any);

            await eventSearch(mockClient, "hello", "!room:example.org");

            const body = (searchSpy.mock.calls[0][0] as any).body;
            expect(body.search_categories.room_events.order_by).toBe(SearchOrderBy.Recent);
        });

        it("carries order_by into the stored _query so server-side pagination keeps the order", async () => {
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(null);
            jest.spyOn(mockClient, "search").mockResolvedValue({
                search_categories: { room_events: { results: [], count: 0, highlights: [] } },
            } as any);
            jest.spyOn(mockClient, "processRoomEventsSearch").mockImplementation(((sr: any) => sr) as any);

            const result: any = await eventSearch(
                mockClient,
                "hello",
                "!room:example.org",
                undefined,
                undefined,
                SearchOrderBy.Rank,
            );

            expect(result._query.search_categories.room_events.order_by).toBe(SearchOrderBy.Rank);
        });

        it("orders a single encrypted room by Seshat relevance (order_by_recency false) under relevance order", async () => {
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({ count: 0, results: [], highlights: [] } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "hello", "!room:example.org", undefined, undefined, SearchOrderBy.Rank);

            expect(mockEventIndex.search.mock.calls[0][0].order_by_recency).toBe(false);
        });

        it("keeps a single encrypted room ordered by recency (order_by_recency true) by default", async () => {
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({ count: 0, results: [], highlights: [] } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "hello", "!room:example.org");

            expect(mockEventIndex.search.mock.calls[0][0].order_by_recency).toBe(true);
        });

        it("keeps recency order on both legs of an all-rooms search even when relevance is requested", async () => {
            // The combined (All-rooms) path merges the two legs with a sliding-window cache that only preserves
            // global order when both legs are recency-sorted, so a relevance order must NOT propagate to either leg
            // (deferred until the merge is redesigned). The single-source paths above honour it; the merged path
            // stays recency by construction.
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({ count: 0, results: [], highlights: [] } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            const searchSpy = jest.spyOn(mockClient, "search").mockResolvedValue({
                search_categories: { room_events: { results: [], count: 0, highlights: [] } },
            } as any);
            jest.spyOn(mockClient, "processRoomEventsSearch").mockImplementation(((sr: any) => ({
                ...sr,
                results: [],
                highlights: [],
            })) as any);

            // roomId undefined => All Rooms => combinedSearch.
            await eventSearch(mockClient, "hello", undefined, undefined, undefined, SearchOrderBy.Rank);

            const body = (searchSpy.mock.calls[0][0] as any).body;
            expect(body.search_categories.room_events.order_by).toBe(SearchOrderBy.Recent);
            expect(mockEventIndex.search.mock.calls[0][0].order_by_recency).toBe(true);
        });
    });
});
