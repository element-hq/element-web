/*
Copyright 2018 New Vector Ltd

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
import {Store} from 'flux/utils';
import dis from '../dispatcher';
import DMRoomMap from '../utils/DMRoomMap';
import Unread from '../Unread';
import SettingsStore from "../settings/SettingsStore";

/**
 * A class for storing application state for categorising rooms in
 * the RoomList.
 */
class RoomListStore extends Store {
    static _listOrders = {
        "m.favourite": "manual",
        "im.vector.fake.invite": "recent",
        "im.vector.fake.recent": "recent",
        "im.vector.fake.direct": "recent",
        "m.lowpriority": "recent",
        "im.vector.fake.archived": "recent",
    };

    constructor() {
        super(dis);

        this._init();
        this._getManualComparator = this._getManualComparator.bind(this);
        this._recentsComparator = this._recentsComparator.bind(this);
    }

    _init() {
        // Initialise state
        this._state = {
            lists: {
                "m.server_notice": [],
                "im.vector.fake.invite": [],
                "m.favourite": [],
                "im.vector.fake.recent": [],
                "im.vector.fake.direct": [],
                "m.lowpriority": [],
                "im.vector.fake.archived": [],
            },
            ready: false,
            roomCache: {}, // roomId => { cacheType => value }
        };
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    __onDispatch(payload) {
        switch (payload.action) {
            // Initialise state after initial sync
            case 'MatrixActions.sync': {
                if (!(payload.prevState !== 'PREPARED' && payload.state === 'PREPARED')) {
                    break;
                }

                this._matrixClient = payload.matrixClient;
                this._generateRoomLists();
            }
            break;
            case 'MatrixActions.Room.tags': {
                if (!this._state.ready) break;
                this._generateRoomLists();
            }
            break;
            case 'MatrixActions.Room.timeline': {
                if (!this._state.ready ||
                    !payload.isLiveEvent ||
                    !payload.isLiveUnfilteredRoomTimelineEvent ||
                    !this._eventTriggersRecentReorder(payload.event)
                ) break;

                this._clearCachedRoomState(payload.event.getRoomId());
                this._generateRoomLists();
            }
            break;
            // When an event is decrypted, it could mean we need to reorder the room
            // list because we now know the type of the event.
            case 'MatrixActions.Event.decrypted': {
                // We may not have synced or done an initial generation of the lists
                if (!this._matrixClient || !this._state.ready) break;

                const roomId = payload.event.getRoomId();

                // We may have decrypted an event without a roomId (e.g to_device)
                if (!roomId) break;

                const room = this._matrixClient.getRoom(roomId);

                // We somehow decrypted an event for a room our client is unaware of
                if (!room) break;

                const liveTimeline = room.getLiveTimeline();
                const eventTimeline = room.getTimelineForEvent(payload.event.getId());

                // Either this event was not added to the live timeline (e.g. pagination)
                // or it doesn't affect the ordering of the room list.
                if (liveTimeline !== eventTimeline ||
                    !this._eventTriggersRecentReorder(payload.event)
                ) break;

                this._clearCachedRoomState(payload.event.getRoomId());
                this._generateRoomLists();
            }
            break;
            case 'MatrixActions.accountData': {
                if (payload.event_type !== 'm.direct') break;
                this._generateRoomLists();
            }
            break;
            case 'MatrixActions.Room.myMembership': {
                this._generateRoomLists();
            }
            break;
            // This could be a new room that we've been invited to, joined or created
            // we won't get a RoomMember.membership for these cases if we're not already
            // a member.
            case 'MatrixActions.Room': {
                if (!this._state.ready || !this._matrixClient.credentials.userId) break;
                this._generateRoomLists();
            }
            break;
            case 'RoomListActions.tagRoom.pending': {
                // XXX: we only show one optimistic update at any one time.
                // Ideally we should be making a list of in-flight requests
                // that are backed by transaction IDs. Until the js-sdk
                // supports this, we're stuck with only being able to use
                // the most recent optimistic update.
                this._generateRoomLists(payload.request);
            }
            break;
            case 'RoomListActions.tagRoom.failure': {
                // Reset state according to js-sdk
                this._generateRoomLists();
            }
            break;
            case 'on_logged_out': {
                // Reset state without pushing an update to the view, which generally assumes that
                // the matrix client isn't `null` and so causing a re-render will cause NPEs.
                this._init();
                this._matrixClient = null;
            }
            break;
        }
    }

    _generateRoomLists(optimisticRequest) {
        const lists = {
            "m.server_notice": [],
            "im.vector.fake.invite": [],
            "m.favourite": [],
            "im.vector.fake.recent": [],
            "im.vector.fake.direct": [],
            "m.lowpriority": [],
            "im.vector.fake.archived": [],
        };


        const dmRoomMap = DMRoomMap.shared();

        // If somehow we dispatched a RoomListActions.tagRoom.failure before a MatrixActions.sync
        if (!this._matrixClient) return;

        this._matrixClient.getRooms().forEach((room, index) => {
            const myUserId = this._matrixClient.getUserId();
            const membership = room.getMyMembership();
            const me = room.getMember(myUserId);

            if (membership == "invite") {
                lists["im.vector.fake.invite"].push(room);
            } else if (membership == "join" || membership === "ban" || (me && me.isKicked())) {
                // Used to split rooms via tags
                let tagNames = Object.keys(room.tags);

                if (optimisticRequest && optimisticRequest.room === room) {
                    // Remove old tag
                    tagNames = tagNames.filter((tagName) => tagName !== optimisticRequest.oldTag);
                    // Add new tag
                    if (optimisticRequest.newTag &&
                        !tagNames.includes(optimisticRequest.newTag)
                    ) {
                        tagNames.push(optimisticRequest.newTag);
                    }
                }

                // ignore any m. tag names we don't know about
                tagNames = tagNames.filter((t) => {
                    return !t.startsWith('m.') || lists[t] !== undefined;
                });

                if (tagNames.length) {
                    for (let i = 0; i < tagNames.length; i++) {
                        const tagName = tagNames[i];
                        lists[tagName] = lists[tagName] || [];
                        lists[tagName].push(room);
                    }
                } else if (dmRoomMap.getUserIdForRoomId(room.roomId)) {
                    // "Direct Message" rooms (that we're still in and that aren't otherwise tagged)
                    lists["im.vector.fake.direct"].push(room);
                } else {
                    lists["im.vector.fake.recent"].push(room);
                }
            } else if (membership === "leave") {
                lists["im.vector.fake.archived"].push(room);
            }
        });

        // Note: we check the settings up here instead of in the forEach or
        // in the _recentsComparator to avoid hitting the SettingsStore a few
        // thousand times.
        const pinUnread = SettingsStore.getValue("pinUnreadRooms");
        const pinMentioned = SettingsStore.getValue("pinMentionedRooms");
        this._timings = {};
        Object.keys(lists).forEach((listKey) => {
            let comparator;
            switch (RoomListStore._listOrders[listKey]) {
                case "recent":
                    comparator = (roomA, roomB) => {
                        this._timings["overall_" + roomA.roomId + "_" + roomB.roomId] = {
                            type: "overall",
                            start: performance.now(),
                            end: 0,
                        };
                        const ret = this._recentsComparator(roomA, roomB, pinUnread, pinMentioned);
                        this._timings["overall_" + roomA.roomId + "_" + roomB.roomId].end = performance.now();
                        return ret;
                    };
                    break;
                case "manual":
                default:
                    comparator = this._getManualComparator(listKey, optimisticRequest);
                    break;
            }
            lists[listKey].sort(comparator);
        });

        // Combine the samples for performance metrics
        const samplesByType = {};
        for (const sampleName of Object.keys(this._timings)) {
            const sample = this._timings[sampleName];
            if (!samplesByType[sample.type]) samplesByType[sample.type] = {
                min: 999999999,
                max: 0,
                count: 0,
                total: 0,
            };

            const record = samplesByType[sample.type];
            const duration = sample.end - sample.start;
            if (duration < record.min) record.min = duration;
            if (duration > record.max) record.max = duration;
            record.count++;
            record.total += duration;
        }

        for (const category of Object.keys(samplesByType)) {
            const {min, max, count, total} = samplesByType[category];
            const average = total / count;

            console.log(`RoomListSortPerf : type=${category} min=${min} max=${max} total=${total} samples=${count} average=${average}`);
        }

        this._setState({
            lists,
            ready: true, // Ready to receive updates via Room.tags events
        });
    }

    _updateCachedRoomState(roomId, type, value) {
        const roomCache = this._state.roomCache;
        if (!roomCache[roomId]) roomCache[roomId] = {};

        if (value) roomCache[roomId][type] = value;
        else delete roomCache[roomId][type];

        this._setState({roomCache});
    }

    _clearCachedRoomState(roomId) {
        const roomCache = this._state.roomCache;
        delete roomCache[roomId];
        this._setState({roomCache});
    }

    _getRoomState(room, type) {
        const roomId = room.roomId;
        const roomCache = this._state.roomCache;
        if (roomCache[roomId] && typeof roomCache[roomId][type] !== 'undefined') {
            return roomCache[roomId][type];
        }

        if (type === "timestamp") {
            const ts = this._tsOfNewestEvent(room);
            this._updateCachedRoomState(roomId, "timestamp", ts);
            return ts;
        } else if (type === "unread") {
            const unread = room.getUnreadNotificationCount() > 0;
            this._updateCachedRoomState(roomId, "unread", unread);
            return unread;
        } else if (type === "notifications") {
            const notifs = room.getUnreadNotificationCount("highlight") > 0;
            this._updateCachedRoomState(roomId, "notifications", notifs);
            return notifs;
        } else throw new Error("Unrecognized room cache type: " + type);
    }

    _eventTriggersRecentReorder(ev) {
        return ev.getTs() && (
            Unread.eventTriggersUnreadCount(ev) ||
            ev.getSender() === this._matrixClient.credentials.userId
        );
    }

    _tsOfNewestEvent(room) {
        for (let i = room.timeline.length - 1; i >= 0; --i) {
            const ev = room.timeline[i];
            if (this._eventTriggersRecentReorder(ev)) {
                return ev.getTs();
            }
        }

        // we might only have events that don't trigger the unread indicator,
        // in which case use the oldest event even if normally it wouldn't count.
        // This is better than just assuming the last event was forever ago.
        if (room.timeline.length && room.timeline[0].getTs()) {
            return room.timeline[0].getTs();
        } else {
            return Number.MAX_SAFE_INTEGER;
        }
    }

    _recentsComparator(roomA, roomB, pinUnread, pinMentioned) {
        //console.log("Comparing " + roomA.roomId + " with " + roomB.roomId +" || pinUnread=" + pinUnread +" pinMentioned="+pinMentioned);
        // We try and set the ordering to be Mentioned > Unread > Recent
        // assuming the user has the right settings, of course.

        this._timings["timestamp_" + roomA.roomId + "_" + roomB.roomId] = {
            type: "timestamp",
            start: performance.now(),
            end: 0,
        };
        const timestampA = this._getRoomState(roomA, "timestamp");
        const timestampB = this._getRoomState(roomB, "timestamp");
        const timestampDiff = timestampB - timestampA;
        this._timings["timestamp_" + roomA.roomId + "_" + roomB.roomId].end = performance.now();

        if (pinMentioned) {
            this._timings["mentioned_" + roomA.roomId + "_" + roomB.roomId] = {
                type: "mentioned",
                start: performance.now(),
                end: 0,
            };
            const mentionsA = this._getRoomState(roomA, "notifications");
            const mentionsB = this._getRoomState(roomB, "notifications");
            this._timings["mentioned_" + roomA.roomId + "_" + roomB.roomId].end = performance.now();
            if (mentionsA && !mentionsB) return -1;
            if (!mentionsA && mentionsB) return 1;

            // If they both have notifications, sort by timestamp.
            // If neither have notifications (the fourth check not shown
            // here), then try and sort by unread messages and finally by
            // timestamp.
            if (mentionsA && mentionsB) return timestampDiff;
        }

        if (pinUnread) {
            this._timings["unread_" + roomA.roomId + "_" + roomB.roomId] = {
                type: "unread",
                start: performance.now(),
                end: 0,
            };
            const unreadA = this._getRoomState(roomA, "unread");
            const unreadB = this._getRoomState(roomB, "notifications");
            this._timings["unread_" + roomA.roomId + "_" + roomB.roomId].end = performance.now();
            if (unreadA && !unreadB) return -1;
            if (!unreadA && unreadB) return 1;

            // If they both have unread messages, sort by timestamp
            // If nether have unread message (the fourth check not shown
            // here), then just sort by timestamp anyways.
            if (unreadA && unreadB) return timestampDiff;
        }

        return timestampDiff;
    }

    _lexicographicalComparator(roomA, roomB) {
        return roomA.name > roomB.name ? 1 : -1;
    }

    _getManualComparator(tagName, optimisticRequest) {
        return (roomA, roomB) => {
            let metaA = roomA.tags[tagName];
            let metaB = roomB.tags[tagName];

            if (optimisticRequest && roomA === optimisticRequest.room) metaA = optimisticRequest.metaData;
            if (optimisticRequest && roomB === optimisticRequest.room) metaB = optimisticRequest.metaData;

            // Make sure the room tag has an order element, if not set it to be the bottom
            const a = metaA ? metaA.order : undefined;
            const b = metaB ? metaB.order : undefined;

            // Order undefined room tag orders to the bottom
            if (a === undefined && b !== undefined) {
                return 1;
            } else if (a !== undefined && b === undefined) {
                return -1;
            }

            return a == b ? this._lexicographicalComparator(roomA, roomB) : ( a > b ? 1 : -1);
        };
    }

    getRoomLists() {
        return this._state.lists;
    }
}

if (global.singletonRoomListStore === undefined) {
    global.singletonRoomListStore = new RoomListStore();
}
export default global.singletonRoomListStore;
