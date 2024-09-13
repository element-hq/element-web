/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { SlidingSync } from "matrix-js-sdk/src/sliding-sync";
import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import fetchMockJest from "fetch-mock-jest";

import { SlidingSyncManager } from "../src/SlidingSyncManager";
import { stubClient } from "./test-utils";
import SlidingSyncController from "../src/settings/controllers/SlidingSyncController";

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
        fetchMockJest.reset();
        fetchMockJest.get("https://proxy/client/server.json", {});
    });

    describe("setRoomVisible", () => {
        it("adds a subscription for the room", async () => {
            const roomId = "!room:id";
            const subs = new Set<string>();
            mocked(slidingSync.getRoomSubscriptions).mockReturnValue(subs);
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
            await manager.ensureListRegistered(listKey, {
                ranges: [[0, 42]],
                sort: ["by_recency"],
            });
            expect(slidingSync.setList).not.toHaveBeenCalled();
            expect(slidingSync.setListRanges).not.toHaveBeenCalled();
        });
    });

    describe("startSpidering", () => {
        it("requests in expanding batchSizes", async () => {
            const gapMs = 1;
            const batchSize = 10;
            mocked(slidingSync.getListData).mockImplementation((key) => {
                return {
                    joinedCount: 64,
                    roomIndexToRoomId: {},
                };
            });
            await manager.startSpidering(batchSize, gapMs);
            // we expect calls for 10,19 -> 20,29 -> 30,39 -> 40,49 -> 50,59 -> 60,69
            const wantWindows = [
                [0, 10],
                [0, 20],
                [0, 30],
                [0, 40],
                [0, 50],
                [0, 60],
                [0, 70],
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
                            ranges: [range],
                        }),
                    );
                    return;
                }
                expect(slidingSync.setListRanges).toHaveBeenCalledWith(SlidingSyncManager.ListSearch, [
                    range,
                ]);
            });
        });
        it("handles accounts with zero rooms", async () => {
            const gapMs = 1;
            const batchSize = 10;
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
                        [0, batchSize],
                    ],
                }),
            );
        });
    });
    describe("checkSupport", () => {
        beforeEach(() => {
            SlidingSyncController.serverSupportsSlidingSync = false;
        });
        it("shorts out if the server has 'native' sliding sync support", async () => {
            jest.spyOn(manager, "nativeSlidingSyncSupport").mockResolvedValue(true);
            expect(SlidingSyncController.serverSupportsSlidingSync).toBeFalsy();
            await manager.checkSupport(client);
            expect(SlidingSyncController.serverSupportsSlidingSync).toBeTruthy();
        });
    });
    describe("setup", () => {
        beforeEach(() => {
            jest.spyOn(manager, "configure");
            jest.spyOn(manager, "startSpidering");
        });
        it("uses the baseUrl", async () => {
            await manager.setup(client);
            expect(manager.configure).toHaveBeenCalled();
            expect(manager.configure).toHaveBeenCalledWith(client, client.baseUrl);
            expect(manager.startSpidering).toHaveBeenCalled();
        });
    });
});
