/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixEvent,
    type IContent,
    type MatrixClient,
    EventType,
    MsgType,
    M_POLL_END,
    M_POLL_START,
    M_BEACON_INFO,
} from "matrix-js-sdk/src/matrix";

import SettingsStore from "../settings/SettingsStore";
import { haveRendererForEvent, JitsiEventFactory, JSONEventFactory, pickFactory } from "../events/EventTileFactory";
import { getMessageModerationState, isLocationEvent, MessageModerationState } from "./EventUtils";
import { ElementCall } from "../models/Call";

const calcIsInfoMessage = (
    eventType: EventType | string,
    content: IContent,
    isBubbleMessage: boolean,
    isLeftAlignedBubbleMessage: boolean,
): boolean => {
    return (
        !isBubbleMessage &&
        !isLeftAlignedBubbleMessage &&
        eventType !== EventType.RoomMessage &&
        eventType !== EventType.RoomMessageEncrypted &&
        eventType !== EventType.Sticker &&
        eventType !== EventType.RoomCreate &&
        !M_POLL_START.matches(eventType) &&
        !M_POLL_END.matches(eventType) &&
        !M_BEACON_INFO.matches(eventType)
    );
};

export function getEventDisplayInfo(
    matrixClient: MatrixClient,
    mxEvent: MatrixEvent,
    showHiddenEvents: boolean,
    hideEvent?: boolean,
): {
    isInfoMessage: boolean;
    hasRenderer: boolean;
    isBubbleMessage: boolean;
    isLeftAlignedBubbleMessage: boolean;
    noBubbleEvent: boolean;
    isSeeingThroughMessageHiddenForModeration: boolean;
} {
    const content = mxEvent.getContent();
    const msgtype = content.msgtype;
    const eventType = mxEvent.getType();

    let isSeeingThroughMessageHiddenForModeration = false;
    if (SettingsStore.getValue("feature_msc3531_hide_messages_pending_moderation")) {
        switch (getMessageModerationState(mxEvent, matrixClient)) {
            case MessageModerationState.VISIBLE_FOR_ALL:
            case MessageModerationState.HIDDEN_TO_CURRENT_USER:
                // Nothing specific to do here
                break;
            case MessageModerationState.SEE_THROUGH_FOR_CURRENT_USER:
                // Show message with a marker.
                isSeeingThroughMessageHiddenForModeration = true;
                break;
        }
    }

    let factory = pickFactory(mxEvent, matrixClient, showHiddenEvents);

    // Info messages are basically information about commands processed on a room
    let isBubbleMessage =
        eventType.startsWith("m.key.verification") ||
        (eventType === EventType.RoomMessage && msgtype?.startsWith("m.key.verification")) ||
        eventType === EventType.RoomCreate ||
        eventType === EventType.RoomEncryption ||
        factory === JitsiEventFactory;
    const isLeftAlignedBubbleMessage =
        !isBubbleMessage && (eventType === EventType.CallInvite || ElementCall.CALL_EVENT_TYPE.matches(eventType));
    let isInfoMessage = calcIsInfoMessage(eventType, content, isBubbleMessage, isLeftAlignedBubbleMessage);
    // Some non-info messages want to be rendered in the appropriate bubble column but without the bubble background
    const noBubbleEvent =
        (eventType === EventType.RoomMessage && msgtype === MsgType.Emote) ||
        M_POLL_START.matches(eventType) ||
        M_BEACON_INFO.matches(eventType) ||
        isLocationEvent(mxEvent);

    // If we're showing hidden events in the timeline, we should use the
    // source tile when there's no regular tile for an event and also for
    // replace relations (which otherwise would display as a confusing
    // duplicate of the thing they are replacing).
    if (hideEvent || !haveRendererForEvent(mxEvent, matrixClient, showHiddenEvents)) {
        // forcefully ask for a factory for a hidden event (hidden event setting is checked internally)
        factory = pickFactory(mxEvent, matrixClient, showHiddenEvents, true);
        if (factory === JSONEventFactory) {
            isBubbleMessage = false;
            // Reuse info message avatar and sender profile styling
            isInfoMessage = true;
        }
    }

    return {
        hasRenderer: !!factory,
        isInfoMessage,
        isBubbleMessage,
        isLeftAlignedBubbleMessage,
        noBubbleEvent,
        isSeeingThroughMessageHiddenForModeration,
    };
}
