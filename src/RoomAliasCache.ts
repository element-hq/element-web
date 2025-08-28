/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { MatrixClient } from "matrix-js-sdk/src/matrix";

type CacheResult = { roomId: string; viaServers: string[] };

/**
 * This is meant to be a cache of room alias to room ID so that moving between
 * rooms happens smoothly (for example using browser back / forward buttons).
 *
 * For the moment, it's in memory only and so only applies for the current
 * session for simplicity, but could be extended further in the future.
 *
 * A similar thing could also be achieved via `pushState` with a state object,
 * but keeping it separate like this seems easier in case we do want to extend.
 */
const cache = new Map<string, CacheResult>();

export function storeRoomAliasInCache(alias: string, roomId: string, viaServers: string[]): void {
    cache.set(alias, { roomId, viaServers });
}

export function getCachedRoomIdForAlias(alias: string): CacheResult | undefined {
    return cache.get(alias);
}

export async function getOrFetchCachedRoomIdForAlias(
    client: MatrixClient,
    alias: string,
): Promise<CacheResult | undefined> {
    if (cache.has(alias)) {
        // If we already have it cached, don't overwrite it
        return cache.get(alias);
    }

    try {
        const { room_id: roomId, servers: viaServers } = await client.getRoomIdForAlias(alias);
        const result = { roomId, viaServers };
        cache.set(alias, result);
        return result;
    } catch (e) {
        console.error(`Failed to resolve room alias ${alias}`, e);
        return undefined;
    }
}
