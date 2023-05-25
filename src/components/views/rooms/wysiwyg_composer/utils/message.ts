/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import { Composer as ComposerEvent } from "@matrix-org/analytics-events/types/typescript/Composer";
import { IContent, IEventRelation, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { ISendEventResponse, MatrixClient } from "matrix-js-sdk/src/matrix";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";

import { PosthogAnalytics } from "../../../../../PosthogAnalytics";
import SettingsStore from "../../../../../settings/SettingsStore";
import { decorateStartSendingTime, sendRoundTripMetric } from "../../../../../sendTimePerformanceMetrics";
import { RoomPermalinkCreator } from "../../../../../utils/permalinks/Permalinks";
import { doMaybeLocalRoomAction } from "../../../../../utils/local-room";
import { CHAT_EFFECTS } from "../../../../../effects";
import { containsEmoji } from "../../../../../effects/utils";
import { IRoomState } from "../../../../structures/RoomView";
import dis from "../../../../../dispatcher/dispatcher";
import { createRedactEventDialog } from "../../../dialogs/ConfirmRedactDialog";
import { endEditing, cancelPreviousPendingEdit } from "./editing";
import EditorStateTransfer from "../../../../../utils/EditorStateTransfer";
import { createMessageContent, EMOTE_PREFIX } from "./createMessageContent";
import { isContentModified } from "./isContentModified";
import { CommandCategories, getCommand } from "../../../../../SlashCommands";
import { runSlashCommand, shouldSendAnyway } from "../../../../../editor/commands";
import { Action } from "../../../../../dispatcher/actions";
import { addReplyToMessageContent } from "../../../../../utils/Reply";
import { attachRelation } from "../../SendMessageComposer";

export interface SendMessageParams {
    mxClient: MatrixClient;
    relation?: IEventRelation;
    replyToEvent?: MatrixEvent;
    roomContext: IRoomState;
    permalinkCreator?: RoomPermalinkCreator;
    includeReplyLegacyFallback?: boolean;
}

export async function sendMessage(
    message: string,
    isHTML: boolean,
    { roomContext, mxClient, ...params }: SendMessageParams,
): Promise<ISendEventResponse | undefined> {
    const { relation, replyToEvent, permalinkCreator } = params;
    const { room } = roomContext;
    const roomId = room?.roomId;

    if (!roomId) {
        return;
    }

    const posthogEvent: ComposerEvent = {
        eventName: "Composer",
        isEditing: false,
        isReply: Boolean(replyToEvent),
        // TODO thread
        inThread: relation?.rel_type === THREAD_RELATION_TYPE.name,
    };

    // TODO thread
    /*if (posthogEvent.inThread) {
        const threadRoot = room.findEventById(relation?.event_id);
        posthogEvent.startsThread = threadRoot?.getThread()?.events.length === 1;
    }*/
    PosthogAnalytics.instance.trackEvent<ComposerEvent>(posthogEvent);

    let content: IContent | null = null;

    // Slash command handling here approximates what can be found in SendMessageComposer.sendMessage()
    // but note that the /me and // special cases are handled by the call to createMessageContent
    if (message.startsWith("/") && !message.startsWith("//") && !message.startsWith(EMOTE_PREFIX)) {
        const { cmd, args } = getCommand(message);
        if (cmd) {
            const threadId = relation?.rel_type === THREAD_RELATION_TYPE.name ? relation?.event_id : null;
            let commandSuccessful: boolean;
            [content, commandSuccessful] = await runSlashCommand(mxClient, cmd, args, roomId, threadId ?? null);

            if (!commandSuccessful) {
                return; // errored
            }

            if (
                content &&
                (cmd.category === CommandCategories.messages || cmd.category === CommandCategories.effects)
            ) {
                attachRelation(content, relation);
                if (replyToEvent) {
                    addReplyToMessageContent(content, replyToEvent, {
                        permalinkCreator,
                        // Exclude the legacy fallback for custom event types such as those used by /fireworks
                        includeLegacyFallback: content.msgtype?.startsWith("m.") ?? true,
                    });
                }
            } else {
                // instead of setting shouldSend to false as in SendMessageComposer, just return
                return;
            }
        } else {
            const sendAnyway = await shouldSendAnyway(message);
            // re-focus the composer after QuestionDialog is closed
            dis.dispatch({
                action: Action.FocusAComposer,
                context: roomContext.timelineRenderingType,
            });
            // if !sendAnyway bail to let the user edit the composer and try again
            if (!sendAnyway) return;
        }
    }

    // if content is null, we haven't done any slash command processing, so generate some content
    content ??= await createMessageContent(message, isHTML, params);

    // TODO replace emotion end of message ?

    // TODO quick reaction

    // don't bother sending an empty message
    if (!content.body.trim()) {
        return;
    }

    if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
        decorateStartSendingTime(content);
    }

    const threadId = relation?.event_id && relation?.rel_type === THREAD_RELATION_TYPE.name ? relation.event_id : null;

    const prom = doMaybeLocalRoomAction(
        roomId,
        (actualRoomId: string) => mxClient.sendMessage(actualRoomId, threadId, content as IContent),
        mxClient,
    );

    if (replyToEvent) {
        // Clear reply_to_event as we put the message into the queue
        // if the send fails, retry will handle resending.
        dis.dispatch({
            action: "reply_to_event",
            event: null,
            context: roomContext.timelineRenderingType,
        });
    }

    dis.dispatch({ action: "message_sent" });
    CHAT_EFFECTS.forEach((effect) => {
        if (content && containsEmoji(content, effect.emojis)) {
            // For initial threads launch, chat effects are disabled
            // see #19731
            const isNotThread = relation?.rel_type !== THREAD_RELATION_TYPE.name;
            if (isNotThread) {
                dis.dispatch({ action: `effects.${effect.command}` });
            }
        }
    });
    if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
        prom.then((resp) => {
            sendRoundTripMetric(mxClient, roomId, resp.event_id);
        });
    }

    // TODO save history
    // TODO save local state

    //if (shouldSend && SettingsStore.getValue("scrollToBottomOnMessageSent")) {
    if (SettingsStore.getValue("scrollToBottomOnMessageSent")) {
        dis.dispatch({
            action: "scroll_to_bottom",
            timelineRenderingType: roomContext.timelineRenderingType,
        });
    }

    return prom;
}

