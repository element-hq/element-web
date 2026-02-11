/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MsgType } from "matrix-js-sdk/src/matrix";

interface MessageContent {
    msgtype: MsgType;
    body: string;
    format?: string;
    formatted_body?: string;
}

/**
 * Creates the `content` for an `m.room.message` event based on input.
 * @param text The text to put in the event.
 * @param html Optional HTML to put in the event.
 * @returns A complete `content` object for an `m.room.message` event.
 */
export function createMessageEventContent(text: string, html?: string): MessageContent {
    const content: MessageContent = {
        msgtype: MsgType.Text,
        body: text,
    };
    if (html) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = html;
    }
    return content;
}
