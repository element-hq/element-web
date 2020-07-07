/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";
import { TagID } from "../../models";
import { IAlgorithm } from "./IAlgorithm";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import * as Unread from "../../../../Unread";
import { EffectiveMembership, getEffectiveMembership } from "../../membership";

/**
 * Sorts rooms according to the last event's timestamp in each room that seems
 * useful to the user.
 */
export class RecentAlgorithm implements IAlgorithm {
    public async sortRooms(rooms: Room[], tagId: TagID): Promise<Room[]> {
        // We cache the timestamp lookup to avoid iterating forever on the timeline
        // of events. This cache only survives a single sort though.
        // We wouldn't need this if `.sort()` didn't constantly try and compare all
        // of the rooms to each other.

        // TODO: We could probably improve the sorting algorithm here by finding changes.
        // See https://github.com/vector-im/riot-web/issues/14035
        // For example, if we spent a little bit of time to determine which elements have
        // actually changed (probably needs to be done higher up?) then we could do an
        // insertion sort or similar on the limited set of changes.

        const myUserId = MatrixClientPeg.get().getUserId();

        const tsCache: { [roomId: string]: number } = {};
        const getLastTs = (r: Room) => {
            if (tsCache[r.roomId]) {
                return tsCache[r.roomId];
            }

            const ts = (() => {
                // Apparently we can have rooms without timelines, at least under testing
                // environments. Just return MAX_INT when this happens.
                if (!r || !r.timeline) {
                    return Number.MAX_SAFE_INTEGER;
                }

                // If the room hasn't been joined yet, it probably won't have a timeline to
                // parse. We'll still fall back to the timeline if this fails, but chances
                // are we'll at least have our own membership event to go off of.
                const effectiveMembership = getEffectiveMembership(r.getMyMembership());
                if (effectiveMembership !== EffectiveMembership.Join) {
                    const membershipEvent = r.currentState.getStateEvents("m.room.member", myUserId);
                    if (membershipEvent && !Array.isArray(membershipEvent)) {
                        return membershipEvent.getTs();
                    }
                }

                for (let i = r.timeline.length - 1; i >= 0; --i) {
                    const ev = r.timeline[i];
                    if (!ev.getTs()) continue; // skip events that don't have timestamps (tests only?)

                    // TODO: Don't assume we're using the same client as the peg
                    if (ev.getSender() === myUserId || Unread.eventTriggersUnreadCount(ev)) {
                        return ev.getTs();
                    }
                }

                // we might only have events that don't trigger the unread indicator,
                // in which case use the oldest event even if normally it wouldn't count.
                // This is better than just assuming the last event was forever ago.
                if (r.timeline.length && r.timeline[0].getTs()) {
                    return r.timeline[0].getTs();
                } else {
                    return Number.MAX_SAFE_INTEGER;
                }
            })();

            tsCache[r.roomId] = ts;
            return ts;
        };

        return rooms.sort((a, b) => {
            return getLastTs(b) - getLastTs(a);
        });
    }
}
