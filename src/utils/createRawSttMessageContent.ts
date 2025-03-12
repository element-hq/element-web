/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";

/**
 * Creates a raw STT message content that will be processed by the server to generate a transcription.
 * The server expects a message with:
 * - msgtype: "m.voyzme.raw_stt"
 * - body: The original text/content to be processed
 * - language: The language code for processing
 *
 * @param {string} body The original text/content to be processed
 * @param {string} language The language code (e.g. "en-US", "es-ES")
 * @returns {RoomMessageEventContent} The message content ready to be sent
 */
export const createRawSttMessageContent = (
    body: string,
    language: string,
): RoomMessageEventContent => {
    return {
        "msgtype": "m.voyzme.raw_stt",
        "body": body,
        "language": language,
    };
};
