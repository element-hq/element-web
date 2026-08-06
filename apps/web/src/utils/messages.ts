/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, type IContent, type IMentions, type IEventRelation } from "matrix-js-sdk/src/matrix";
import { type MessageComposerUrlPreviewSnapshot } from "@element-hq/web-shared-components";

import type EditorModel from "../editor/model";
import { Type } from "../editor/parts";
import { type RoomMessageEventContent } from "../../@types/url-preview";
import SettingsStore from "../settings/SettingsStore";
import { parsePermalink } from "./permalinks/Permalinks";

/**
 * Collect the users which the message being sent actually links to.
 *
 * @param content - The event content, whose formatted body has already been built.
 * @returns The Matrix IDs of every user the message links to, or null when there is no formatted
 *     body to read and so nothing can be said about who it links to.
 */
function usersLinkedFrom(content: IContent): Set<string> | null {
    // An edit carries the real message under m.new_content; the top level body is only the fallback.
    const formattedBody = content["m.new_content"]?.formatted_body ?? content.formatted_body;
    if (typeof formattedBody !== "string") return null;

    const users = new Set<string>();
    const parsed = new DOMParser().parseFromString(formattedBody, "text/html");
    for (const anchor of parsed.querySelectorAll("a[href]")) {
        const userId = parsePermalink(anchor.getAttribute("href")!)?.userId;
        if (userId) users.add(userId);
    }
    return users;
}

/**
 * Build the mentions information based on the editor model (and any related events):
 *
 * 1. Search the model parts for room or user pills and fill in the mentions object.
 * 2. If this is a reply to another event, include any user mentions from that
 *    (but do not include a room mention).
 *
 * @param sender - The Matrix ID of the user sending the event.
 * @param content - The event content.
 * @param model - The editor model to search for mentions, null if there is no editor.
 * @param replyToEvent - The event being replied to or undefined if it is not a reply.
 * @param editedContent - The content of the parent event being edited.
 */
export function attachMentions(
    sender: string,
    content: IContent,
    model: EditorModel | null,
    replyToEvent: MatrixEvent | undefined,
    editedContent: IContent | null = null,
): void {
    // We always attach the mentions even if the home server doesn't yet support
    // intentional mentions. This is safe because m.mentions is an additive change
    // that should simply be ignored by incapable home servers.

    // The mentions property *always* gets included to disable legacy push rules.
    const mentions: IMentions = (content["m.mentions"] = {});

    const userMentions = new Set<string>();
    let roomMention = false;

    // If there's a reply, initialize the mentioned users as the sender of that event.
    if (replyToEvent) {
        userMentions.add(replyToEvent.sender!.userId);
    }

    // If user provided content is available, check to see if any users are mentioned.
    if (model) {
        // A pill only reaches the reader as a mention if the message which was built actually links
        // to that user. Markdown does not linkify inside a code block, and /spoiler flattens its
        // argument to plain text, so in both of those the pill is gone from what is being sent and
        // notifying the person would be a mention nobody can see. With Markdown turned off nothing
        // is ever linkified and there is no signal to read, so the pills are taken at face value.
        const linkedUsers = SettingsStore.getValue("MessageComposerInput.useMarkdown")
            ? usersLinkedFrom(content)
            : null;

        // Add any mentioned users in the current content.
        for (const part of model.parts) {
            if (part.type === Type.UserPill) {
                if (!linkedUsers || linkedUsers.has(part.resourceId)) {
                    userMentions.add(part.resourceId);
                }
            } else if (part.type === Type.AtRoomPill) {
                roomMention = true;
            }
        }
    }

    // Ensure the *current* user isn't listed in the mentioned users.
    userMentions.delete(sender);

    // Finally, if this event is editing a previous event, only include users who
    // were not previously mentioned and a room mention if the previous event was
    // not a room mention.
    if (editedContent) {
        // First, the new event content gets the *full* set of users.
        const newContent = content["m.new_content"];
        const newMentions: IMentions = (newContent["m.mentions"] = {});

        // Only include the users/room if there is any content.
        if (userMentions.size) {
            newMentions.user_ids = [...userMentions];
        }
        if (roomMention) {
            newMentions.room = true;
        }

        // Fetch the mentions from the original event and remove any previously
        // mentioned users.
        const prevMentions = editedContent["m.mentions"];
        if (Array.isArray(prevMentions?.user_ids)) {
            prevMentions.user_ids.forEach((userId) => userMentions.delete(userId));
        }

        // If the original event mentioned the room, nothing to do here.
        if (prevMentions?.room) {
            roomMention = false;
        }
    }

    // Only include the users/room if there is any content.
    if (userMentions.size) {
        mentions.user_ids = [...userMentions];
    }
    if (roomMention) {
        mentions.room = true;
    }
}

// Merges favouring the given relation
export function attachRelation(content: IContent, relation?: IEventRelation): void {
    if (relation) {
        content["m.relates_to"] = {
            ...content["m.relates_to"],
            ...relation,
        };
    }
}
export function attachUrlPreviews(
    urlPreviewSnapshot: MessageComposerUrlPreviewSnapshot,
    content: RoomMessageEventContent,
): void {
    if (!SettingsStore.getValue("feature_msc4095_url_preview_bundle")) return;

    if (urlPreviewSnapshot.previews.length) {
        content["com.beeper.linkpreviews"] = urlPreviewSnapshot.previews.map((preview) => {
            return {
                "matched_url": preview.link,
                "og:url": preview.ogUrl,
                "og:title": preview.title,
                "og:description": preview.description,
                "og:image": preview.image?.mxcImageFull,
                "og:image:width": preview.image?.width,
                "og:image:height": preview.image?.height,
                "og:image:type": preview.image?.imageType,
                "matrix:image:size": preview.image?.fileSize,
            };
        });
    }
}
