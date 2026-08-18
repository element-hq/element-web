/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const MAX_CACHED_BYTES = 64 * 1024 * 1024;

const cache = new Map<string, Blob>();
let cachedBytes = 0;

/**
 * Remember the plaintext of a file this client has just uploaded, keyed by the mxc URI the server
 * handed back, so that rendering the resulting event does not have to download bytes which are
 * still in memory. Old entries are dropped once the cache grows past a fixed size, and a file which
 * is larger than the whole cache is not kept at all.
 *
 * @param mxcUrl - The mxc URI the content repository returned for the upload.
 * @param blob - The unencrypted contents that were uploaded.
 */
export function rememberUploadedMedia(mxcUrl: string, blob: Blob): void {
    if (blob.size > MAX_CACHED_BYTES) return;
    forgetUploadedMedia(mxcUrl);
    for (const [key, entry] of cache) {
        if (cachedBytes + blob.size <= MAX_CACHED_BYTES) break;
        cache.delete(key);
        cachedBytes -= entry.size;
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
export function getUploadedMedia(mxcUrl: string | null | undefined): Blob | undefined {
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
export function clearUploadedMedia(): void {
    cache.clear();
    cachedBytes = 0;
}
