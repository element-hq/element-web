/*
Copyright 2015, 2016 OpenMarket Ltd

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

import {MatrixClientPeg} from "./MatrixClientPeg";
import shouldHideEvent from './shouldHideEvent';
import * as sdk from "./index";
import {haveTileForEvent} from "./components/views/rooms/EventTile";

/**
 * Returns true iff this event arriving in a room should affect the room's
 * count of unread messages
 */
export function eventTriggersUnreadCount(ev) {
    if (ev.sender && ev.sender.userId == MatrixClientPeg.get().credentials.userId) {
        return false;
    } else if (ev.getType() == 'm.room.member') {
        return false;
    } else if (ev.getType() == 'm.room.third_party_invite') {
        return false;
    } else if (ev.getType() == 'm.call.answer' || ev.getType() == 'm.call.hangup') {
        return false;
    } else if (ev.getType() == 'm.room.message' && ev.getContent().msgtype == 'm.notify') {
        return false;
    } else if (ev.getType() == 'm.room.aliases' || ev.getType() == 'm.room.canonical_alias') {
        return false;
    } else if (ev.getType() == 'm.room.server_acl') {
        return false;
    }
    return haveTileForEvent(ev);
}

export function doesRoomHaveUnreadMessages(room) {
    const myUserId = MatrixClientPeg.get().credentials.userId;

    // get the most recent read receipt sent by our account.
    // N.B. this is NOT a read marker (RM, aka "read up to marker"),
    // despite the name of the method :((
    const readUpToId = room.getEventReadUpTo(myUserId);

    // as we don't send RRs for our own messages, make sure we special case that
    // if *we* sent the last message into the room, we consider it not unread!
    // Should fix: https://github.com/vector-im/element-web/issues/3263
    //             https://github.com/vector-im/element-web/issues/2427
    // ...and possibly some of the others at
    //             https://github.com/vector-im/element-web/issues/3363
    if (room.timeline.length &&
        room.timeline[room.timeline.length - 1].sender &&
        room.timeline[room.timeline.length - 1].sender.userId === myUserId) {
        return false;
    }

    // this just looks at whatever history we have, which if we've only just started
    // up probably won't be very much, so if the last couple of events are ones that
    // don't count, we don't know if there are any events that do count between where
    // we have and the read receipt. We could fetch more history to try & find out,
    // but currently we just guess.

    // Loop through messages, starting with the most recent...
    for (let i = room.timeline.length - 1; i >= 0; --i) {
        const ev = room.timeline[i];

        if (ev.getId() == readUpToId) {
            // If we've read up to this event, there's nothing more recent
            // that counts and we can stop looking because the user's read
            // this and everything before.
            return false;
        } else if (!shouldHideEvent(ev) && eventTriggersUnreadCount(ev)) {
            // We've found a message that counts before we hit
            // the user's read receipt, so this room is definitely unread.
            return true;
        }
    }
    // If we got here, we didn't find a message that counted but didn't find
    // the user's read receipt either, so we guess and say that the room is
    // unread on the theory that false positives are better than false
    // negatives here.
    return true;
}
