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

import { richToPlain, plainToRich } from "@matrix-org/matrix-wysiwyg";
import { IContent, IEventRelation, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../../../../settings/SettingsStore";
import { RoomPermalinkCreator } from "../../../../../utils/permalinks/Permalinks";
import { addReplyToMessageContent } from "../../../../../utils/Reply";

export const EMOTE_PREFIX = "/me ";

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

const isMatrixEvent = (e: MatrixEvent | undefined): e is MatrixEvent => e instanceof MatrixEvent;

export async function createMessageContent(
    message: string,
    isHTML: boolean,
    {
        relation,
        replyToEvent,
        permalinkCreator,
        includeReplyLegacyFallback = true,
        editedEvent,
    }: CreateMessageContentParams,
): Promise<IContent> {
    const isEditing = isMatrixEvent(editedEvent);
    const isReply = isEditing ? Boolean(editedEvent.replyEventId) : isMatrixEvent(replyToEvent);
    const isReplyAndEditing = isEditing && isReply;

    const isEmote = message.startsWith(EMOTE_PREFIX);
    if (isEmote) {
        // if we are dealing with an emote we want to remove the prefix so that `/me` does not
        // appear after the `* <userName>` text in the timeline
        message = message.slice(EMOTE_PREFIX.length);
    }
    if (message.startsWith("//")) {
        // if user wants to enter a single slash at the start of a message, this
        // is how they have to do it (due to it clashing with commands), so here we
        // remove the first character to make sure //word displays as /word
        message = message.slice(1);
    }

    // if we're editing rich text, the message content is pure html
    // BUT if we're not, the message content will be plain text
    const body = isHTML ? await richToPlain(message) : message;
    const bodyPrefix = (isReplyAndEditing && getTextReplyFallback(editedEvent)) || "";
    const formattedBodyPrefix = (isReplyAndEditing && getHtmlReplyFallback(editedEvent)) || "";

    const content: IContent = {
        msgtype: isEmote ? MsgType.Emote : MsgType.Text,
        body: isEditing ? `${bodyPrefix} * ${body}` : body,
    };

    // TODO markdown support

    const isMarkdownEnabled = SettingsStore.getValue<boolean>("MessageComposerInput.useMarkdown");
    const formattedBody = isHTML ? message : isMarkdownEnabled ? await plainToRich(message) : null;

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

    // TODO Do we need to attach mentions here?
    // TODO Handle editing?
    attachRelation(content, newRelation);

    if (!isEditing && replyToEvent && permalinkCreator) {
        addReplyToMessageContent(content, replyToEvent, {
            permalinkCreator,
            includeLegacyFallback: includeReplyLegacyFallback,
        });
    }

    return content;
}
