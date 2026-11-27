/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { assembleFile } from "./bytes";
import { MetadataStripError } from "./MetadataStripError";
import { buildRiffHeader, readRiffChunks } from "./riff";

/**
 * Chunks needed to play the audio, plus padding. `LIST` (which holds the INFO tags), `bext` (broadcast
 * metadata such as the originator and recording time), `iXML`, ID3 and XMP chunks and anything unrecognised
 * are dropped.
 */
const KEPT_CHUNKS = new Set(["fmt ", "data", "fact", "cue ", "smpl", "inst", "JUNK", "junk", "PAD "]);

/**
 * Removes metadata chunks from a WAV file. Only the chunk headers are read, so large recordings are not
 * loaded into memory.
 *
 * @param file - the WAV file
 * @returns the stripped file, or `file` itself if it held no metadata
 */
export async function stripWavMetadata(file: File): Promise<File> {
    const { form, chunks, end } = await readRiffChunks(file);
    if (form !== "WAVE") throw new MetadataStripError("Not a WAV file");

    const kept = chunks.filter((chunk) => KEPT_CHUNKS.has(chunk.id));
    if (kept.length === chunks.length && end === file.size) return file;

    const bodyLength = kept.reduce((total, chunk) => total + chunk.end - chunk.offset, 0);
    return assembleFile(file, [
        buildRiffHeader("WAVE", bodyLength),
        ...kept.map((chunk) => file.slice(chunk.offset, chunk.end)),
    ]);
}
