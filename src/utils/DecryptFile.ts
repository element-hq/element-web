/*
Copyright 2016, 2018, 2021 The Matrix.org Foundation C.I.C.

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

// Pull in the encryption lib so that we can decrypt attachments.
import encrypt from "matrix-encrypt-attachment";
import { parseErrorResponse } from "matrix-js-sdk/src/http-api";

import { mediaFromContent } from "../customisations/Media";
import { IEncryptedFile, IMediaEventInfo } from "../customisations/models/IMediaEventContent";
import { getBlobSafeMimeType } from "./blobs";

export class DownloadError extends Error {
    public constructor(e: Error) {
        super(e.message);
        this.name = "DownloadError";
        this.stack = e.stack;
    }
}

export class DecryptError extends Error {
    public constructor(e: Error) {
        super(e.message);
        this.name = "DecryptError";
        this.stack = e.stack;
    }
}

/**
 * Decrypt a file attached to a matrix event.
 * @param {IEncryptedFile} file The encrypted file information taken from the matrix event.
 *   This passed to [link]{@link https://github.com/matrix-org/matrix-encrypt-attachment}
 *   as the encryption info object, so will also have the those keys in addition to
 *   the keys below.
 * @param {IMediaEventInfo} info The info parameter taken from the matrix event.
 * @returns {Promise<Blob>} Resolves to a Blob of the file.
 */
export async function decryptFile(file?: IEncryptedFile, info?: IMediaEventInfo): Promise<Blob> {
    // throws if file is falsy
    const media = mediaFromContent({ file });

    let responseData: ArrayBuffer;
    try {
        // Download the encrypted file as an array buffer.
        const response = await media.downloadSource();
        if (!response.ok) {
            throw parseErrorResponse(response, await response.text());
        }
        responseData = await response.arrayBuffer();
    } catch (e) {
        throw new DownloadError(e);
    }

    try {
        // Decrypt the array buffer using the information taken from the event content.
        const dataArray = await encrypt.decryptAttachment(responseData, file!);
        // Turn the array into a Blob and give it the correct MIME-type.

        // IMPORTANT: we must not allow scriptable mime-types into Blobs otherwise
        // they introduce XSS attacks if the Blob URI is viewed directly in the
        // browser (e.g. by copying the URI into a new tab or window.)
        // See warning at top of file.
        let mimetype = info?.mimetype ? info.mimetype.split(";")[0].trim() : "";
        mimetype = getBlobSafeMimeType(mimetype);

        return new Blob([dataArray], { type: mimetype });
    } catch (e) {
        throw new DecryptError(e);
    }
}
