/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2018 , 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Pull in the encryption lib so that we can decrypt attachments.
import encrypt from "matrix-encrypt-attachment";
import { parseErrorResponse } from "matrix-js-sdk/src/matrix";
import { type EncryptedFile, type MediaEventInfo } from "matrix-js-sdk/src/types";

import { mediaFromContent } from "../customisations/Media";
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
 * @param {EncryptedFile} file The encrypted file information taken from the matrix event.
 *   This passed to [link]{@link https://github.com/matrix-org/matrix-encrypt-attachment}
 *   as the encryption info object, so will also have the those keys in addition to
 *   the keys below.
 * @param {MediaEventInfo} info The info parameter taken from the matrix event.
 * @returns {Promise<Blob>} Resolves to a Blob of the file.
 */
export async function decryptFile(file?: EncryptedFile, info?: MediaEventInfo): Promise<Blob> {
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
        throw new DownloadError(e as Error);
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
        throw new DecryptError(e as Error);
    }
}
