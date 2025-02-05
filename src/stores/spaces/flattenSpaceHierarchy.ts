/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type SpaceKey } from ".";

export type SpaceEntityMap = Map<SpaceKey, Set<string>>;
export type SpaceDescendantMap = Map<SpaceKey, Set<SpaceKey>>;

const traverseSpaceDescendants = (
    spaceDescendantMap: SpaceDescendantMap,
    spaceId: SpaceKey,
    flatSpace = new Set<SpaceKey>(),
): Set<SpaceKey> => {
    flatSpace.add(spaceId);
    const descendentSpaces = spaceDescendantMap.get(spaceId);
    descendentSpaces?.forEach((descendantSpaceId) => {
        if (!flatSpace.has(descendantSpaceId)) {
            traverseSpaceDescendants(spaceDescendantMap, descendantSpaceId, flatSpace);
        }
    });

    return flatSpace;
};

/**
 * Helper function to traverse space hierarchy and flatten
 * @param spaceEntityMap ie map of rooms or dm userIds
 * @param spaceDescendantMap map of spaces and their children
 * @returns set of all rooms
 */
export const flattenSpaceHierarchy = (
    spaceEntityMap: SpaceEntityMap,
    spaceDescendantMap: SpaceDescendantMap,
    spaceId: SpaceKey,
): Set<string> => {
    const flattenedSpaceIds = traverseSpaceDescendants(spaceDescendantMap, spaceId);
    const flattenedRooms = new Set<string>();

    flattenedSpaceIds.forEach((id) => {
        const roomIds = spaceEntityMap.get(id);
        roomIds?.forEach(flattenedRooms.add, flattenedRooms);
    });

    return flattenedRooms;
};

export const flattenSpaceHierarchyWithCache =
    (cache: SpaceEntityMap) =>
    (
        spaceEntityMap: SpaceEntityMap,
        spaceDescendantMap: SpaceDescendantMap,
        spaceId: SpaceKey,
        useCache = true,
    ): Set<string> => {
        if (useCache && cache.has(spaceId)) {
            return cache.get(spaceId)!;
        }
        const result = flattenSpaceHierarchy(spaceEntityMap, spaceDescendantMap, spaceId);
        cache.set(spaceId, result);

        return result;
    };
