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
            expect(slidingSync.modifyRoomSubscriptions).toBeCalledWith(new Set<string>([roomId]));
        });
        it("adds a custom subscription for a lazy-loadable room", async () => {
            const roomId = "!lazy:id";
            const room = new Room(roomId, client, client.getUserId());
            room.getLiveTimeline().initialiseState([
                new MatrixEvent({
                    type: "m.room.create",
                    state_key: "",
                    event_id: "$abc123",
                    sender: client.getUserId(),
                    content: {
                        creator: client.getUserId(),
                    },
                }),
            ]);
            mocked(client.getRoom).mockImplementation((r: string): Room => {
                if (roomId === r) {
                    return room;
                }
                return null;
            });
            const subs = new Set<string>();
            mocked(slidingSync.getRoomSubscriptions).mockReturnValue(subs);
            mocked(slidingSync.modifyRoomSubscriptions).mockResolvedValue("yep");
            await manager.setRoomVisible(roomId, true);
            expect(slidingSync.modifyRoomSubscriptions).toBeCalledWith(new Set<string>([roomId]));
            // we aren't prescriptive about what the sub name is.
            expect(slidingSync.useCustomSubscription).toBeCalledWith(roomId, expect.anything());
        });
    });

    describe("startSpidering", () => {
        it("requests in batchSizes", async () => {
            const gapMs = 1;
            const batchSize = 10;
            mocked(slidingSync.setList).mockResolvedValue("yep");
            mocked(slidingSync.setListRanges).mockResolvedValue("yep");
            mocked(slidingSync.getListData).mockImplementation((i) => {
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
            expect(slidingSync.getListData).toBeCalledTimes(wantWindows.length);
            expect(slidingSync.setList).toBeCalledTimes(1);
            expect(slidingSync.setListRanges).toBeCalledTimes(wantWindows.length - 1);
            wantWindows.forEach((range, i) => {
                if (i === 0) {
                    expect(slidingSync.setList).toBeCalledWith(
                        manager.getOrAllocateListIndex(SlidingSyncManager.ListSearch),
                        expect.objectContaining({
                            ranges: [[0, batchSize - 1], range],
                        }),
                    );
                    return;
                }
                expect(slidingSync.setListRanges).toBeCalledWith(
                    manager.getOrAllocateListIndex(SlidingSyncManager.ListSearch),
                    [[0, batchSize - 1], range],
                );
            });
        });
        it("handles accounts with zero rooms", async () => {
            const gapMs = 1;
            const batchSize = 10;
            mocked(slidingSync.setList).mockResolvedValue("yep");
            mocked(slidingSync.getListData).mockImplementation((i) => {
                return {
                    joinedCount: 0,
                    roomIndexToRoomId: {},
                };
            });
            await manager.startSpidering(batchSize, gapMs);
            expect(slidingSync.getListData).toBeCalledTimes(1);
            expect(slidingSync.setList).toBeCalledTimes(1);
            expect(slidingSync.setList).toBeCalledWith(
                manager.getOrAllocateListIndex(SlidingSyncManager.ListSearch),
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
            mocked(slidingSync.getListData).mockImplementation((i) => {
                return {
                    joinedCount: 0,
                    roomIndexToRoomId: {},
                };
            });
            await manager.startSpidering(batchSize, gapMs);
            expect(slidingSync.getListData).toBeCalledTimes(1);
            expect(slidingSync.setList).toBeCalledTimes(1);
            expect(slidingSync.setList).toBeCalledWith(
                manager.getOrAllocateListIndex(SlidingSyncManager.ListSearch),
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
