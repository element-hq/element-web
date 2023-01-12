/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { MsgType } from "matrix-js-sdk/src/@types/event";

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
