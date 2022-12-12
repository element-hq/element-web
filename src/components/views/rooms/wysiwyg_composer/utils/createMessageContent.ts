/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { IContent, IEventRelation, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { htmlSerializeFromMdIfNeeded } from "../../../../../editor/serialize";
import SettingsStore from "../../../../../settings/SettingsStore";
import { RoomPermalinkCreator } from "../../../../../utils/permalinks/Permalinks";
import { addReplyToMessageContent } from "../../../../../utils/Reply";
import { htmlToPlainText } from "../../../../../utils/room/htmlToPlaintext";

// Merges favouring the given relation
function attachRelation(content: IContent, relation?: IEventRelation): void {
    if (relation) {
        content["m.relates_to"] = {
            ...(content["m.relates_to"] || {}),
            ...relation,
        };
    }
}

function getHtmlReplyFallback(mxEvent: MatrixEvent): string {
    const html = mxEvent.getContent().formatted_body;
    if (!html) {
        return "";
    }
    const rootNode = new DOMParser().parseFromString(html, "text/html").body;
    const mxReply = rootNode.querySelector("mx-reply");
    return (mxReply && mxReply.outerHTML) || "";
}

function getTextReplyFallback(mxEvent: MatrixEvent): string {
    const body = mxEvent.getContent().body;
    if (typeof body !== "string") {
        return "";
    }
    const lines = body.split("\n").map((l) => l.trim());
    if (lines.length > 2 && lines[0].startsWith("> ") && lines[1].length === 0) {
        return `${lines[0]}\n\n`;
    }
    return "";
}

interface CreateMessageContentParams {
    relation?: IEventRelation;
    replyToEvent?: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    includeReplyLegacyFallback?: boolean;
    editedEvent?: MatrixEvent;
}

export function createMessageContent(
    message: string,
    isHTML: boolean,
    {
        relation,
        replyToEvent,
        permalinkCreator,
        includeReplyLegacyFallback = true,
        editedEvent,
    }: CreateMessageContentParams,
): IContent {
    // TODO emote ?

    const isEditing = Boolean(editedEvent);
    const isReply = isEditing ? Boolean(editedEvent?.replyEventId) : Boolean(replyToEvent);
    const isReplyAndEditing = isEditing && isReply;

    /*const isEmote = containsEmote(model);
    if (isEmote) {
        model = stripEmoteCommand(model);
    }
    if (startsWith(model, "//")) {
        model = stripPrefix(model, "/");
    }
    model = unescapeMessage(model);*/

    // const body = textSerialize(model);

    // TODO remove this ugly hack for replace br tag
    const body = (isHTML && htmlToPlainText(message)) || message.replace(/<br>/g, "\n");
    const bodyPrefix = (isReplyAndEditing && getTextReplyFallback(editedEvent)) || "";
    const formattedBodyPrefix = (isReplyAndEditing && getHtmlReplyFallback(editedEvent)) || "";

    const content: IContent = {
        // TODO emote
        msgtype: MsgType.Text,
        // TODO when available, use HTML --> Plain text conversion from wysiwyg rust model
        body: isEditing ? `${bodyPrefix} * ${body}` : body,
    };

    // TODO markdown support

    const isMarkdownEnabled = SettingsStore.getValue<boolean>("MessageComposerInput.useMarkdown");
    const formattedBody = isHTML
        ? message
        : isMarkdownEnabled
        ? htmlSerializeFromMdIfNeeded(message, { forceHTML: isReply })
        : null;

    if (formattedBody) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = isEditing ? `${formattedBodyPrefix} * ${formattedBody}` : formattedBody;
    }

    if (isEditing) {
        content["m.new_content"] = {
            msgtype: content.msgtype,
            body: body,
        };

        if (formattedBody) {
            content["m.new_content"].format = "org.matrix.custom.html";
            content["m.new_content"]["formatted_body"] = formattedBody;
        }
    }

    const newRelation = isEditing ? { ...relation, rel_type: "m.replace", event_id: editedEvent.getId() } : relation;

    attachRelation(content, newRelation);

    if (!isEditing && replyToEvent && permalinkCreator) {
        addReplyToMessageContent(content, replyToEvent, {
            permalinkCreator,
            includeLegacyFallback: includeReplyLegacyFallback,
        });
    }

    return content;
}
