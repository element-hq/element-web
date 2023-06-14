/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { MsgType, RelationType } from "matrix-js-sdk/src/@types/event";

import { IPreview } from "./IPreview";
import { TagID } from "../models";
import { _t, sanitizeForTranslation } from "../../../languageHandler";
import { getSenderName, isSelf, shouldPrefixMessagesIn } from "./utils";
import { getHtmlText } from "../../../HtmlUtils";
import { stripHTMLReply, stripPlainReply } from "../../../utils/Reply";
import { VoiceBroadcastChunkEventType } from "../../../voice-broadcast/types";

export class MessageEventPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: TagID, isThread?: boolean): string | null {
        let eventContent = event.getContent();

        // no preview for broadcast chunks
        if (eventContent[VoiceBroadcastChunkEventType]) return null;

        if (event.isRelation(RelationType.Replace)) {
            // It's an edit, generate the preview on the new text
            eventContent = event.getContent()["m.new_content"];
        }

        if (!eventContent?.["body"]) return null; // invalid for our purposes

        let body = eventContent["body"].trim();
        if (!body) return null; // invalid event, no preview
        // A msgtype is actually required in the spec but the app is a bit softer on this requirement
        const msgtype = eventContent["msgtype"] ?? MsgType.Text;

        const hasHtml = eventContent.format === "org.matrix.custom.html" && eventContent.formatted_body;
        if (hasHtml) {
            body = eventContent.formatted_body;
        }

        // XXX: Newer relations have a getRelation() function which is not compatible with replies.
        if (event.getWireContent()["m.relates_to"]?.["m.in_reply_to"]) {
            // If this is a reply, get the real reply and use that
            if (hasHtml) {
                body = (stripHTMLReply(body) || "").trim();
            } else {
                body = (stripPlainReply(body) || "").trim();
            }
            if (!body) return null; // invalid event, no preview
        }

        if (hasHtml) {
            const sanitised = getHtmlText(body.replace(/<br\/?>/gi, "\n")); // replace line breaks before removing them
            // run it through DOMParser to fixup encoded html entities
            body = new DOMParser().parseFromString(sanitised, "text/html").documentElement.textContent;
        }

        body = sanitizeForTranslation(body);

        if (msgtype === MsgType.Emote) {
            return _t("* %(senderName)s %(emote)s", { senderName: getSenderName(event), emote: body });
        }

        const roomId = event.getRoomId();

        if (isThread || isSelf(event) || (roomId && !shouldPrefixMessagesIn(roomId, tagId))) {
            return body;
        } else {
            return _t("%(senderName)s: %(message)s", { senderName: getSenderName(event), message: body });
        }
    }
}
