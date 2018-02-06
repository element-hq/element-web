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

/**
 * A class for storing application state for categorising rooms in
 * the RoomList.
 */
class RoomListStore extends Store {
    constructor() {
        super(dis);

        this._init();
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
                this._updateRoomLists(payload.room);
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
                this._updateRoomListsOptimistic(
                    payload.request.room,
                    payload.request.oldTag,
                    payload.request.newTag,
                    payload.request.metaData,
                );
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
            }
            break;
        }
    }

    _updateRoomListsOptimistic(updatedRoom, oldTag, newTag, metaData) {
        const newLists = {};

        // Adding a tag to an untagged room - need to remove it from recents
        if (newTag && Object.keys(updatedRoom.tags).length === 0) {
            oldTag = 'im.vector.fake.recent';
        }

        // Removing a tag from a room with one tag left - need to add it to recents
        if (oldTag && Object.keys(updatedRoom.tags).length === 1) {
            newTag = 'im.vector.fake.recent';
        }

        // Remove room from oldTag
        Object.keys(this._state.lists).forEach((tagName) => {
            if (tagName === oldTag) {
                newLists[tagName] = this._state.lists[tagName].filter((room) => {
                    return room.roomId !== updatedRoom.roomId;
                });
            } else {
                newLists[tagName] = this._state.lists[tagName];
            }
        });

        /// XXX: RoomSubList sorts by data on the room object. We
        /// should sort in advance and incrementally insert new rooms
        /// instead of resorting every time.
        if (metaData) {
            updatedRoom.tags[newTag] = metaData;
        }

        newLists[newTag].push(updatedRoom);

        this._setState({
            lists: newLists,
        });
    }

    _updateRoomLists(updatedRoom) {
        const roomTags = Object.keys(updatedRoom.tags);

        const newLists = {};

        // Removal of the updatedRoom from tags it no longer has
        Object.keys(this._state.lists).forEach((tagName) => {
            newLists[tagName] = this._state.lists[tagName].filter((room) => {
                return room.roomId !== updatedRoom.roomId || roomTags.includes(tagName);
            });
        });

        roomTags.forEach((tagName) => {
            if (newLists[tagName].includes(updatedRoom)) return;
            newLists[tagName].push(updatedRoom);
        });

        this._setState({
            lists: newLists,
        });
    }

    _generateRoomLists() {
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
                const tagNames = Object.keys(room.tags);
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

        this._setState({
            lists,
            ready: true, // Ready to receive updates via Room.tags events
        });
    }

    getRoomLists() {
        return this._state.lists;
    }
}

if (global.singletonRoomListStore === undefined) {
    global.singletonRoomListStore = new RoomListStore();
}
export default global.singletonRoomListStore;
