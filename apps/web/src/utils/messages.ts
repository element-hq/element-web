/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    MatrixEvent,
    type IContent,
    type IMentions,
    type IEventRelation,
    type MatrixClient,
    type Room,
    EventType,
    EventStatus,
    MatrixEventEvent,
} from "matrix-js-sdk/src/matrix";
import {
    type MessageComposerUrlPreviewSnapshotEntryLoaded,
    type MessageComposerUrlPreviewSnapshot,
    UrlPreview,
} from "@element-hq/web-shared-components";

import type EditorModel from "../editor/model";
import { Type } from "../editor/parts";
import { type UnstableBundledUrlPreviewSingle, type RoomMessageEventContent } from "../../@types/url-preview";
import SettingsStore from "../settings/SettingsStore";
import { uploadFile } from "../ContentMessages";
import { mediaFromMxc } from "../customisations/Media";

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
        // Add any mentioned users in the current content.
        for (const part of model.parts) {
            if (part.type === Type.UserPill) {
                userMentions.add(part.resourceId);
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

/*
 * Attaches URL preview bundle to message event (MSC4095)
 *
 * Returns TRUE if event has been cancelled while uploading files
 * FALSE if event is not cancelled
 */
export async function attachUrlPreviews(
    client: MatrixClient,
    room: Room,
    urlPreviewSnapshot: MessageComposerUrlPreviewSnapshot,
    content: RoomMessageEventContent,
    messageHasLinks: boolean,
): Promise<boolean> {
    if (!SettingsStore.getValue("feature_msc4095_url_preview_bundle")) return false;

    const isRoomEncrypted = room.hasEncryptionStateEvent();
    const previewsToAttach = urlPreviewSnapshot.entries
        .filter((entry) => entry.include && entry.status === "loaded")
        .map((entry) => (entry as MessageComposerUrlPreviewSnapshotEntryLoaded).preview);

    let eventId: string | undefined = undefined;
    let cancelled = false;
    const abortController = new AbortController();

    /**
     * in an encrypted room, preview images needs to be sent before the message can be sent
     * - the compositor needs to be cleared immediately after pressing enter
     * - the message needs to be displayed as "sending" in the timeline even though it is not yet being sent (it is waiting for image upload)
     */
    function putSendingMessageInTimeline(): void {
        // create the event with the same content as the message
        const txnId = client.makeTxnId();
        const event = new MatrixEvent({
            type: EventType.RoomMessage,
            content,
            event_id: "~" + room.roomId + ":" + txnId,
            sender: client.getSafeUserId(),
            room_id: room.roomId,
            origin_server_ts: Date.now(),
        });
        event.setTxnId(txnId);
        event.setStatus(EventStatus.SENDING);
        event.on(MatrixEventEvent.Status, (_, status) => {
            if (status == EventStatus.CANCELLED) {
                cancelled = true;
                // cancel uploading the images if sending is aborted
                abortController.abort();
            }
        });

        // add to timeline
        room.addPendingEvent(event, txnId);
        // removes the red checkmark when a message is sent in an encrypted room but is not encrypting
        room.updatePendingEvent(event, EventStatus.ENCRYPTING);
        eventId = event.getId();
    }

    /**
     * convert a UrlPreview to a bundle
     * if the UrlPreview contains an image and we are in an encrypted room, it uploads
     * the image to create a bundled with an EncryptedFile
     */
    async function bundleFromPreview(preview: UrlPreview): Promise<UnstableBundledUrlPreviewSingle> {
        const out: UnstableBundledUrlPreviewSingle = {
            "matched_url": preview.link,
            "og:url": preview.ogUrl,
            "og:title": preview.title,
            "og:description": preview.description,
            "og:image:width": preview.image?.width,
            "og:image:height": preview.image?.height,
            "og:image:type": preview.image?.imageType,
        };

        // no image
        if (preview.image?.mxcImageFull === undefined) return out;

        // has image, not encrypted chat
        if (!isRoomEncrypted) {
            out["og:image"] = preview.image?.mxcImageFull;
            out["matrix:image:size"] = preview.image?.fileSize;
            return out;
        }

        // has image, encrypted chat - upload the image to send the EncryptedFile instead
        try {
            // image url from homeserver assumed to not be malformed
            const httpUrl = mediaFromMxc(preview.image.mxcImageFull).srcHttp!;
            const blob = await (await fetch(httpUrl, { signal: abortController.signal })).blob();
            const { file } = await uploadFile(client, room.roomId, blob, undefined, abortController);

            if (!file) {
                console.error(`uploading file to room_id=${room.roomId}, expected EncryptedFile, undefined instead`);
                return out;
            }

            out["beeper:image:encryption"] = file;
        } catch (e) {
            // do not print error if it exited because of the message sending was aborted
            if (!abortController.signal.aborted) console.error(e);
        }

        return out;
    }

    // if encrypted + has previews
    if (isRoomEncrypted && previewsToAttach.some((preview) => preview.image !== undefined))
        putSendingMessageInTimeline();

    const bundle = await Promise.all(previewsToAttach.map(bundleFromPreview));

    if (messageHasLinks) content["com.beeper.linkpreviews"] = bundle;

    // by this point the image has already uploaded, and a real message is already in timeline
    // so remove the fake message
    if (eventId !== undefined) room.removePendingEvent(eventId);

    return cancelled;
}
