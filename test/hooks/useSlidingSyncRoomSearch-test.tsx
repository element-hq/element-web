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

import { waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react-hooks/dom";
import { mocked } from "jest-mock";
import { SlidingSync } from "matrix-js-sdk/src/sliding-sync";
import { Room } from "matrix-js-sdk/src/matrix";

import { useSlidingSyncRoomSearch } from "../../src/hooks/useSlidingSyncRoomSearch";
import { MockEventEmitter, stubClient } from "../test-utils";
import { SlidingSyncManager } from "../../src/SlidingSyncManager";

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
