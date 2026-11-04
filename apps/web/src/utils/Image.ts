/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { bytesEqual, startsWith } from "./media/bytes";
import { type PngChunk, readPngChunks } from "./media/png";

// scraped out of a macOS hidpi (5660ppm) screenshot png
//                                 5669 px (x-axis)      , 5669 px (y-axis)      , per metre
const PHYS_HIDPI = new Uint8Array([0x00, 0x00, 0x16, 0x25, 0x00, 0x00, 0x16, 0x25, 0x01]);

export function mayBeAnimated(mimeType?: string): boolean {
    return ["image/gif", "image/webp", "image/png", "image/apng", "image/avif"].includes(mimeType!);
}

/**
 * Finds the first chunk of the given types which comes before the image data of a PNG.
 *
 * @returns the chunk, or undefined if there is none or the blob is not a valid PNG
 */
async function findPngChunkBeforeImageData(blob: Blob, types: string[]): Promise<PngChunk | undefined> {
    try {
        for await (const chunk of readPngChunks(blob)) {
            if (types.includes(chunk.type)) return chunk;
            if (chunk.type === "IDAT") return undefined;
        }
    } catch {
        // Not a PNG, or truncated: treat it as having no such chunk.
    }
    return undefined;
}

/**
 * Check if a Blob is a PNG with the pixel density of a macOS hidpi screenshot, so it should be displayed at
 * half its pixel size.
 * @param blob The Blob to check.
 * @returns True if the image is a hidpi PNG, false if not or if it could not be parsed.
 */
export async function blobIsHiDpiPng(blob: Blob): Promise<boolean> {
    // pHYs must come before the image data, so there is no need to look further.
    const chunk = await findPngChunkBeforeImageData(blob, ["pHYs"]);
    return !!chunk && bytesEqual(await chunk.readData(), PHYS_HIDPI);
}

/**
 * Check if a Blob contains an animated image.
 * @param blob The Blob to check.
 * @returns True if the image is animated, false if not, or undefined if it could not be determined.
 */
export async function blobIsAnimated(blob: Blob): Promise<boolean | undefined> {
    try {
        // Try parse the image using ImageDecoder as this is the most coherent way of asserting whether a piece of media
        // is or is not animated. Limited availability at time of writing, notably Safari lacks support.
        // https://developer.mozilla.org/en-US/docs/Web/API/ImageDecoder
        const data = await blob.arrayBuffer();
        const decoder = new ImageDecoder({ data, type: blob.type });
        await decoder.tracks.ready;
        if ([...decoder.tracks].some((track) => track.animated)) {
            return true;
        }
    } catch (e) {
        console.warn("ImageDecoder not supported or failed to decode image", e);
        // Not supported by this browser, fall through to manual checks
    }

    switch (blob.type) {
        case "image/webp": {
            // Only extended file format WEBP images support animation, so grab the expected data range and verify header.
            // Based on https://developers.google.com/speed/webp/docs/riff_container#extended_file_format
            const header = new Uint8Array(await blob.slice(0, 21).arrayBuffer());
            if (
                header.length === 21 &&
                startsWith(header, "RIFF") &&
                startsWith(header, "WEBP", 8) &&
                startsWith(header, "VP8X", 12)
            ) {
                const flags = header[20];
                // Flags: R R I L E X _A_ R (reversed)
                const animationFlagMask = 1 << 1;
                return (flags & animationFlagMask) != 0;
            }
            return false;
        }

        case "image/gif": {
            // Based on https://gist.github.com/zakirt/faa4a58cec5a7505b10e3686a226f285
            // More info at http://www.matthewflickinger.com/lab/whatsinagif/bits_and_bytes.asp
            const dv = new DataView(await blob.arrayBuffer(), 10);

            const globalColorTable = dv.getUint8(0);
            let globalColorTableSize = 0;
            // check first bit, if 0, then we don't have a Global Color Table
            if (globalColorTable & 0x80) {
                // grab the last 3 bits, to calculate the global color table size -> RGB * 2^(N+1)
                // N is the value in the last 3 bits.
                globalColorTableSize = 3 * Math.pow(2, (globalColorTable & 0x7) + 1);
            }

            // move on to the Graphics Control Extension
            const offset = 3 + globalColorTableSize;

            const extensionIntroducer = dv.getUint8(offset);
            const graphicsControlLabel = dv.getUint8(offset + 1);
            let delayTime = 0;

            // Graphics Control Extension section is where GIF animation data is stored
            // First 2 bytes must be 0x21 and 0xF9
            if (extensionIntroducer & 0x21 && graphicsControlLabel & 0xf9) {
                // skip to the 2 bytes with the delay time
                delayTime = dv.getUint16(offset + 4);
            }

            return !!delayTime;
        }

        case "image/png":
        case "image/apng": {
            // An animated PNG has an acTL chunk before its image data.
            return !!(await findPngChunkBeforeImageData(blob, ["acTL"]));
        }
    }
}
