/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { nativeImage, type NativeImage, type Session } from "electron";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";

/**
 * Writes an Electron {@link NativeImage} to disk, encoding it based on the target file extension.
 * Falls back to PNG for unknown extensions.
 */
export function writeNativeImage(filePath: string, img: NativeImage): Promise<void> {
    switch (filePath.split(".").pop()?.toLowerCase()) {
        case "jpg":
        case "jpeg":
            return fs.promises.writeFile(filePath, img.toJPEG(100));
        case "bmp":
            return fs.promises.writeFile(filePath, img.toBitmap());
        case "png":
        default:
            return fs.promises.writeFile(filePath, img.toPNG());
    }
}

/**
 * Saves an image to a file on disk.
 *
 * `data:` URLs are decoded directly into a {@link NativeImage}. Network (`http(s):`) URLs are
 * fetched through the supplied Electron {@link Session} rather than Node's global `fetch`, so that
 * the session's `webRequest` interceptors apply — in particular the authenticated-media handlers in
 * `media-auth.ts` which rewrite the download URL and attach the `Authorization` header. Using the
 * main-process global `fetch` bypasses those interceptors and fails with 401/404 on modern Synapse
 * (authenticated media, MSC3916). See https://github.com/element-hq/element-web/issues/32362.
 *
 * @param url - the `data:` or `http(s):` URL of the image to save
 * @param filePath - the destination path on disk
 * @param session - the Electron session whose `webRequest` interceptors should apply to the fetch
 */
export async function saveImageToFile(url: string, filePath: string, session: Session): Promise<void> {
    if (url.startsWith("data:")) {
        await writeNativeImage(filePath, nativeImage.createFromDataURL(url));
    } else {
        const resp = await session.fetch(url);
        if (!resp.ok) throw new Error(`unexpected response ${resp.statusText}`);
        if (!resp.body) throw new Error(`unexpected response has no body ${resp.statusText}`);
        await pipeline(resp.body, fs.createWriteStream(filePath));
    }
}
