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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Room, RoomType } from "matrix-js-sdk/src/matrix";
import { IHierarchyRoom } from "matrix-js-sdk/src/@types/spaces";
import { RoomHierarchy } from "matrix-js-sdk/src/room-hierarchy";
import { normalize } from "matrix-js-sdk/src/utils";

import { MatrixClientPeg } from "../MatrixClientPeg";

export const useSpaceResults = (space: Room | undefined, query: string): [IHierarchyRoom[], boolean] => {
    const [rooms, setRooms] = useState<IHierarchyRoom[]>([]);
    const [hierarchy, setHierarchy] = useState<RoomHierarchy>();

    const resetHierarchy = useCallback(() => {
        setHierarchy(space ? new RoomHierarchy(space, 50) : undefined);
    }, [space]);
    useEffect(resetHierarchy, [resetHierarchy]);

    useEffect(() => {
        if (!space || !hierarchy) return; // nothing to load

        let unmounted = false;

        (async (): Promise<void> => {
            while (hierarchy?.canLoadMore && !unmounted && space === hierarchy.root) {
                await hierarchy.load();
                if (hierarchy.canLoadMore) hierarchy.load(); // start next load so that the loading attribute is right
                setRooms(hierarchy.rooms!);
            }
        })();

        return () => {
            unmounted = true;
        };
    }, [space, hierarchy]);

    const results = useMemo(() => {
        const trimmedQuery = query.trim();
        const lcQuery = trimmedQuery.toLowerCase();
        const normalizedQuery = normalize(trimmedQuery);

        const cli = MatrixClientPeg.get();
        return rooms?.filter((r) => {
            return (
                r.room_type !== RoomType.Space &&
                cli.getRoom(r.room_id)?.getMyMembership() !== "join" &&
                (normalize(r.name || "").includes(normalizedQuery) || (r.canonical_alias || "").includes(lcQuery))
            );
        });
    }, [rooms, query]);

    return [results, hierarchy?.loading ?? false];
};
