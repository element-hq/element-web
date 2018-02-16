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
        this._state = {
            lists: {
                "im.vector.fake.invite": [],
                "m.favourite": [],
                "im.vector.fake.recent": [],
                "im.vector.fake.direct": [],
                "m.lowpriority": [],
                "im.vector.fake.archived": [],
            },
            ready: false,
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
            case 'MatrixActions.accountData': {
                if (payload.event_type !== 'm.direct') break;
                this._generateRoomLists();
            }
            break;
            case 'MatrixActions.RoomMember.membership': {
                if (!this._matrixClient || payload.member.userId !== this._matrixClient.credentials.userId) break;
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
            const me = room.getMember(this._matrixClient.credentials.userId);
            if (!me) return;

            if (me.membership == "invite") {
                lists["im.vector.fake.invite"].push(room);
            } else if (me.membership == "join" || me.membership === "ban" ||
                     (me.membership === "leave" && me.events.member.getSender() !== me.events.member.getStateKey())) {
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
            } else if (me.membership === "leave") {
                lists["im.vector.fake.archived"].push(room);
            } else {
                console.error("unrecognised membership: " + me.membership + " - this should never happen");
            }
        });

        const listOrders = {
            "m.favourite": "manual",
            "im.vector.fake.invite": "recent",
            "im.vector.fake.recent": "recent",
            "im.vector.fake.direct": "recent",
            "m.lowpriority": "recent",
            "im.vector.fake.archived": "recent",
        };

        Object.keys(lists).forEach((listKey) => {
            let comparator;
            switch (listOrders[listKey]) {
                case "recent":
                    comparator = this._recentsComparator;
                    break;
                case "manual":
                default:
                    comparator = this._getManualComparator(listKey, optimisticRequest);
                    break;
            }
            lists[listKey].sort(comparator);
        });

        this._setState({
            lists,
            ready: true, // Ready to receive updates via Room.tags events
        });
    }

    _tsOfNewestEvent(room) {
        for (let i = room.timeline.length - 1; i >= 0; --i) {
            const ev = room.timeline[i];
            if (ev.getTs() &&
                (Unread.eventTriggersUnreadCount(ev) ||
                (ev.getSender() === this._matrixClient.credentials.userId))
            ) {
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

    _recentsComparator(roomA, roomB) {
        return this._tsOfNewestEvent(roomB) - this._tsOfNewestEvent(roomA);
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
            const a = metaA.order;
            const b = metaB.order;

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
