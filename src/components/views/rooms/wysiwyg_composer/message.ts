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

import { Composer as ComposerEvent } from "@matrix-org/analytics-events/types/typescript/Composer";
import { IContent, IEventRelation, MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";

import { PosthogAnalytics } from "../../../../PosthogAnalytics";
import SettingsStore from "../../../../settings/SettingsStore";
import { decorateStartSendingTime, sendRoundTripMetric } from "../../../../sendTimePerformanceMetrics";
import { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { doMaybeLocalRoomAction } from "../../../../utils/local-room";
import { CHAT_EFFECTS } from "../../../../effects";
import { containsEmoji } from "../../../../effects/utils";
import { IRoomState } from "../../../structures/RoomView";
import dis from '../../../../dispatcher/dispatcher';
import { addReplyToMessageContent } from "../../../../utils/Reply";

// Merges favouring the given relation
function attachRelation(content: IContent, relation?: IEventRelation): void {
    if (relation) {
        content['m.relates_to'] = {
            ...(content['m.relates_to'] || {}),
            ...relation,
        };
    }
}

interface SendMessageParams {
    mxClient: MatrixClient;
    relation?: IEventRelation;
    replyToEvent?: MatrixEvent;
    roomContext: IRoomState;
    permalinkCreator: RoomPermalinkCreator;
    includeReplyLegacyFallback?: boolean;
}

// exported for tests
export function createMessageContent(
    message: string,
    { relation, replyToEvent, permalinkCreator, includeReplyLegacyFallback = true }:
    Omit<SendMessageParams, 'roomContext' | 'mxClient'>,
): IContent {
    // TODO emote ?

    /*const isEmote = containsEmote(model);
    if (isEmote) {
        model = stripEmoteCommand(model);
    }
    if (startsWith(model, "//")) {
        model = stripPrefix(model, "/");
    }
    model = unescapeMessage(model);*/

    // const body = textSerialize(model);
    const body = message;

    const content: IContent = {
        // TODO emote
    //    msgtype: isEmote ? "m.emote" : "m.text",
        msgtype: "m.text",
        body: body,
    };

    // TODO markdown support

    /*const formattedBody = htmlSerializeIfNeeded(model, {
        forceHTML: !!replyToEvent,
        useMarkdown: SettingsStore.getValue("MessageComposerInput.useMarkdown"),
    });*/
    const formattedBody = message;

    if (formattedBody) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = formattedBody;
    }

    attachRelation(content, relation);

    if (replyToEvent) {
        addReplyToMessageContent(content, replyToEvent, {
            permalinkCreator,
            includeLegacyFallback: includeReplyLegacyFallback,
        });
    }

    return content;
}

export function sendMessage(
    message: string,
    { roomContext, mxClient, ...params }: SendMessageParams,
) {
    const { relation, replyToEvent } = params;
    const { room } = roomContext;
    const { roomId } = room;

    const posthogEvent: ComposerEvent = {
        eventName: "Composer",
        isEditing: false,
        isReply: Boolean(replyToEvent),
        inThread: relation?.rel_type === THREAD_RELATION_TYPE.name,
    };

    // TODO thread
    /*if (posthogEvent.inThread) {
        const threadRoot = room.findEventById(relation?.event_id);
        posthogEvent.startsThread = threadRoot?.getThread()?.events.length === 1;
    }*/
    PosthogAnalytics.instance.trackEvent<ComposerEvent>(posthogEvent);

    let content: IContent;

    // TODO slash comment

    // TODO replace emotion end of message ?

    // TODO quick reaction

    if (!content) {
        content = createMessageContent(
            message,
            params,
        );
    }

    // don't bother sending an empty message
    if (!content.body.trim()) {
        return;
    }

    if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
        decorateStartSendingTime(content);
    }

    const threadId = relation?.rel_type === THREAD_RELATION_TYPE.name
        ? relation.event_id
        : null;

    const prom = doMaybeLocalRoomAction(
        roomId,
        (actualRoomId: string) => mxClient.sendMessage(actualRoomId, threadId, content),
        mxClient,
    );

    if (replyToEvent) {
        // Clear reply_to_event as we put the message into the queue
        // if the send fails, retry will handle resending.
        dis.dispatch({
            action: 'reply_to_event',
            event: null,
            context: roomContext.timelineRenderingType,
        });
    }

    dis.dispatch({ action: "message_sent" });
    CHAT_EFFECTS.forEach((effect) => {
        if (containsEmoji(content, effect.emojis)) {
            // For initial threads launch, chat effects are disabled
            // see #19731
            const isNotThread = relation?.rel_type !== THREAD_RELATION_TYPE.name;
            if (!SettingsStore.getValue("feature_thread") || isNotThread) {
                dis.dispatch({ action: `effects.${effect.command}` });
            }
        }
    });
    if (SettingsStore.getValue("Performance.addSendMessageTimingMetadata")) {
        prom.then(resp => {
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
