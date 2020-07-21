/*
Copyright 2019 New Vector Ltd

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

import { EventStatus } from 'matrix-js-sdk';
import {MatrixClientPeg} from '../MatrixClientPeg';
import shouldHideEvent from "../shouldHideEvent";
/**
 * Returns whether an event should allow actions like reply, reactions, edit, etc.
 * which effectively checks whether it's a regular message that has been sent and that we
 * can display.
 *
 * @param {MatrixEvent} mxEvent The event to check
 * @returns {boolean} true if actionable
 */
export function isContentActionable(mxEvent) {
    const { status: eventStatus } = mxEvent;

    // status is SENT before remote-echo, null after
    const isSent = !eventStatus || eventStatus === EventStatus.SENT;

    if (isSent && !mxEvent.isRedacted()) {
        if (mxEvent.getType() === 'm.room.message') {
            const content = mxEvent.getContent();
            if (content.msgtype && content.msgtype !== 'm.bad.encrypted' && content.hasOwnProperty('body')) {
                return true;
            }
        } else if (mxEvent.getType() === 'm.sticker') {
            return true;
        }
    }

    return false;
}

export function canEditContent(mxEvent) {
    if (mxEvent.status === EventStatus.CANCELLED || mxEvent.getType() !== "m.room.message" || mxEvent.isRedacted()) {
        return false;
    }
    const content = mxEvent.getOriginalContent();
    const {msgtype} = content;
    return (msgtype === "m.text" || msgtype === "m.emote") &&
        content.body && typeof content.body === 'string' &&
        mxEvent.getSender() === MatrixClientPeg.get().getUserId();
}

export function canEditOwnEvent(mxEvent) {
    // for now we only allow editing
    // your own events. So this just call through
    // In the future though, moderators will be able to
    // edit other people's messages as well but we don't
    // want findEditableEvent to return other people's events
    // hence this method.
    return canEditContent(mxEvent);
}

const MAX_JUMP_DISTANCE = 100;
export function findEditableEvent(room, isForward, fromEventId = undefined) {
    const liveTimeline = room.getLiveTimeline();
    const events = liveTimeline.getEvents().concat(room.getPendingEvents());
    const maxIdx = events.length - 1;
    const inc = isForward ? 1 : -1;
    const beginIdx = isForward ? 0 : maxIdx;
    let endIdx = isForward ? maxIdx : 0;
    if (!fromEventId) {
        endIdx = Math.min(Math.max(0, beginIdx + (inc * MAX_JUMP_DISTANCE)), maxIdx);
    }
    let foundFromEventId = !fromEventId;
    for (let i = beginIdx; i !== (endIdx + inc); i += inc) {
        const e = events[i];
        // find start event first
        if (!foundFromEventId && e.getId() === fromEventId) {
            foundFromEventId = true;
            // don't look further than MAX_JUMP_DISTANCE events from `fromEventId`
            // to not iterate potentially 1000nds of events on key up/down
            endIdx = Math.min(Math.max(0, i + (inc * MAX_JUMP_DISTANCE)), maxIdx);
        } else if (foundFromEventId && !shouldHideEvent(e) && canEditOwnEvent(e)) {
            // otherwise look for editable event
            return e;
        }
    }
}

