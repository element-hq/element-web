/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { EffectiveMembership, getEffectiveMembership } from "../../../../../utils/membership";
import * as Unread from "../../../../../Unread";

export function shouldCauseReorder(event: MatrixEvent): boolean {
    const type = event.getType();
    const content = event.getContent();
    const prevContent = event.getPrevContent();

    // Never ignore membership changes
    if (type === EventType.RoomMember && prevContent.membership !== content.membership) return true;

    // Ignore display name changes
    if (type === EventType.RoomMember && prevContent.displayname !== content.displayname) return false;
    // Ignore avatar changes
    if (type === EventType.RoomMember && prevContent.avatar_url !== content.avatar_url) return false;

    return true;
}

export const getLastTimestamp = (r: Room, userId: string): number => {
    const mainTimelineLastTs = ((): number => {
        // Apparently we can have rooms without timelines, at least under testing
        // environments. Just return MAX_INT when this happens.
        if (!r?.timeline) {
            return Number.MAX_SAFE_INTEGER;
        }
        // MSC4186: Simplified Sliding Sync sets this.
        // If it's present, sort by it.
        const bumpStamp = r.getBumpStamp();
        if (bumpStamp) {
            return bumpStamp;
        }

        // If the room hasn't been joined yet, it probably won't have a timeline to
        // parse. We'll still fall back to the timeline if this fails, but chances
        // are we'll at least have our own membership event to go off of.
        const effectiveMembership = getEffectiveMembership(r.getMyMembership());
        if (effectiveMembership !== EffectiveMembership.Join) {
            const membershipEvent = r.currentState.getStateEvents(EventType.RoomMember, userId);
            if (membershipEvent && !Array.isArray(membershipEvent)) {
                return membershipEvent.getTs();
            }
        }

        for (let i = r.timeline.length - 1; i >= 0; --i) {
            const ev = r.timeline[i];
            if (!ev.getTs()) continue; // skip events that don't have timestamps (tests only?)

            if (
                (ev.getSender() === userId && shouldCauseReorder(ev)) ||
                Unread.eventTriggersUnreadCount(r.client, ev)
            ) {
                return ev.getTs();
            }
        }

        // we might only have events that don't trigger the unread indicator,
        // in which case use the oldest event even if normally it wouldn't count.
        // This is better than just assuming the last event was forever ago.
        return r.timeline[0]?.getTs() ?? 0;
    })();

    const threadLastEventTimestamps = r.getThreads().map((thread) => {
        const event = thread.replyToEvent ?? thread.rootEvent;
        return event?.getTs() ?? 0;
    });

    return Math.max(mainTimelineLastTs, ...threadLastEventTimestamps);
};
