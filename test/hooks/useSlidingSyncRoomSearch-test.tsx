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

// eslint-disable-next-line deprecate/import
import { mount } from "enzyme";
import { sleep } from "matrix-js-sdk/src/utils";
import React from "react";
import { act } from "react-dom/test-utils";
import { mocked } from "jest-mock";
import { SlidingSync } from "matrix-js-sdk/src/sliding-sync";
import { Room } from "matrix-js-sdk/src/matrix";

import { SlidingSyncRoomSearchOpts, useSlidingSyncRoomSearch } from "../../src/hooks/useSlidingSyncRoomSearch";
import { MockEventEmitter, stubClient } from "../test-utils";
import { SlidingSyncManager } from "../../src/SlidingSyncManager";

type RoomSearchHook = {
    loading: boolean;
    rooms: Room[];
    search(opts: SlidingSyncRoomSearchOpts): Promise<boolean>;
};

// hooks must be inside a React component else you get:
// "Invalid hook call. Hooks can only be called inside of the body of a function component."
function RoomSearchComponent(props: { onClick: (h: RoomSearchHook) => void }) {
    const roomSearch = useSlidingSyncRoomSearch();
    return <div onClick={() => props.onClick(roomSearch)} />;
}

describe("useSlidingSyncRoomSearch", () => {
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

        // first check that everything is empty and then do the search
        let executeHook = (roomSearch: RoomSearchHook) => {
            expect(roomSearch.loading).toBe(false);
            expect(roomSearch.rooms).toEqual([]);
            roomSearch.search({
                limit: 10,
                query: "foo",
            });
        };
        const wrapper = mount(
            <RoomSearchComponent
                onClick={(roomSearch: RoomSearchHook) => {
                    executeHook(roomSearch);
                }}
            />,
        );

        // run the query
        await act(async () => {
            await sleep(1);
            wrapper.simulate("click");
            return act(() => sleep(1));
        });
        // now we expect there to be rooms
        executeHook = (roomSearch) => {
            expect(roomSearch.loading).toBe(false);
            expect(roomSearch.rooms).toEqual([roomA, roomB]);
        };

        // run the query
        await act(async () => {
            await sleep(1);
            wrapper.simulate("click");
            return act(() => sleep(1));
        });
    });
});
