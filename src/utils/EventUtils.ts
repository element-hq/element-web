/*
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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

import { EventStatus, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType, EVENT_VISIBILITY_CHANGE_TYPE, MsgType, RelationType } from "matrix-js-sdk/src/@types/event";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { logger } from "matrix-js-sdk/src/logger";
import { M_POLL_END, M_POLL_START } from "matrix-js-sdk/src/@types/polls";
import { M_LOCATION } from "matrix-js-sdk/src/@types/location";
import { M_BEACON_INFO } from "matrix-js-sdk/src/@types/beacon";
import { THREAD_RELATION_TYPE } from "matrix-js-sdk/src/models/thread";

import shouldHideEvent from "../shouldHideEvent";
import { GetRelationsForEvent } from "../components/views/rooms/EventTile";
import SettingsStore from "../settings/SettingsStore";
import defaultDispatcher from "../dispatcher/dispatcher";
import { TimelineRenderingType } from "../contexts/RoomContext";
import { launchPollEditor } from "../components/views/messages/MPollBody";
import { Action } from "../dispatcher/actions";
import { ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import { VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "../voice-broadcast/types";

/**
 * Returns whether an event should allow actions like reply, reactions, edit, etc.
 * which effectively checks whether it's a regular message that has been sent and that we
 * can display.
 *
 * @param {MatrixEvent} mxEvent The event to check
 * @returns {boolean} true if actionable
 */
export function isContentActionable(mxEvent: MatrixEvent): boolean {
    const { status: eventStatus } = mxEvent;

    // status is SENT before remote-echo, null after
    const isSent = !eventStatus || eventStatus === EventStatus.SENT;

    if (isSent && !mxEvent.isRedacted()) {
        if (mxEvent.getType() === "m.room.message") {
            const content = mxEvent.getContent();
            if (content.msgtype && content.msgtype !== "m.bad.encrypted" && content.hasOwnProperty("body")) {
                return true;
            }
        } else if (
            mxEvent.getType() === "m.sticker" ||
            M_POLL_START.matches(mxEvent.getType()) ||
            M_POLL_END.matches(mxEvent.getType()) ||
            M_BEACON_INFO.matches(mxEvent.getType()) ||
            (mxEvent.getType() === VoiceBroadcastInfoEventType &&
                mxEvent.getContent()?.state === VoiceBroadcastInfoState.Started)
        ) {
            return true;
        }
    }

    return false;
}

export function canEditContent(matrixClient: MatrixClient, mxEvent: MatrixEvent): boolean {
    const isCancellable = mxEvent.getType() === EventType.RoomMessage || M_POLL_START.matches(mxEvent.getType());

    if (
        !isCancellable ||
        mxEvent.status === EventStatus.CANCELLED ||
        mxEvent.isRedacted() ||
        mxEvent.isRelation(RelationType.Replace) ||
        mxEvent.getSender() !== matrixClient.getUserId()
    ) {
        return false;
    }

    const { msgtype, body } = mxEvent.getOriginalContent();
    return (
        M_POLL_START.matches(mxEvent.getType()) ||
        ((msgtype === MsgType.Text || msgtype === MsgType.Emote) && !!body && typeof body === "string")
    );
}

export function canEditOwnEvent(matrixClient: MatrixClient, mxEvent: MatrixEvent): boolean {
    // for now we only allow editing
    // your own events. So this just call through
    // In the future though, moderators will be able to
    // edit other people's messages as well but we don't
    // want findEditableEvent to return other people's events
    // hence this method.
    return canEditContent(matrixClient, mxEvent);
}

const MAX_JUMP_DISTANCE = 100;
export function findEditableEvent({
    matrixClient,
    events,
    isForward,
    fromEventId,
}: {
    matrixClient: MatrixClient;
    events: MatrixEvent[];
    isForward: boolean;
    fromEventId?: string;
}): MatrixEvent | undefined {
    if (!events.length) return;
    const maxIdx = events.length - 1;
    const inc = isForward ? 1 : -1;
    const beginIdx = isForward ? 0 : maxIdx;
    let endIdx = isForward ? maxIdx : 0;
    if (!fromEventId) {
        endIdx = Math.min(Math.max(0, beginIdx + inc * MAX_JUMP_DISTANCE), maxIdx);
    }
    let foundFromEventId = !fromEventId;
    for (let i = beginIdx; i !== endIdx + inc; i += inc) {
        const e = events[i];
        // find start event first
        if (!foundFromEventId && e.getId() === fromEventId) {
            foundFromEventId = true;
            // don't look further than MAX_JUMP_DISTANCE events from `fromEventId`
            // to not iterate potentially 1000nds of events on key up/down
            endIdx = Math.min(Math.max(0, i + inc * MAX_JUMP_DISTANCE), maxIdx);
        } else if (foundFromEventId && !shouldHideEvent(e) && canEditOwnEvent(matrixClient, e)) {
            // otherwise look for editable event
            return e;
        }
    }
}

/**
 * How we should render a message depending on its moderation state.
 */
export enum MessageModerationState {
    /**
     * The message is visible to all.
     */
    VISIBLE_FOR_ALL = "VISIBLE_FOR_ALL",
    /**
     * The message is hidden pending moderation and we're not a user who should
     * see it nevertheless.
     */
    HIDDEN_TO_CURRENT_USER = "HIDDEN_TO_CURRENT_USER",
    /**
     * The message is hidden pending moderation and we're either the author of
     * the message or a moderator. In either case, we need to see the message
     * with a marker.
     */
    SEE_THROUGH_FOR_CURRENT_USER = "SEE_THROUGH_FOR_CURRENT_USER",
}

