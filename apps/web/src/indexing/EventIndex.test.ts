/*
Copyright 2025 The Matrix.org Foundation C.I.C.

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

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import {
    Direction,
    type MatrixClient,
    type IEvent,
    MatrixEvent,
    Room,
    RoomEvent,
    EventType,
    ClientEvent,
    SyncState,
} from "matrix-js-sdk/src/matrix";
import { emitPromise, getMockClientWithEventEmitter, mockClientMethodsRooms, mockPlatformPeg } from "test-utils";

import EventIndex from "./EventIndex.ts";
import BaseEventIndexManager from "./BaseEventIndexManager.ts";
import { type ICrawlerCheckpoint, type IIndexedEvent } from "./BaseEventIndexManager.ts";
import SettingsStore from "../settings/SettingsStore.ts";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("EventIndex", () => {
    it("crawls through the loaded checkpoints", async () => {
        const mockIndexingManager = {
            loadCheckpoints: vi.fn(),
            removeCrawlerCheckpoint: vi.fn(),
            isEventIndexEmpty: vi.fn().mockResolvedValue(false),
        } as any as Mocked<BaseEventIndexManager>;
        mockPlatformPeg({ getEventIndexingManager: () => mockIndexingManager });

        const room1 = { roomId: "!room1:id", getRetentionMaxLifetime: () => null } as any as Room;
        const room2 = { roomId: "!room2:id", getRetentionMaxLifetime: () => null } as any as Room;
        const mockClient = getMockClientWithEventEmitter({
            getEventMapper: () => (obj: Partial<IEvent>) => new MatrixEvent(obj),
            createMessagesRequest: vi.fn(),
            ...mockClientMethodsRooms([room1, room2]),
        });

        vi.spyOn(SettingsStore, "getValueAt").mockImplementation((_level, settingName): any => {
            if (settingName === "crawlerSleepTime") return 0;
            return undefined;
        });

        mockIndexingManager.loadCheckpoints.mockResolvedValue([
            { roomId: "!room1:id", token: "token1", direction: Direction.Backward } as ICrawlerCheckpoint,
            { roomId: "!room2:id", token: "token2", direction: Direction.Forward } as ICrawlerCheckpoint,
        ]);

        const indexer = new EventIndex();
        await indexer.init();
        let changedCheckpointPromise = emitPromise(indexer, "changedCheckpoint") as Promise<Room>;

        indexer.startCrawler();

        // Mock out the /messags request, and wait for the crawler to hit the first room
        const mock1 = mockCreateMessagesRequest(mockClient);
        let changedCheckpoint = await changedCheckpointPromise;
        expect(changedCheckpoint.roomId).toEqual("!room1:id");

        await mock1.called;
        expect(mockClient.createMessagesRequest).toHaveBeenCalledWith("!room1:id", "token1", 100, "b");

        // Continue, and wait for the crawler to hit the second room
        changedCheckpointPromise = emitPromise(indexer, "changedCheckpoint") as Promise<Room>;
        mock1.resolve({ chunk: [] });
        changedCheckpoint = await changedCheckpointPromise;
        expect(changedCheckpoint.roomId).toEqual("!room2:id");

        // Mock out the /messages request again, and wait for it to be called
        const mock2 = mockCreateMessagesRequest(mockClient);
        await mock2.called;
        expect(mockClient.createMessagesRequest).toHaveBeenCalledWith("!room2:id", "token2", 100, "f");
        indexer.stopCrawler();
    });

    it("adds checkpoints for the encrypted rooms after the first sync", async () => {
        const mockIndexingManager = {
            loadCheckpoints: vi.fn().mockResolvedValue([]),
            isEventIndexEmpty: vi.fn().mockResolvedValue(true),
            addCrawlerCheckpoint: vi.fn(),
            removeCrawlerCheckpoint: vi.fn(),
            commitLiveEvents: vi.fn(),
        } as any as Mocked<BaseEventIndexManager>;
        mockPlatformPeg({ getEventIndexingManager: () => mockIndexingManager });

        const room1 = {
            roomId: "!room1:id",
            getRetentionMaxLifetime: () => null,
            getLiveTimeline: () => ({
                getPaginationToken: () => "token1",
            }),
        } as any as Room;
        const room2 = {
            roomId: "!room2:id",
            getRetentionMaxLifetime: () => null,
            getLiveTimeline: () => ({
                getPaginationToken: () => "token2",
            }),
        } as any as Room;
        const mockCrypto = {
            isEncryptionEnabledInRoom: vi.fn().mockResolvedValue(true),
        };
        const mockClient = getMockClientWithEventEmitter({
            getEventMapper: () => (obj: Partial<IEvent>) => new MatrixEvent(obj),
            createMessagesRequest: vi.fn(),
            getCrypto: () => mockCrypto as any,
            ...mockClientMethodsRooms([room1, room2]),
        });

        const commitLiveEventsCalled = Promise.withResolvers<void>();
        mockIndexingManager.commitLiveEvents.mockImplementation(async () => {
            commitLiveEventsCalled.resolve();
        });

        const indexer = new EventIndex();
        await indexer.init();

        // During the first sync, some events are added to the index, meaning that `isEventIndexEmpty` will now be false.
        mockIndexingManager.isEventIndexEmpty.mockResolvedValue(false);

        // The first sync completes:
        mockClient.emit(ClientEvent.Sync, SyncState.Syncing, null, {});

        // Wait for `commitLiveEvents` to be called, by which time the checkpoints should have been added.
        await commitLiveEventsCalled.promise;
        expect(mockIndexingManager.addCrawlerCheckpoint).toHaveBeenCalledTimes(4);
        expect(mockIndexingManager.addCrawlerCheckpoint).toHaveBeenCalledWith({
            roomId: "!room1:id",
            token: "token1",
            direction: Direction.Backward,
            fullCrawl: true,
        });
        expect(mockIndexingManager.addCrawlerCheckpoint).toHaveBeenCalledWith({
            roomId: "!room1:id",
            token: "token1",
            direction: Direction.Forward,
        });
        expect(mockIndexingManager.addCrawlerCheckpoint).toHaveBeenCalledWith({
            roomId: "!room2:id",
            token: "token2",
            direction: Direction.Backward,
            fullCrawl: true,
        });
        expect(mockIndexingManager.addCrawlerCheckpoint).toHaveBeenCalledWith({
            roomId: "!room2:id",
            token: "token2",
            direction: Direction.Forward,
        });
        indexer.stopCrawler();
    });
});

describe("EventIndex retention", () => {
    let indexer: EventIndex;
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(Date, "now").mockReturnValue(2000);
        vi.spyOn(SettingsStore, "getValueAt").mockReturnValue(100);
    });
    afterEach(async () => {
        await indexer.close();
        vi.useRealTimers();
    });

    function setup(maxLifetime: number | null = 1000) {
        const manager = new (class extends BaseEventIndexManager {
            public loadCheckpoints = vi.fn<BaseEventIndexManager["loadCheckpoints"]>().mockResolvedValue([]);
            public isEventIndexEmpty = vi.fn().mockResolvedValue(false);
            public closeEventIndex = vi.fn().mockResolvedValue(undefined);
            public commitLiveEvents = vi.fn().mockResolvedValue(undefined);
            public addEventToIndex = vi.fn<BaseEventIndexManager["addEventToIndex"]>().mockResolvedValue(undefined);
            public removeCrawlerCheckpoint = vi.fn().mockResolvedValue(undefined);
            public loadEventIds = vi.fn<BaseEventIndexManager["loadEventIds"]>().mockResolvedValue([]);
            public deleteEvent = vi.fn<BaseEventIndexManager["deleteEvent"]>().mockResolvedValue(true);
            public addHistoricEvents = vi.fn<BaseEventIndexManager["addHistoricEvents"]>().mockResolvedValue(false);
        })();
        mockPlatformPeg({ getEventIndexingManager: () => manager });
        const client = getMockClientWithEventEmitter({
            getEventMapper: () => (event: Partial<IEvent>) => new MatrixEvent(event),
            createMessagesRequest: vi.fn().mockResolvedValue({ chunk: [], start: "next" }),
            decryptEventIfNeeded: vi.fn().mockResolvedValue(undefined),
            isRoomEncrypted: vi.fn().mockReturnValue(true),
            getRooms: vi.fn(),
            getRoom: vi.fn(),
        });
        const room = new Room("!room:example.org", client, "@user:example.org");
        vi.spyOn(room, "getRetentionMaxLifetime").mockReturnValue(maxLifetime);
        client.getRooms.mockReturnValue([room]);
        client.getRoom.mockReturnValue(room);
        indexer = new EventIndex();
        const changeRetention = (lifetime: number | null): void => {
            vi.mocked(room.getRetentionMaxLifetime).mockReturnValue(lifetime);
            client.emit(RoomEvent.RetentionChanged, room, lifetime);
        };
        const emitLiveEvent = (event: MatrixEvent): void => {
            client.emit(RoomEvent.Timeline, event, room, false, false, {
                liveEvent: true,
                timeline: room.getLiveTimeline(),
            });
        };
        return { manager, client, room, changeRetention, emitLiveEvent };
    }

    async function startCrawler(advanceMs = 0): Promise<void> {
        await indexer.init();
        indexer.startCrawler();
        await vi.advanceTimersByTimeAsync(advanceMs);
    }

    it("should not index expired backfilled messages", async () => {
        const { manager, client, room } = setup();
        const checkpoint = { roomId: room.roomId, token: "start", direction: Direction.Backward, fullCrawl: false };
        manager.loadCheckpoints.mockResolvedValue([checkpoint]);
        const chunk = [
            { event_id: "$expired", type: EventType.RoomMessage, content: { msgtype: "m.text", body: "old" } },
            { event_id: "$state", type: EventType.RoomName, state_key: "", content: { name: "old" } },
            {
                event_id: "$recent",
                origin_server_ts: 1001,
                type: EventType.RoomMessage,
                content: { msgtype: "m.text", body: "new" },
            },
        ].map((event) => ({ origin_server_ts: 999, ...event, room_id: room.roomId, sender: "@user:example.org" }));
        client.createMessagesRequest.mockResolvedValueOnce({ chunk, start: "start", end: "next" });
        client.createMessagesRequest.mockResolvedValueOnce({ chunk: [chunk[2]], start: "next", end: "last" });
        manager.addHistoricEvents.mockResolvedValueOnce(true);
        await startCrawler(200);
        expect(manager.addHistoricEvents.mock.calls[0][0].map(({ event }) => event.event_id)).toEqual([
            "$state",
            "$recent",
        ]);
        expect(manager.addHistoricEvents.mock.calls[1][0].map(({ event }) => event.event_id)).toEqual(["$recent"]);
        expect(client.createMessagesRequest).toHaveBeenCalledTimes(2);
    });

    it("should sweep multiple pages while keeping state, boundary and recent events", async () => {
        const { manager } = setup();
        const kept: IIndexedEvent[] = [
            { eventId: "$name", type: "m.room.name", serverTs: 999 },
            { eventId: "$topic", type: "m.room.topic", serverTs: 999 },
            { eventId: "$boundary", type: "m.room.message", serverTs: 1000 },
            { eventId: "$recent", type: "m.room.message", serverTs: 1001 },
        ];
        let events: IIndexedEvent[] = Array.from({ length: 150 }, (_, i) => ({
            eventId: `$expired${i}`,
            type: "m.room.message",
            serverTs: 999,
        }));
        events.splice(50, 0, ...kept.slice(0, 2));
        events.push(...kept.slice(2));
        manager.loadEventIds.mockImplementation(async ({ fromEvent, limit }) => {
            const cursor = fromEvent ? events.findIndex((event) => event.eventId === fromEvent) : -1;
            return events.slice(cursor + 1, cursor + 1 + limit);
        });
        manager.deleteEvent.mockImplementation(async (id) => {
            events = events.filter((event) => event.eventId !== id);
            return true;
        });
        await startCrawler();
        expect(manager.deleteEvent).toHaveBeenCalledTimes(150);
        expect(events).toEqual(kept);
    });

    it("should skip rooms without a policy and sweep when retention changes", async () => {
        const { manager, changeRetention } = setup(null);
        await startCrawler();
        expect(manager.loadEventIds).not.toHaveBeenCalled();
        changeRetention(1000);
        await vi.advanceTimersByTimeAsync(0);
        expect(manager.loadEventIds).toHaveBeenCalledTimes(1);
    });

    it.each([null, 2000])("should stop deleting after retention changes to %s", async (lifetime) => {
        const { manager, changeRetention } = setup();
        const deletion = Promise.withResolvers<boolean>();
        manager.loadEventIds.mockResolvedValueOnce([
            { eventId: "$first", type: "m.room.message", serverTs: 500 },
            { eventId: "$second", type: "m.room.message", serverTs: 600 },
        ]);
        manager.deleteEvent.mockReturnValueOnce(deletion.promise);
        await startCrawler();
        expect(manager.deleteEvent).toHaveBeenCalledExactlyOnceWith("$first");
        changeRetention(lifetime);
        deletion.resolve(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(manager.deleteEvent).toHaveBeenCalledTimes(1);
    });

    it("should not index expired live messages", async () => {
        const { manager, room, emitLiveEvent } = setup();
        await startCrawler();
        const event = (fields: Partial<IEvent>): MatrixEvent =>
            new MatrixEvent({ room_id: room.roomId, origin_server_ts: 500, sender: "@user:example.org", ...fields });
        emitLiveEvent(
            event({ event_id: "$expired", type: EventType.RoomMessage, content: { msgtype: "m.text", body: "old" } }),
        );
        emitLiveEvent(event({ event_id: "$state", type: EventType.RoomName, state_key: "", content: { name: "old" } }));
        await vi.advanceTimersByTimeAsync(0);
        expect(manager.addEventToIndex).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ event_id: "$state" }),
            expect.any(Object),
        );
    });

    it("should finish a running sweep before closing the index", async () => {
        const { manager } = setup();
        const scan = Promise.withResolvers<IIndexedEvent[]>();
        manager.loadEventIds.mockReturnValueOnce(scan.promise);
        await startCrawler();
        const closing = indexer.close();
        await vi.advanceTimersByTimeAsync(0);
        expect(manager.closeEventIndex).not.toHaveBeenCalled();
        scan.resolve([{ eventId: "$expired", type: "m.room.message", serverTs: 500 }]);
        await closing;
        expect(manager.deleteEvent).not.toHaveBeenCalled();
        expect(manager.closeEventIndex).toHaveBeenCalled();
    });
});

/**
 * Mock out the `createMessagesRequest` method on the client, with an implementation that will block until a resolver is called.
 *
 * @returns An object with the following properties:
 *  * `called`: A promise that resolves when `createMessagesRequest` is called.
 *  * `resolve`: A function that can be called to allow `createMessagesRequest` to complete.
 */
function mockCreateMessagesRequest(mockClient: Mocked<MatrixClient>): {
    called: Promise<void>;
    resolve: (result: any) => void;
} {
    const messagesCalledPromise = Promise.withResolvers<void>();
    const messagesResultPromise = Promise.withResolvers();
    mockClient.createMessagesRequest.mockImplementationOnce(() => {
        messagesCalledPromise.resolve();
        return messagesResultPromise.promise as any;
    });
    return {
        called: messagesCalledPromise.promise,
        resolve: messagesResultPromise.resolve,
    };
}
