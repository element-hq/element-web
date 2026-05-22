/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, EventType, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { isMessageEvent } from "../../../../events/EventTileFactory";

interface ReadReceiptLike {
    userId: string;
}

/** Inputs for deriving EventTile receipt display state. */
export interface EventTileReceiptStateInput {
    /** The Matrix event rendered by the tile. */
    mxEvent: MatrixEvent;
    /** Read receipts supplied for the tile. */
    readReceipts?: ReadReceiptLike[];
    /** Whether the event room is known locally. */
    hasRoom: boolean;
    /** Current user's safe user ID, used for sender eligibility. */
    ownUserId: string;
    /** Whether this is the last successful event sent by the current user. */
    lastSuccessful?: boolean;
    /** Current event send status. */
    eventSendStatus?: EventStatus | null;
    /** The current timeline rendering mode. */
    timelineRenderingType: TimelineRenderingType;
}

/** EventTile receipt display state. */
export interface EventTileReceiptState {
    /** Whether the event is eligible for a sent/sending receipt. */
    isEligibleForSpecialReceipt: boolean;
    /** Whether EventTile should render the sent receipt. */
    shouldShowSentReceipt: boolean;
    /** Whether EventTile should render the sending receipt. */
    shouldShowSendingReceipt: boolean;
    /** Whether EventTile should listen for receipt updates. */
    shouldListenForReceipts: boolean;
}

/**
 * Whether the event type qualifies for a sent/sending receipt.
 * This excludes state events and other events that are not sent by the composer.
 */
export function isEligibleForSpecialReceipt(mxEvent: MatrixEvent): boolean {
    return isMessageEvent(mxEvent) || mxEvent.getType() === EventType.RoomMessageEncrypted;
}

/** Derives receipt display state for EventTile. */
export function getEventTileReceiptState({
    mxEvent,
    readReceipts,
    hasRoom,
    ownUserId,
    lastSuccessful,
    eventSendStatus,
    timelineRenderingType,
}: EventTileReceiptStateInput): EventTileReceiptState {
    const isEligible =
        !readReceipts?.length && hasRoom && mxEvent.getSender() === ownUserId && isEligibleForSpecialReceipt(mxEvent);
    const shouldShowSentReceipt =
        isEligible &&
        !!lastSuccessful &&
        timelineRenderingType !== TimelineRenderingType.ThreadsList &&
        (!eventSendStatus || eventSendStatus === EventStatus.SENT);
    const shouldShowSendingReceipt = isEligible && !!eventSendStatus && eventSendStatus !== EventStatus.SENT;

    return {
        isEligibleForSpecialReceipt: isEligible,
        shouldShowSentReceipt,
        shouldShowSendingReceipt,
        shouldListenForReceipts: shouldShowSentReceipt || shouldShowSendingReceipt,
    };
}
