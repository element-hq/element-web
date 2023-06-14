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

import { SlidingSync } from "matrix-js-sdk/src/sliding-sync";
import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { SlidingSyncManager } from "../src/SlidingSyncManager";
import { stubClient } from "./test-utils";

jest.mock("matrix-js-sdk/src/sliding-sync");
const MockSlidingSync = <jest.Mock<SlidingSync>>(<unknown>SlidingSync);

describe("SlidingSyncManager", () => {
    let manager: SlidingSyncManager;
    let slidingSync: SlidingSync;
    let client: MatrixClient;

    beforeEach(() => {
        slidingSync = new MockSlidingSync();
        manager = new SlidingSyncManager();
        client = stubClient();
        // by default the client has no rooms: stubClient magically makes rooms annoyingly.
        mocked(client.getRoom).mockReturnValue(null);
        manager.configure(client, "invalid");
        manager.slidingSync = slidingSync;
    });

    describe("setRoomVisible", () => {
        it("adds a subscription for the room", async () => {
            const roomId = "!room:id";
            const subs = new Set<string>();
            mocked(slidingSync.getRoomSubscriptions).mockReturnValue(subs);
            mocked(slidingSync.modifyRoomSubscriptions).mockResolvedValue("yep");
            await manager.setRoomVisible(roomId, true);
            expect(slidingSync.modifyRoomSubscriptions).toHaveBeenCalledWith(new Set<string>([roomId]));
        });
        it("adds a custom subscription for a lazy-loadable room", async () => {
            const roomId = "!lazy:id";
            const room = new Room(roomId, client, client.getUserId()!);
            room.getLiveTimeline().initialiseState([
                new MatrixEvent({
                    type: "m.room.create",
                    state_key: "",
                    event_id: "$abc123",
                    sender: client.getUserId()!,
                    content: {
                        creator: client.getUserId()!,
                    },
                }),
            ]);
            mocked(client.getRoom).mockImplementation((r: string): Room | null => {
                if (roomId === r) {
                    return room;
                }
                return null;
            });
            const subs = new Set<string>();
            mocked(slidingSync.getRoomSubscriptions).mockReturnValue(subs);
            mocked(slidingSync.modifyRoomSubscriptions).mockResolvedValue("yep");
            await manager.setRoomVisible(roomId, true);
            expect(slidingSync.modifyRoomSubscriptions).toHaveBeenCalledWith(new Set<string>([roomId]));
            // we aren't prescriptive about what the sub name is.
            expect(slidingSync.useCustomSubscription).toHaveBeenCalledWith(roomId, expect.anything());
        });
    });

    describe("ensureListRegistered", () => {
        it("creates a new list based on the key", async () => {
            const listKey = "key";
            mocked(slidingSync.getListParams).mockReturnValue(null);
            mocked(slidingSync.setList).mockResolvedValue("yep");
            await manager.ensureListRegistered(listKey, {
                sort: ["by_recency"],
            });
            expect(slidingSync.setList).toHaveBeenCalledWith(
                listKey,
                expect.objectContaining({
                    sort: ["by_recency"],
                }),
            );
        });

        it("updates an existing list based on the key", async () => {
            const listKey = "key";
            mocked(slidingSync.getListParams).mockReturnValue({
                ranges: [[0, 42]],
            });
            mocked(slidingSync.setList).mockResolvedValue("yep");
            await manager.ensureListRegistered(listKey, {
                sort: ["by_recency"],
            });
            expect(slidingSync.setList).toHaveBeenCalledWith(
                listKey,
                expect.objectContaining({
                    sort: ["by_recency"],
                    ranges: [[0, 42]],
                }),
            );
        });

        it("updates ranges on an existing list based on the key if there's no other changes", async () => {
            const listKey = "key";
            mocked(slidingSync.getListParams).mockReturnValue({
                ranges: [[0, 42]],
            });
            mocked(slidingSync.setList).mockResolvedValue("yep");
            await manager.ensureListRegistered(listKey, {
                ranges: [[0, 52]],
            });
            expect(slidingSync.setList).not.toHaveBeenCalled();
            expect(slidingSync.setListRanges).toHaveBeenCalledWith(listKey, [[0, 52]]);
        });

        it("no-ops for idential changes", async () => {
            const listKey = "key";
            mocked(slidingSync.getListParams).mockReturnValue({
                ranges: [[0, 42]],
                sort: ["by_recency"],
            });
            mocked(slidingSync.setList).mockResolvedValue("yep");
            await manager.ensureListRegistered(listKey, {
                ranges: [[0, 42]],
                sort: ["by_recency"],
            });
            expect(slidingSync.setList).not.toHaveBeenCalled();
            expect(slidingSync.setListRanges).not.toHaveBeenCalled();
        });
    });

    describe("startSpidering", () => {
        it("requests in batchSizes", async () => {
            const gapMs = 1;
            const batchSize = 10;
            mocked(slidingSync.setList).mockResolvedValue("yep");
            mocked(slidingSync.setListRanges).mockResolvedValue("yep");
            mocked(slidingSync.getListData).mockImplementation((key) => {
                return {
                    joinedCount: 64,
                    roomIndexToRoomId: {},
                };
            });
            await manager.startSpidering(batchSize, gapMs);
            // we expect calls for 10,19 -> 20,29 -> 30,39 -> 40,49 -> 50,59 -> 60,69
            const wantWindows = [
                [10, 19],
                [20, 29],
                [30, 39],
                [40, 49],
                [50, 59],
                [60, 69],
            ];
            expect(slidingSync.getListData).toHaveBeenCalledTimes(wantWindows.length);
            expect(slidingSync.setList).toHaveBeenCalledTimes(1);
            expect(slidingSync.setListRanges).toHaveBeenCalledTimes(wantWindows.length - 1);
            wantWindows.forEach((range, i) => {
                if (i === 0) {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(slidingSync.setList).toHaveBeenCalledWith(
                        SlidingSyncManager.ListSearch,
                        // eslint-disable-next-line jest/no-conditional-expect
                        expect.objectContaining({
                            ranges: [[0, batchSize - 1], range],
                        }),
                    );
                    return;
                }
                expect(slidingSync.setListRanges).toHaveBeenCalledWith(SlidingSyncManager.ListSearch, [
                    [0, batchSize - 1],
                    range,
                ]);
            });
        });
        it("handles accounts with zero rooms", async () => {
            const gapMs = 1;
            const batchSize = 10;
            mocked(slidingSync.setList).mockResolvedValue("yep");
            mocked(slidingSync.getListData).mockImplementation((key) => {
                return {
                    joinedCount: 0,
                    roomIndexToRoomId: {},
                };
            });
            await manager.startSpidering(batchSize, gapMs);
            expect(slidingSync.getListData).toHaveBeenCalledTimes(1);
            expect(slidingSync.setList).toHaveBeenCalledTimes(1);
            expect(slidingSync.setList).toHaveBeenCalledWith(
                SlidingSyncManager.ListSearch,
                expect.objectContaining({
                    ranges: [
                        [0, batchSize - 1],
                        [batchSize, batchSize + batchSize - 1],
                    ],
                }),
            );
        });
        it("continues even when setList rejects", async () => {
            const gapMs = 1;
            const batchSize = 10;
            mocked(slidingSync.setList).mockRejectedValue("narp");
            mocked(slidingSync.getListData).mockImplementation((key) => {
                return {
                    joinedCount: 0,
                    roomIndexToRoomId: {},
                };
            });
            await manager.startSpidering(batchSize, gapMs);
            expect(slidingSync.getListData).toHaveBeenCalledTimes(1);
            expect(slidingSync.setList).toHaveBeenCalledTimes(1);
            expect(slidingSync.setList).toHaveBeenCalledWith(
                SlidingSyncManager.ListSearch,
                expect.objectContaining({
                    ranges: [
                        [0, batchSize - 1],
                        [batchSize, batchSize + batchSize - 1],
                    ],
                }),
            );
        });
    });
});
