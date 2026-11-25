/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * An in-memory cache of the files this client uploaded during this session, keyed by the mxc URI
 * the content repository handed back, so that rendering the resulting event does not have to
 * download bytes we are still holding.
 *
 * Pruning is first in, first out. A `Map` iterates in insertion order, so the entries cached
 * longest ago are dropped first, one at a time, until the incoming blob fits within
 * `MAX_CACHED_BYTES`. Reading an entry does not renew it, and a blob larger than the whole budget
 * is never cached at all — it would evict everything else only to be evicted itself.
 */

const MAX_CACHED_BYTES = 64 * 1024 * 1024;

const cache = new Map<string, Blob>();
let cachedBytes = 0;

/**
 * Remember the plaintext of a file this client has just uploaded.
 *
 * @param mxcUrl - The mxc URI the content repository returned for the upload.
 * @param blob - The unencrypted contents that were uploaded.
 */
export function cacheUploadedMedia(mxcUrl: string, blob: Blob): void {
    if (blob.size > MAX_CACHED_BYTES) return;
    for (const key of cache.keys()) {
        if (cachedBytes + blob.size <= MAX_CACHED_BYTES) break;
        forgetUploadedMedia(key);
    }
    cache.set(mxcUrl, blob);
    cachedBytes += blob.size;
}

/**
 * Look up the plaintext of a file this client uploaded earlier in the session.
 *
 * @param mxcUrl - The mxc URI to look up.
 * @returns The uploaded contents, or undefined if this client did not upload them or they have
 *     since been evicted.
 */
export function queryUploadedMediaCache(mxcUrl: string | null | undefined): Blob | undefined {
    return mxcUrl ? cache.get(mxcUrl) : undefined;
}

/**
 * Drop one entry from the cache.
 *
 * @param mxcUrl - The mxc URI to forget.
 */
export function forgetUploadedMedia(mxcUrl: string): void {
    const entry = cache.get(mxcUrl);
    if (!entry) return;
    cache.delete(mxcUrl);
    cachedBytes -= entry.size;
}

/**
 * Drop everything, for when the session ends.
 */
export function clearUploadedMediaCache(): void {
    cache.clear();
    cachedBytes = 0;
}