// This is lazily initialized and cached since getMessageModerationState needs it,
// and is called on timeline rendering hot-paths
let msc3531Enabled: boolean | null = null;
const getMsc3531Enabled = (): boolean => {
    if (msc3531Enabled === null) {
        msc3531Enabled = SettingsStore.getValue("feature_msc3531_hide_messages_pending_moderation");
    }
    return msc3531Enabled!;
};

/**
 * Determine whether a message should be displayed as hidden pending moderation.
 *
 * If MSC3531 is deactivated in settings, all messages are considered visible
 * to all.
 */
export function getMessageModerationState(mxEvent: MatrixEvent, client: MatrixClient): MessageModerationState {
    if (!getMsc3531Enabled()) {
        return MessageModerationState.VISIBLE_FOR_ALL;
    }
    const visibility = mxEvent.messageVisibility();
    if (visibility.visible) {
        return MessageModerationState.VISIBLE_FOR_ALL;
    }

    // At this point, we know that the message is marked as hidden
    // pending moderation. However, if we're the author or a moderator,
    // we still need to display it.

    if (mxEvent.sender?.userId === client.getUserId()) {
        // We're the author, show the message.
        return MessageModerationState.SEE_THROUGH_FOR_CURRENT_USER;
    }

    const room = client.getRoom(mxEvent.getRoomId());
    if (
        EVENT_VISIBILITY_CHANGE_TYPE.name &&
        room?.currentState.maySendStateEvent(EVENT_VISIBILITY_CHANGE_TYPE.name, client.getUserId()!)
    ) {
        // We're a moderator (as indicated by prefixed event name), show the message.
        return MessageModerationState.SEE_THROUGH_FOR_CURRENT_USER;
    }
    if (
        EVENT_VISIBILITY_CHANGE_TYPE.altName &&
        room?.currentState.maySendStateEvent(EVENT_VISIBILITY_CHANGE_TYPE.altName, client.getUserId()!)
    ) {
        // We're a moderator (as indicated by unprefixed event name), show the message.
        return MessageModerationState.SEE_THROUGH_FOR_CURRENT_USER;
    }
    // For everybody else, hide the message.
    return MessageModerationState.HIDDEN_TO_CURRENT_USER;
}

export function isVoiceMessage(mxEvent: MatrixEvent): boolean {
    const content = mxEvent.getContent();
    // MSC2516 is a legacy identifier. See https://github.com/matrix-org/matrix-doc/pull/3245
    return !!content["org.matrix.msc2516.voice"] || !!content["org.matrix.msc3245.voice"];
}

export async function fetchInitialEvent(
    client: MatrixClient,
    roomId: string,
    eventId: string,
): Promise<MatrixEvent | null> {
    let initialEvent: MatrixEvent | null;

    try {
        const eventData = await client.fetchRoomEvent(roomId, eventId);
        initialEvent = new MatrixEvent(eventData);
    } catch (e) {
        logger.warn("Could not find initial event: " + eventId);
        initialEvent = null;
    }

    if (client.supportsThreads() && initialEvent?.isRelation(THREAD_RELATION_TYPE.name) && !initialEvent.getThread()) {
        const threadId = initialEvent.threadRootId!;
        const room = client.getRoom(roomId);
        const mapper = client.getEventMapper();
        const rootEvent = room?.findEventById(threadId) ?? mapper(await client.fetchRoomEvent(roomId, threadId));
        try {
            room?.createThread(threadId, rootEvent, [initialEvent], true);
        } catch (e) {
            logger.warn("Could not find root event: " + threadId);
        }
    }

    return initialEvent;
}

export function editEvent(
    matrixClient: MatrixClient,
    mxEvent: MatrixEvent,
    timelineRenderingType: TimelineRenderingType,
    getRelationsForEvent?: GetRelationsForEvent,
): void {
    if (!canEditContent(matrixClient, mxEvent)) return;

    if (M_POLL_START.matches(mxEvent.getType())) {
        launchPollEditor(mxEvent, getRelationsForEvent);
    } else {
        defaultDispatcher.dispatch({
            action: Action.EditEvent,
            event: mxEvent,
            timelineRenderingType: timelineRenderingType,
        });
    }
}

export function canCancel(status?: EventStatus | null): boolean {
    return status === EventStatus.QUEUED || status === EventStatus.NOT_SENT || status === EventStatus.ENCRYPTING;
}

export const isLocationEvent = (event: MatrixEvent): boolean => {
    const eventType = event.getType();
    return (
        M_LOCATION.matches(eventType) ||
        (eventType === EventType.RoomMessage && M_LOCATION.matches(event.getContent().msgtype!))
    );
};

export function hasThreadSummary(event: MatrixEvent): boolean {
    return event.isThreadRoot && !!event.getThread()?.length && !!event.getThread()!.replyToEvent;
}

export function canPinEvent(event: MatrixEvent): boolean {
    return !M_BEACON_INFO.matches(event.getType());
}

export const highlightEvent = (roomId: string, eventId: string): void => {
    defaultDispatcher.dispatch<ViewRoomPayload>({
        action: Action.ViewRoom,
        event_id: eventId,
        highlighted: true,
        room_id: roomId,
        metricsTrigger: undefined, // room doesn't change
    });
};
