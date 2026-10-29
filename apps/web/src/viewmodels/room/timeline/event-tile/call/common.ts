/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { CallType } from "@element-hq/web-shared-components";
import { EventType, RelationType, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type IRTCNotificationContent } from "matrix-js-sdk/src/matrixrtc";

import { type GetRelationsForEvent } from "../../../../../components/views/rooms/EventTile";

/**
 * Find the call intent from a given rtc notification event.
 * @param event Rtc notification event
 */
export function getIntentFromEvent(event: MatrixEvent): CallType {
    const content = event.getContent<IRTCNotificationContent>();
    const intentInContent = content["m.call.intent"];
    switch (intentInContent) {
        case "audio":
            return CallType.Voice;
        case "video":
        default:
            return CallType.Video;
    }
}

/**
 * Get all declined events that is related to the given rtc notification event.
 * @param event rtc notification event
 */
/**
 * MSC4075 invite progress: the callee's side reporting what became of
 * the invite (a bridge relaying it to SIP, for instance).
 */
const RTC_INVITE_PROGRESS = "org.matrix.msc4075.rtc.invite_progress";

/**
 * Why the call never connected, from the invite progress relation with a
 * terminal state (`busy` or `unreachable`), e.g. "SIP 404".
 */
export function getFailureReason(event: MatrixEvent, getRelationsForEvent?: GetRelationsForEvent): string | null {
    const eventId = event.getId();
    if (!eventId || !getRelationsForEvent) return null;
    const relations = getRelationsForEvent(eventId, RelationType.Reference, RTC_INVITE_PROGRESS)?.getRelations();
    const failed = relations?.find((e) => ["busy", "unreachable"].includes(e.getContent().state));
    if (!failed) return null;
    const { state, reason } = failed.getContent<{ state: string; reason?: string }>();
    return reason ? `${state} (${reason})` : state;
}

export function getDeclinedEvents(
    event: MatrixEvent,
    getRelationsForEvent?: GetRelationsForEvent,
): MatrixEvent[] | null {
    const eventId = event.getId();
    if (eventId && getRelationsForEvent) {
        const relations = getRelationsForEvent(eventId, RelationType.Reference, EventType.RTCDecline)?.getRelations();
        if (relations) return relations;
    }
    return null;
}
