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

const CATEGORY_RED = "red";
const CATEGORY_GREY = "grey";
const CATEGORY_BOLD = "bold";
const CATEGORY_IDLE = "idle";

const CATEGORY_ORDER = [CATEGORY_RED, CATEGORY_GREY, CATEGORY_BOLD, CATEGORY_IDLE];
const LIST_ORDERS = {
    "m.favourite": "manual",
    "im.vector.fake.invite": "recent",
    "im.vector.fake.recent": "recent",
    "im.vector.fake.direct": "recent",
    "m.lowpriority": "recent",
    "im.vector.fake.archived": "recent",
};

/**
 * A class for storing application state for categorising rooms in
 * the RoomList.
 */
class RoomListStore extends Store {
    constructor() {
        super(dis);

        this._init();
        this._getManualComparator = this._getManualComparator.bind(this);
        this._recentsComparator = this._recentsComparator.bind(this);
    }

    _init() {
        // Initialise state
        const defaultLists = {
            "m.server_notice": [/* { room: js-sdk room, category: string } */],
            "im.vector.fake.invite": [],
            "m.favourite": [],
            "im.vector.fake.recent": [],
            "im.vector.fake.direct": [],
            "m.lowpriority": [],
            "im.vector.fake.archived": [],
        };
        this._state = {
            // The rooms in these arrays are ordered according to either the
            // 'recents' behaviour or 'manual' behaviour.
            lists: defaultLists,
            presentationLists: defaultLists, // like `lists`, but with arrays of rooms instead
            ready: false,
            stickyRoomId: null,
        };
    }

