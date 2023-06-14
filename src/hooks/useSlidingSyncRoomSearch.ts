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

import { useCallback, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { useLatestResult } from "./useLatestResult";
import { SlidingSyncManager } from "../SlidingSyncManager";

export interface SlidingSyncRoomSearchOpts {
    limit: number;
    query: string;
}

export const useSlidingSyncRoomSearch = (): {
    loading: boolean;
    rooms: Room[];
    search(opts: SlidingSyncRoomSearchOpts): Promise<boolean>;
} => {
    const [rooms, setRooms] = useState<Room[]>([]);

    const [loading, setLoading] = useState(false);

    const [updateQuery, updateResult] = useLatestResult<{ term: string; limit?: number }, Room[]>(setRooms);

    const search = useCallback(
        async ({ limit = 100, query: term }: SlidingSyncRoomSearchOpts): Promise<boolean> => {
            const opts = { limit, term };
            updateQuery(opts);

            if (!term?.length) {
                setRooms([]);
                return true;
            }

            try {
                setLoading(true);
                await SlidingSyncManager.instance.ensureListRegistered(SlidingSyncManager.ListSearch, {
                    ranges: [[0, limit]],
                    filters: {
                        room_name_like: term,
                    },
                });
                const rooms: Room[] = [];
                const { roomIndexToRoomId } = SlidingSyncManager.instance.slidingSync.getListData(
                    SlidingSyncManager.ListSearch,
                )!;
                let i = 0;
                while (roomIndexToRoomId[i]) {
                    const roomId = roomIndexToRoomId[i];
                    const room = MatrixClientPeg.get().getRoom(roomId);
                    if (room) {
                        rooms.push(room);
                    }
                    i++;
                }
                updateResult(opts, rooms);
                return true;
            } catch (e) {
                console.error("Could not fetch sliding sync rooms for params", { limit, term }, e);
                updateResult(opts, []);
                return false;
            } finally {
                setLoading(false);
                // TODO: delete the list?
            }
        },
        [updateQuery, updateResult],
    );

    return {
        loading,
        rooms,
        search,
    } as const;
};
