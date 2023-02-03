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

import { SpaceKey } from ".";

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
