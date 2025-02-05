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

        const cli = MatrixClientPeg.safeGet();
        return rooms?.filter((r) => {
            return (
                r.room_type !== RoomType.Space &&
                cli.getRoom(r.room_id)?.getMyMembership() !== KnownMembership.Join &&
                (normalize(r.name || "").includes(normalizedQuery) || (r.canonical_alias || "").includes(lcQuery))
            );
        });
    }, [rooms, query]);

    return [results, hierarchy?.loading ?? false];
};
