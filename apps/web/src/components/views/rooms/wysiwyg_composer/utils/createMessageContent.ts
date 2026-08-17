/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { richToPlain, plainToRich } from "@vector-im/matrix-wysiwyg";
import { type IContent, type IEventRelation, type IMentions, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import {
    type ReplacementEvent,
    type RoomMessageEventContent,
    type RoomMessageTextEventContent,
} from "matrix-js-sdk/src/types";

import SettingsStore from "../../../../../settings/SettingsStore";
import { parsePermalink } from "../../../../../utils/permalinks/Permalinks";
import { addReplyToMessageContent } from "../../../../../utils/Reply";
import { isNotNull } from "../../../../../Typeguards";

export const EMOTE_PREFIX = "/me ";

// Merges favouring the given relation
function attachRelation(content: IContent, relation?: IEventRelation): void {
    if (relation) {
        content["m.relates_to"] = {
            ...content["m.relates_to"],
            ...relation,
        };
    }
}

/**
 * Fill in the mentions the message makes, in the form MSC3952 asks for.
 *
 * The composer marks its pills up with `data-mention-type`, and that markup is present in its
 * output whether or not the message is being sent as formatted text — unlike the body, which has
 * had the pills flattened back down to plain text by the time it is built.
 *
 * @param content - The event content being assembled, which is modified in place.
 * @param message - The composer's own output for the message being sent.
 * @param sender - The Matrix ID of the sender, who is never mentioned by their own message, if known.
 * @param replyToEvent - The event being replied to, whose sender is mentioned, if this is a reply.
 * @param editedEvent - The event being edited, if this is an edit.
 */
function attachMentions(
    content: RoomMessageTextEventContent & ReplacementEvent<RoomMessageTextEventContent>,
    message: string,
    sender: string | undefined,
    replyToEvent: MatrixEvent | undefined,
    editedEvent: MatrixEvent | undefined,
): void {
    // The property is always present, even when empty, so that legacy push rules stay disabled.
    const mentions: IMentions = (content["m.mentions"] = {});

    const userMentions = new Set<string>();
    let roomMention = false;

    if (replyToEvent) {
        userMentions.add(replyToEvent.sender!.userId);
    }

    const document = new DOMParser().parseFromString(message, "text/html");
    for (const mention of document.querySelectorAll("a[data-mention-type]")) {
        const mentionType = mention.getAttribute("data-mention-type");
        if (mentionType === "at-room") {
            roomMention = true;
        } else if (mentionType === "user") {
            const href = mention.getAttribute("href");
            const userId = href && parsePermalink(href)?.userId;
            if (userId) userMentions.add(userId);
        }
        // A room pill links to a room rather than mentioning anybody, so it is left alone.
    }

    if (sender) userMentions.delete(sender);

    if (editedEvent) {
        // The replacement says who the message mentions now; the fallback says who has newly been
        // mentioned by it, so that editing does not notify everyone in it a second time.
        const newMentions: IMentions = (content["m.new_content"]["m.mentions"] = {});
        if (userMentions.size) newMentions.user_ids = [...userMentions];
        if (roomMention) newMentions.room = true;

        const previousMentions = editedEvent.getContent()["m.mentions"];
        if (Array.isArray(previousMentions?.user_ids)) {
            previousMentions.user_ids.forEach((userId: string) => userMentions.delete(userId));
        }
        if (previousMentions?.room) roomMention = false;
    }

    if (userMentions.size) mentions.user_ids = [...userMentions];
    if (roomMention) mentions.room = true;
}

interface CreateMessageContentParams {
    relation?: IEventRelation;
    replyToEvent?: MatrixEvent;
    editedEvent?: MatrixEvent;
    /** The Matrix ID of the sender, so that they are not recorded as mentioning themselves. */
    sender?: string;
}

const isMatrixEvent = (e: MatrixEvent | undefined): e is MatrixEvent => e instanceof MatrixEvent;

export async function createMessageContent(
    message: string,
    isHTML: boolean,
    { relation, replyToEvent, editedEvent, sender }: CreateMessageContentParams,
): Promise<RoomMessageEventContent> {
    const isEditing = isMatrixEvent(editedEvent);

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
    // BUT if we're not, the message content will be plain text where we need to convert the mentions
    const body = isHTML ? await richToPlain(message, false) : convertPlainTextToBody(message);

    const content = {
        msgtype: isEmote ? MsgType.Emote : MsgType.Text,
        body: isEditing ? `* ${body}` : body,
    } as RoomMessageTextEventContent & ReplacementEvent<RoomMessageTextEventContent>;

    // TODO markdown support

    const isMarkdownEnabled = SettingsStore.getValue("MessageComposerInput.useMarkdown");
    const formattedBody = isHTML ? message : isMarkdownEnabled ? await plainToRich(message, true) : null;

    if (formattedBody) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = isEditing ? `* ${formattedBody}` : formattedBody;
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

    attachMentions(content, message, sender, replyToEvent, isEditing ? editedEvent : undefined);
    attachRelation(content, newRelation);

    if (!isEditing && replyToEvent) {
        addReplyToMessageContent(content, replyToEvent);
    }

    return content;
}

/**
 * Without a model, we need to manually amend mentions in uncontrolled message content
 * to make sure that mentions meet the matrix specification.
 *
 * @param content - the output from the `MessageComposer` state when in plain text mode
 * @returns - a string formatted with the mentions replaced as required
 */
function convertPlainTextToBody(content: string): string {
    const document = new DOMParser().parseFromString(content, "text/html");
    const mentions = Array.from(document.querySelectorAll("a[data-mention-type]"));

    mentions.forEach((mention) => {
        const mentionType = mention.getAttribute("data-mention-type");
        switch (mentionType) {
            case "at-room": {
                mention.replaceWith("@room");
                break;
            }
            case "user": {
                const innerText = mention.innerHTML;
                mention.replaceWith(innerText);
                break;
            }
            case "room": {
                // for this case we use parsePermalink to try and get the mx id
                const href = mention.getAttribute("href");

                // if the mention has no href attribute, leave it alone
                if (href === null) break;

                // otherwise, attempt to parse the room alias or id from the href
                const permalinkParts = parsePermalink(href);

                // then if we have permalink parts with a valid roomIdOrAlias, replace the
                // room mention with that text
                if (isNotNull(permalinkParts) && isNotNull(permalinkParts.roomIdOrAlias)) {
                    mention.replaceWith(permalinkParts.roomIdOrAlias);
                }
                break;
            }
            default:
                break;
        }
    });

    return document.body.innerHTML;
}
