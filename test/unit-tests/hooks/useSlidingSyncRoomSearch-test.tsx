/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { waitFor, renderHook, act } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type SlidingSync } from "matrix-js-sdk/src/sliding-sync";
import { Room } from "matrix-js-sdk/src/matrix";

import { useSlidingSyncRoomSearch } from "../../../src/hooks/useSlidingSyncRoomSearch";
import { MockEventEmitter, stubClient } from "../../test-utils";
import { SlidingSyncManager } from "../../../src/SlidingSyncManager";

describe("useSlidingSyncRoomSearch", () => {
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("should display rooms when searching", async () => {
        const client = stubClient();
        const roomA = new Room("!a:localhost", client, client.getUserId()!);
        const roomB = new Room("!b:localhost", client, client.getUserId()!);
        const slidingSync = mocked(
            new MockEventEmitter({
                getListData: jest.fn(),
            }) as unknown as SlidingSync,
        );
        jest.spyOn(SlidingSyncManager.instance, "ensureListRegistered").mockResolvedValue({
            ranges: [[0, 9]],
        });
        SlidingSyncManager.instance.slidingSync = slidingSync;
        mocked(slidingSync.getListData).mockReturnValue({
            joinedCount: 2,
            roomIndexToRoomId: {
                0: roomA.roomId,
                1: roomB.roomId,
            },
        });
        mocked(client.getRoom).mockImplementation((roomId) => {
            switch (roomId) {
                case roomA.roomId:
                    return roomA;
                case roomB.roomId:
                    return roomB;
                default:
                    return null;
            }
        });

        // first check that everything is empty
        const { result } = renderHook(() => useSlidingSyncRoomSearch());
        const query = {
            limit: 10,
            query: "foo",
        };
        expect(result.current.loading).toBe(false);
        expect(result.current.rooms).toEqual([]);

        // run the query
        act(() => {
            result.current.search(query);
        });

        // wait for loading to finish
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // now we expect there to be rooms
        expect(result.current.rooms).toEqual([roomA, roomB]);

        // run the query again
        act(() => {
            result.current.search(query);
        });
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
    });
});
