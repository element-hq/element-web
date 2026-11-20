/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Room, RoomType, type HierarchyRoom } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { RoomHierarchy } from "matrix-js-sdk/src/room-hierarchy";
import { normalize } from "matrix-js-sdk/src/utils";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { SearchQuery, SearchQueryMatch } from "../utils/SearchQuery";

export const useSpaceResults = (space: Room | undefined, query: string): [HierarchyRoom[], boolean] => {
    const [rooms, setRooms] = useState<HierarchyRoom[]>([]);
    const [hierarchy, setHierarchy] = useState<RoomHierarchy>();

    const resetHierarchy = useCallback(() => {
        setHierarchy(space ? new RoomHierarchy(space, 50) : undefined);
    }, [space]);
    useEffect(resetHierarchy, [resetHierarchy]);

    useEffect(() => {
        if (!space || !hierarchy) return; // nothing to load

        let unmounted = false;

        (async (): Promise<void> => {
            // oxlint-disable-next-line no-unmodified-loop-condition
            while (hierarchy?.canLoadMore && !unmounted && space === hierarchy.root) {
                await hierarchy.load();
                if (hierarchy.canLoadMore) void hierarchy.load(); // start next load so that the loading attribute is right
                setRooms(hierarchy.rooms!);
            }
        })();

        return () => {
            unmounted = true;
        };
    }, [space, hierarchy]);

    const results = useMemo(() => {
        const searchQuery = new SearchQuery(query);
        const cli = MatrixClientPeg.safeGet();

        const matches: { room: HierarchyRoom; match: SearchQueryMatch }[] = [];
        for (const room of rooms) {
            if (room.room_type === RoomType.Space) continue;
            if (cli.getRoom(room.room_id)?.getMyMembership() === KnownMembership.Join) continue;

            const match = Math.max(
                searchQuery.matchNormalized(normalize(room.name || "")),
                searchQuery.matchIgnoringCase(room.canonical_alias),
            );
            if (match !== SearchQueryMatch.None) matches.push({ room, match });
        }

        // Rooms containing the whole query come first, otherwise keep the hierarchy order
        return matches.sort((a, b) => b.match - a.match).map(({ room }) => room);
    }, [rooms, query]);

    return [results, hierarchy?.loading ?? false];
};
