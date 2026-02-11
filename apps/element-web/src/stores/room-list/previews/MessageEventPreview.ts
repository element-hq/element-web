/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, MsgType, RelationType } from "matrix-js-sdk/src/matrix";

import { type IPreview } from "./IPreview";
import { type TagID } from "../models";
import { _t, sanitizeForTranslation } from "../../../languageHandler";
import { getSenderName, isSelf, shouldPrefixMessagesIn } from "./utils";
import { getHtmlText } from "../../../HtmlUtils";
import { stripHTMLReply, stripPlainReply } from "../../../utils/Reply";

export class MessageEventPreview implements IPreview {
    public getTextFor(event: MatrixEvent, tagId?: TagID, isThread?: boolean): string | null {
        let eventContent = event.getContent();

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
            return _t("event_preview|m.emote", { senderName: getSenderName(event), emote: body });
        }

        const roomId = event.getRoomId();

        if (isThread || isSelf(event) || (roomId && !shouldPrefixMessagesIn(roomId, tagId))) {
            return body;
        } else {
            return _t("event_preview|m.text", { senderName: getSenderName(event), message: body });
        }
    }
}