interface EditMessageParams {
    mxClient: MatrixClient;
    roomContext: IRoomState;
    editorStateTransfer: EditorStateTransfer;
}

export async function editMessage(
    html: string,
    { roomContext, mxClient, editorStateTransfer }: EditMessageParams,
): Promise<ISendEventResponse | undefined> {
    const editedEvent = editorStateTransfer.getEvent();

    PosthogAnalytics.instance.trackEvent<ComposerEvent>({
        eventName: "Composer",
        isEditing: true,
        inThread: Boolean(editedEvent?.getThread()),
        isReply: Boolean(editedEvent.replyEventId),
    });

    // TODO emoji
    // Replace emoticon at the end of the message
    /*    if (SettingsStore.getValue('MessageComposerInput.autoReplaceEmoji')) {
        const caret = this.editorRef.current?.getCaret();
        const position = this.model.positionForOffset(caret.offset, caret.atNodeEnd);
        this.editorRef.current?.replaceEmoticon(position, REGEX_EMOTICON);
    }*/
    const editContent = await createMessageContent(html, true, { editedEvent });
    const newContent = editContent["m.new_content"];

    const shouldSend = true;

    if (newContent?.body === "") {
        cancelPreviousPendingEdit(mxClient, editorStateTransfer);
        createRedactEventDialog({
            mxEvent: editedEvent,
            onCloseDialog: () => {
                endEditing(roomContext);
            },
        });
        return;
    }

    let response: Promise<ISendEventResponse> | undefined;

    const roomId = editedEvent.getRoomId();

    // If content is modified then send an updated event into the room
    if (isContentModified(newContent, editorStateTransfer) && roomId) {
        // TODO Slash Commands

        if (shouldSend) {
            cancelPreviousPendingEdit(mxClient, editorStateTransfer);

            const event = editorStateTransfer.getEvent();
            const threadId = event.threadRootId || null;

            response = mxClient.sendMessage(roomId, threadId, editContent);
            dis.dispatch({ action: "message_sent" });
        }
    }

    endEditing(roomContext);
    return response;
}