    _setState(newState) {
        if (newState['lists']) {
            const presentationLists = {};
            for (const key of Object.keys(newState['lists'])) {
                presentationLists[key] = newState['lists'][key].map((e) => e.room);
            }
            newState['presentationLists'] = presentationLists;
        }
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    __onDispatch = (payload) => {
        const logicallyReady = this._matrixClient && this._state.ready;
        switch (payload.action) {
            // Initialise state after initial sync
            case 'MatrixActions.sync': {
                if (!(payload.prevState !== 'PREPARED' && payload.state === 'PREPARED')) {
                    break;
                }

                this._matrixClient = payload.matrixClient;
                this._generateInitialRoomLists();
            }
            break;
            case 'MatrixActions.Room.receipt': {
                if (!logicallyReady) break;

                // First see if the receipt event is for our own user. If it was, trigger
                // a room update (we probably read the room on a different device).
                const myUserId = this._matrixClient.getUserId();
                for (const eventId of Object.keys(payload.event.getContent())) {
                    const receiptUsers = Object.keys(payload.event.getContent()[eventId]['m.read'] || {});
                    if (receiptUsers.includes(myUserId)) {
                        this._roomUpdateTriggered(payload.room.roomId);
                        return;
                    }
                }
            }
            break;
            case 'MatrixActions.Room.tags': {
                if (!logicallyReady) break;
                // TODO: Figure out which rooms changed in the tag and only change those.
                // This is very blunt and wipes out the sticky room stuff
                this._generateInitialRoomLists();
            }
            break;
            case 'MatrixActions.Room.timeline': {
                if (!logicallyReady ||
                    !payload.isLiveEvent ||
                    !payload.isLiveUnfilteredRoomTimelineEvent ||
                    !this._eventTriggersRecentReorder(payload.event)
                ) {
                    break;
                }

                this._roomUpdateTriggered(payload.event.getRoomId());
            }
            break;
            // When an event is decrypted, it could mean we need to reorder the room
            // list because we now know the type of the event.
            case 'MatrixActions.Event.decrypted': {
                if (!logicallyReady) break;

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
                if (liveTimeline !== eventTimeline || !this._eventTriggersRecentReorder(payload.event)) {
                    break;
                }

                this._roomUpdateTriggered(roomId);
            }
            break;
            case 'MatrixActions.accountData': {
                if (!logicallyReady) break;
                if (payload.event_type !== 'm.direct') break;
                // TODO: Figure out which rooms changed in the direct chat and only change those.
                // This is very blunt and wipes out the sticky room stuff
                this._generateInitialRoomLists();
            }
            break;
            case 'MatrixActions.Room.myMembership': {
                if (!logicallyReady) break;
                this._roomUpdateTriggered(payload.room.roomId);
            }
            break;
            // This could be a new room that we've been invited to, joined or created
            // we won't get a RoomMember.membership for these cases if we're not already
            // a member.
            case 'MatrixActions.Room': {
                if (!logicallyReady) break;
                this._roomUpdateTriggered(payload.room.roomId);
            }
            break;
            // TODO: Re-enable optimistic updates when we support dragging again
            // case 'RoomListActions.tagRoom.pending': {
            //     if (!logicallyReady) break;
            //     // XXX: we only show one optimistic update at any one time.
            //     // Ideally we should be making a list of in-flight requests
            //     // that are backed by transaction IDs. Until the js-sdk
            //     // supports this, we're stuck with only being able to use
            //     // the most recent optimistic update.
            //     console.log("!! Optimistic tag: ", payload);
            // }
            // break;
            // case 'RoomListActions.tagRoom.failure': {
            //     if (!logicallyReady) break;
            //     // Reset state according to js-sdk
            //     console.log("!! Optimistic tag failure: ", payload);
            // }
            // break;
            case 'on_logged_out': {
                // Reset state without pushing an update to the view, which generally assumes that
                // the matrix client isn't `null` and so causing a re-render will cause NPEs.
                this._init();
                this._matrixClient = null;
            }
            break;
            case 'view_room': {
                if (!logicallyReady) break;

                // Note: it is important that we set a new stickyRoomId before setting the old room
                // to IDLE. If we don't, the wrong room gets counted as sticky.
                const currentSticky = this._state.stickyRoomId;
                this._setState({stickyRoomId: payload.room_id});
                if (currentSticky) {
                    this._setRoomCategory(this._matrixClient.getRoom(currentSticky), CATEGORY_IDLE);
                }
            }
            break;
        }
    };

    _roomUpdateTriggered(roomId) {
        const room = this._matrixClient.getRoom(roomId);
        if (!room) return;

        if (this._state.stickyRoomId !== room.roomId) {
            const category = this._calculateCategory(room);
            this._setRoomCategory(room, category);
        }
    }

    _setRoomCategory(room, category) {
        const listsClone = {};
        const targetCatIndex = CATEGORY_ORDER.indexOf(category);
        const targetTs = this._tsOfNewestEvent(room);

        const myMembership = room.getMyMembership();
        let doInsert = true;
        let targetTags = [];
        if (myMembership !== "join" && myMembership !== "invite") {
            doInsert = false;
        } else {
            const dmRoomMap = DMRoomMap.shared();
            if (dmRoomMap.getUserIdForRoomId(room.roomId)) {
                targetTags.push('im.vector.fake.direct');
            } else {
                targetTags.push('im.vector.fake.recent');
            }
        }

        // We need to update all instances of a room to ensure that they are correctly organized
        // in the list. We do this by shallow-cloning the entire `lists` object using a single
        // iterator. Within the loop, we also rebuild the list of rooms per tag (key) so that the
        // updated room gets slotted into the right spot.

        let inserted = false;
        for (const key of Object.keys(this._state.lists)) {
            listsClone[key] = [];
            let pushedEntry = false;
            const hasRoom = !!this._state.lists[key].find((e) => e.room.roomId === room.roomId);
            let lastCategoryBoundary = 0;
            let lastCategoryIndex = 0;
            for (const entry of this._state.lists[key]) {
                // if the list is a recent list, and the room appears in this list, and we're not looking at a sticky
                // room (sticky rooms have unreliable categories), try to slot the new room in
                if (LIST_ORDERS[key] === 'recent' && hasRoom && entry.room.roomId !== this._state.stickyRoomId) {
                    const inTag = targetTags.length === 0 || targetTags.includes(key);
                    if (!pushedEntry && doInsert && inTag) {
                        const entryTs = this._tsOfNewestEvent(entry.room);
                        const entryCategory = CATEGORY_ORDER.indexOf(entry.category);

                        // If we've hit the top of a boundary (either because there's no rooms in the target or
                        // we've reached the grouping of rooms), insert our room ahead of the others in the category.
                        // This ensures that our room is on top (more recent) than the others.
                        const changedBoundary = entryCategory > targetCatIndex;
                        const currentCategory = entryCategory === targetCatIndex;
                        if (changedBoundary || (currentCategory && targetTs >= entryTs)) {
                            if (changedBoundary) {
                                // If we changed a boundary, then we've gone too far - go to the top of the last
                                // section instead.
                                listsClone[key].splice(lastCategoryBoundary, 0, {room, category});
                            } else {
                                // If we're ordering by timestamp, just insert normally
                                listsClone[key].push({room, category});
                            }
                            pushedEntry = true;
                            inserted = true;
                        }

                        if (entryCategory !== lastCategoryIndex) {
                            lastCategoryBoundary = listsClone[key].length - 1;
                        }
                        lastCategoryIndex = entryCategory;
                    }

                    // We insert our own record as needed, so don't let the old one through.
                    if (entry.room.roomId === room.roomId) {
                        continue;
                    }
                }

                // Fall through and clone the list.
                listsClone[key].push(entry);
            }
        }

        if (!inserted) {
            // There's a good chance that we just joined the room, so we need to organize it
            // We also could have left it...
            let tags = [];
            if (doInsert) {
                tags = Object.keys(room.tags);
                if (tags.length === 0) {
                    tags = targetTags;
                }
                if (tags.length === 0) {
                    tags.push(myMembership === 'join' ? 'im.vector.fake.recent' : 'im.vector.fake.invite');
                }
            } else {
                tags = ['im.vector.fake.archived'];
            }
            for (const tag of tags) {
                for (let i = 0; i < listsClone[tag].length; i++) {
                    const catIdxAtPosition = CATEGORY_ORDER.indexOf(listsClone[tag][i].category);
                    if (catIdxAtPosition >= targetCatIndex) {
                        listsClone[tag].splice(i, 0, {room: room, category: category});
                        break;
                    }
                }
            }
        }

        this._setState({lists: listsClone});
    }

    _generateInitialRoomLists() {
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
        const isCustomTagsEnabled = SettingsStore.isFeatureEnabled("feature_custom_tags");

        this._matrixClient.getRooms().forEach((room) => {
            const myUserId = this._matrixClient.getUserId();
            const membership = room.getMyMembership();
            const me = room.getMember(myUserId);

            if (membership === "invite") {
                lists["im.vector.fake.invite"].push({room, category: CATEGORY_RED});
            } else if (membership === "join" || membership === "ban" || (me && me.isKicked())) {
                // Used to split rooms via tags
                let tagNames = Object.keys(room.tags);

                // ignore any m. tag names we don't know about
                tagNames = tagNames.filter((t) => {
                    return (isCustomTagsEnabled && !t.startsWith('m.')) || lists[t] !== undefined;
                });

                if (tagNames.length) {
                    for (let i = 0; i < tagNames.length; i++) {
                        const tagName = tagNames[i];
                        lists[tagName] = lists[tagName] || [];

                        // We categorize all the tagged rooms the same because we don't actually
                        // care about the order (it's defined elsewhere)
                        lists[tagName].push({room, category: CATEGORY_RED});
                    }
                } else if (dmRoomMap.getUserIdForRoomId(room.roomId)) {
                    // "Direct Message" rooms (that we're still in and that aren't otherwise tagged)
                    lists["im.vector.fake.direct"].push({room, category: this._calculateCategory(room)});
                } else {
                    lists["im.vector.fake.recent"].push({room, category: this._calculateCategory(room)});
                }
            } else if (membership === "leave") {
                lists["im.vector.fake.archived"].push({room, category: this._calculateCategory(room)});
            }
        });

        // We use this cache in the recents comparator because _tsOfNewestEvent can take a while
        const latestEventTsCache = {}; // roomId => timestamp

        Object.keys(lists).forEach((listKey) => {
            let comparator;
            switch (LIST_ORDERS[listKey]) {
                case "recent":
                    comparator = (entryA, entryB) => {
                        this._recentsComparator(entryA, entryB, (room) => {
                            if (latestEventTsCache[room.roomId]) {
                                return latestEventTsCache[room.roomId];
                            }
                            const ts = this._tsOfNewestEvent(room);
                            latestEventTsCache[room.roomId] = ts;
                            return ts;
                        });
                    };
                    break;
                case "manual":
                default:
                    comparator = this._getManualComparator(listKey);
                    break;
            }
            lists[listKey].sort(comparator);
        });

        this._setState({
            lists,
            ready: true, // Ready to receive updates to ordering
        });
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

    _calculateCategory(room) {
        const mentions = room.getUnreadNotificationCount("highlight") > 0;
        if (mentions) return CATEGORY_RED;

        let unread = room.getUnreadNotificationCount() > 0;
        if (unread) return CATEGORY_GREY;

        unread = Unread.doesRoomHaveUnreadMessages(room);
        if (unread) return CATEGORY_BOLD;

        return CATEGORY_IDLE;
    }

    _recentsComparator(entryA, entryB, tsOfNewestEventFn) {
        const roomA = entryA.room;
        const roomB = entryB.room;
        const categoryA = entryA.category;
        const categoryB = entryB.category;

        if (categoryA !== categoryB) {
            const idxA = CATEGORY_ORDER.indexOf(categoryA);
            const idxB = CATEGORY_ORDER.indexOf(categoryB);
            if (idxA > idxB) return 1;
            if (idxA < idxB) return -1;
            return 0;
        }

        const timestampA = tsOfNewestEventFn(roomA);
        const timestampB = tsOfNewestEventFn(roomB);
        return timestampB - timestampA;
    }

    _lexicographicalComparator(roomA, roomB) {
        return roomA.name > roomB.name ? 1 : -1;
    }

    _getManualComparator(tagName, optimisticRequest) {
        return (entryA, entryB) => {
            const roomA = entryA.room;
            const roomB = entryB.room;

            let metaA = roomA.tags[tagName];
            let metaB = roomB.tags[tagName];

            if (optimisticRequest && roomA === optimisticRequest.room) metaA = optimisticRequest.metaData;
            if (optimisticRequest && roomB === optimisticRequest.room) metaB = optimisticRequest.metaData;

            // Make sure the room tag has an order element, if not set it to be the bottom
            const a = metaA ? Number(metaA.order) : undefined;
            const b = metaB ? Number(metaB.order) : undefined;

            // Order undefined room tag orders to the bottom
            if (a === undefined && b !== undefined) {
                return 1;
            } else if (a !== undefined && b === undefined) {
                return -1;
            }

            return a === b ? this._lexicographicalComparator(roomA, roomB) : ( a > b ? 1 : -1);
        };
    }

    getRoomLists() {
        return this._state.presentationLists;
    }
}

if (global.singletonRoomListStore === undefined) {
    global.singletonRoomListStore = new RoomListStore();
}
export default global.singletonRoomListStore;
