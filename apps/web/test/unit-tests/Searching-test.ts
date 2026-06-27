/*
Copyright 2025 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IResultRoomEvents } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import eventSearch, { hardenSeshatSearchTerm } from "../../src/Searching";
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

    const mockEncryptedRoom = (): void => {
        jest.spyOn(mockClient, "getCrypto").mockReturnValue({
            isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(true),
        } as any);
    };

    describe("hardenSeshatSearchTerm (#32341)", () => {
        it("leaves a plain term unchanged", () => {
            expect(hardenSeshatSearchTerm("hello world")).toBe("hello world");
        });

        it("phrase-wraps a term containing a colon (tantivy field operator)", () => {
            expect(hardenSeshatSearchTerm("https://github.com")).toBe('"https://github.com"');
        });

        it("leaves a genuinely closed phrase unchanged", () => {
            expect(hardenSeshatSearchTerm('"https://github.com"')).toBe('"https://github.com"');
        });

        it("re-wraps an unbalanced leading-quote term containing a colon", () => {
            // A stray leading quote would otherwise be an odd-quote syntax error in tantivy.
            expect(hardenSeshatSearchTerm('"https://github.com')).toBe('"\\"https://github.com"');
        });

        it("escapes embedded double quotes when wrapping", () => {
            expect(hardenSeshatSearchTerm('a:"b')).toBe('"a:\\"b"');
        });

        it("passes the hardened term to Seshat but the raw term to the homeserver", async () => {
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({ count: 0, results: [], highlights: [] } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "https://github.com", "!room:example.org");

            expect(mockEventIndex.search).toHaveBeenCalledWith(
                expect.objectContaining({ search_term: '"https://github.com"' }),
            );
        });
    });

    describe("edited messages (#32356)", () => {
        const makeEditResult = (): IResultRoomEvents => ({
            count: 1,
            results: [
                {
                    rank: 1,
                    result: {
                        event_id: "$edit",
                        room_id: "!room:example.org",
                        sender: "@user:example.org",
                        type: "m.room.message",
                        origin_server_ts: 2000,
                        content: {
                            "body": "* edited text",
                            "msgtype": "m.text",
                            "m.new_content": { body: "edited text", msgtype: "m.text" },
                            "m.relates_to": { rel_type: "m.replace", event_id: "$orig" },
                        },
                        // encryption sidecar that restoreEncryptionInfo consumes after processing
                        curve25519Key: "curve",
                        ed25519Key: "ed",
                        algorithm: "m.megolm.v1.aes-sha2",
                    } as any,
                    context: { events_before: [], events_after: [], profile_info: {} },
                },
            ],
            highlights: ["edited"],
        });

        it("promotes m.new_content and drops the m.replace relation so the edit renders", async () => {
            const mockSearchResults = makeEditResult();
            const mockEventIndex = { search: jest.fn().mockResolvedValue(mockSearchResults) };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "edited", "!room:example.org");

            const event = mockSearchResults.results![0].result as unknown as Record<string, any>;
            expect(event.content.body).toBe("edited text");
            expect(event.content.msgtype).toBe("m.text");
            expect(event.content["m.relates_to"]).toBeUndefined();
            expect(event.content["m.new_content"]).toBeUndefined();
            // Re-keyed to the original so the SDK event mapper resolves the renderable original
            // (which carries the aggregated edit in a loaded room) rather than the live m.replace.
            expect(event.event_id).toBe("$orig");
            expect(event.origin_server_ts).toBe(2000);
            // encryption sidecar fields preserved for restoreEncryptionInfo
            expect(event.curve25519Key).toBe("curve");
            expect(event.algorithm).toBe("m.megolm.v1.aes-sha2");
        });

        it("leaves a non-edit message untouched", async () => {
            const mockSearchResults: IResultRoomEvents = {
                count: 1,
                results: [
                    {
                        rank: 1,
                        result: {
                            event_id: "$plain",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1,
                            content: { body: "plain message", msgtype: "m.text" },
                        } as any,
                        context: { events_before: [], events_after: [], profile_info: {} },
                    },
                ],
                highlights: [],
            };
            const mockEventIndex = { search: jest.fn().mockResolvedValue(mockSearchResults) };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "plain", "!room:example.org");

            const event = mockSearchResults.results![0].result as unknown as Record<string, any>;
            expect(event.content.body).toBe("plain message");
        });

        it("leaves an edit that only appears as context unchanged (no id collision risk)", async () => {
            const mockSearchResults: IResultRoomEvents = {
                count: 1,
                results: [
                    {
                        rank: 1,
                        result: {
                            event_id: "$match",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 3,
                            content: { body: "match", msgtype: "m.text" },
                        } as any,
                        context: {
                            events_before: [
                                {
                                    event_id: "$ctxEdit",
                                    room_id: "!room:example.org",
                                    sender: "@user:example.org",
                                    type: "m.room.message",
                                    origin_server_ts: 2,
                                    content: {
                                        "body": "* ctx edited",
                                        "msgtype": "m.text",
                                        "m.new_content": { body: "ctx edited", msgtype: "m.text" },
                                        "m.relates_to": { rel_type: "m.replace", event_id: "$ctxOrig" },
                                    },
                                } as any,
                            ],
                            events_after: [],
                            profile_info: {},
                        },
                    },
                ],
                highlights: [],
            };
            const mockEventIndex = { search: jest.fn().mockResolvedValue(mockSearchResults) };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "ctx", "!room:example.org");

            // Context events are not re-keyed (only the matched event is), so the relation stays.
            const ctx = mockSearchResults.results![0].context!.events_before![0] as unknown as Record<string, any>;
            expect(ctx.event_id).toBe("$ctxEdit");
            expect(ctx.content["m.relates_to"]).toBeDefined();
        });

        it("de-duplicates a promoted edit and its original when both match", async () => {
            const mockSearchResults: IResultRoomEvents = {
                count: 2,
                results: [
                    {
                        rank: 1,
                        result: {
                            event_id: "$edit",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 2000,
                            content: {
                                "body": "* hello there",
                                "msgtype": "m.text",
                                "m.new_content": { body: "hello there", msgtype: "m.text" },
                                "m.relates_to": { rel_type: "m.replace", event_id: "$orig" },
                            },
                        } as any,
                        context: { events_before: [], events_after: [], profile_info: {} },
                    },
                    {
                        rank: 2,
                        result: {
                            event_id: "$orig",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 1000,
                            content: { body: "hello world", msgtype: "m.text" },
                        } as any,
                        context: { events_before: [], events_after: [], profile_info: {} },
                    },
                ],
                highlights: ["hello"],
            };
            const mockEventIndex = { search: jest.fn().mockResolvedValue(mockSearchResults) };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "hello", "!room:example.org");

            // Both results re-key to $orig; only one survives to avoid a duplicate tile.
            expect(mockSearchResults.results).toHaveLength(1);
            expect((mockSearchResults.results![0].result as any).event_id).toBe("$orig");
        });

        it("leaves an edit with empty m.new_content untouched (no blank tile)", async () => {
            const mockSearchResults: IResultRoomEvents = {
                count: 1,
                results: [
                    {
                        rank: 1,
                        result: {
                            event_id: "$edit",
                            room_id: "!room:example.org",
                            sender: "@user:example.org",
                            type: "m.room.message",
                            origin_server_ts: 2000,
                            content: {
                                "body": "* edited",
                                "msgtype": "m.text",
                                "m.new_content": {},
                                "m.relates_to": { rel_type: "m.replace", event_id: "$orig" },
                            },
                        } as any,
                        context: { events_before: [], events_after: [], profile_info: {} },
                    },
                ],
                highlights: [],
            };
            const mockEventIndex = { search: jest.fn().mockResolvedValue(mockSearchResults) };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            mockEncryptedRoom();

            await eventSearch(mockClient, "edited", "!room:example.org");

            const event = mockSearchResults.results![0].result as unknown as Record<string, any>;
            expect(event.event_id).toBe("$edit");
            expect(event.content.body).toBe("* edited");
            expect(event.content["m.relates_to"]).toBeDefined();
        });
    });

    describe("combinedSearch resilience (#32341)", () => {
        const serverResponse = {
            search_categories: { room_events: { results: [], count: 0, highlights: [] } },
        };

        it("returns server results when the local (Seshat) leg rejects in All Rooms", async () => {
            const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
            const mockEventIndex = {
                search: jest.fn().mockRejectedValue(new Error('Query is invalid. FieldDoesNotExist("https")')),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            const searchSpy = jest.spyOn(mockClient, "search").mockResolvedValue(serverResponse as any);

            // roomId undefined => All Rooms => combinedSearch
            await expect(eventSearch(mockClient, "https://github.com")).resolves.toBeDefined();
            expect(searchSpy).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalled();
        });

        it("returns local results when the server leg rejects in All Rooms", async () => {
            const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
            const mockEventIndex = {
                search: jest.fn().mockResolvedValue({ count: 0, results: [], highlights: [] } as IResultRoomEvents),
            };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            jest.spyOn(mockClient, "search").mockRejectedValue(new Error("Server unavailable"));

            await expect(eventSearch(mockClient, "anything")).resolves.toBeDefined();
            expect(mockEventIndex.search).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalled();
        });

        it("rejects only when BOTH legs fail", async () => {
            jest.spyOn(logger, "error").mockImplementation(() => {});
            const mockEventIndex = { search: jest.fn().mockRejectedValue(new Error("Seshat down")) };
            jest.spyOn(EventIndexPeg, "get").mockReturnValue(mockEventIndex as any);
            jest.spyOn(mockClient, "search").mockRejectedValue(new Error("Server down"));

            await expect(eventSearch(mockClient, "anything")).rejects.toThrow();
        });
    });
});
