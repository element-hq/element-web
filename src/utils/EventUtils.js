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
import MatrixClientPeg from '../MatrixClientPeg';
import { findLastIndex, findIndex } from "lodash";
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

    if (isSent && mxEvent.getType() === 'm.room.message') {
        const content = mxEvent.getContent();
        if (
            content.msgtype &&
            content.msgtype !== 'm.bad.encrypted' &&
            content.hasOwnProperty('body')
        ) {
            return true;
        }
    }

    return false;
}

export function canEditContent(mxEvent) {
    return isContentActionable(mxEvent) &&
        mxEvent.getOriginalContent().msgtype === "m.text" &&
        mxEvent.getSender() === MatrixClientPeg.get().getUserId();
}

export function findPreviousEditableEvent(room, fromEventId = undefined) {
    const liveTimeline = room.getLiveTimeline();
    const events = liveTimeline.getEvents();
    let startFromIdx = events.length - 1;
    if (fromEventId) {
        const fromEventIdx = findLastIndex(events, e => e.getId() === fromEventId);
        if (fromEventIdx !== -1) {
            startFromIdx = fromEventIdx - 1;
        }
    }
    const nextEventIdx = findLastIndex(events, e => !shouldHideEvent(e) && canEditContent(e), startFromIdx);
    if (nextEventIdx !== -1) {
        return events[nextEventIdx];
    }
}

export function findNextEditableEvent(room, fromEventId = undefined) {
    const liveTimeline = room.getLiveTimeline();
    const events = liveTimeline.getEvents();
    let startFromIdx = 0;
    if (fromEventId) {
        const fromEventIdx = findIndex(events, e => e.getId() === fromEventId);
        if (fromEventIdx !== -1) {
            startFromIdx = fromEventIdx + 1;
        }
    }
    const nextEventIdx = findIndex(events, e => !shouldHideEvent(e) && canEditContent(e), startFromIdx);
    if (nextEventIdx !== -1) {
        return events[nextEventIdx];
    }
}
