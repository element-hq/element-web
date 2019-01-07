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
import MatrixDispatcher from '../matrix-dispatcher';
import dis from '../dispatcher';
import {RoomViewStore} from './RoomViewStore';
import GroupStore from './GroupStore';
import {Store} from 'flux/utils';
import MatrixClientPeg from '../MatrixClientPeg';


function matchesRoom(payload, roomStore) {
    if (!roomStore) {
        return false;
    }
    if (payload.room_alias) {
        return payload.room_alias === roomStore.getRoomAlias();
    }
    return payload.room_id === roomStore.getRoomId();
}

/**
 * A class for keeping track of the RoomViewStores of the rooms shown on the screen.
 * Routes the dispatcher actions to the store of currently active room.
 */
class OpenRoomsStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = {
            rooms: [],
            currentIndex: null,
            group_id: null,
        };

        this._forwardingEvent = null;
    }

    getRoomStores() {
        return this._state.rooms.map((r) => r.store);
    }

    getActiveRoomStore() {
        const openRoom = this._getActiveOpenRoom();
        if (openRoom) {
            return openRoom.store;
        }
    }

    getRoomStoreAt(index) {
        if (index >= 0 && index < this._state.rooms.length) {
            return this._state.rooms[index].store;
        }
    }

    _getActiveOpenRoom() {
        const index = this._state.currentIndex;
        if (index !== null && index < this._state.rooms.length) {
            return this._state.rooms[index];
        }
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    _hasRoom(payload) {
        return this._roomIndex(payload) !== -1;
    }

    _roomIndex(payload) {
        return this._state.rooms.findIndex((r) => matchesRoom(payload, r.store));
    }

    _cleanupOpenRooms() {
        this._state.rooms.forEach((room) => {
            room.dispatcher.unregister(room.dispatcherRef);
            room.dispatcher.unregister(room.store.getDispatchToken());
        });
        this._setState({
            rooms: [],
            group_id: null,
            currentIndex: null,
        });
    }

    _createOpenRoom(roomId, roomAlias) {
        const dispatcher = new MatrixDispatcher();
        // forward all actions coming from the room dispatcher
        // to the global one
        const dispatcherRef = dispatcher.register((payload) => {
            // block a view_room action for the same room because it will switch to
            // single room mode in MatrixChat
            if (payload.action === 'view_room' && roomId === payload.room_id) {
                return;
            }
            payload.grid_src_room_id = roomId;
            payload.grid_src_room_alias = roomAlias;
            this.getDispatcher().dispatch(payload);
        });
        const openRoom = {
            store: new RoomViewStore(dispatcher),
            dispatcher,
            dispatcherRef,
        };

        dispatcher.dispatch({
            action: 'view_room',
            room_id: roomId,
            room_alias: roomAlias,
        }, true);

        return openRoom;
    }

    _setSingleOpenRoom(payload) {
        this._setState({
            rooms: [this._createOpenRoom(payload.room_id, payload.room_alias)],
            currentIndex: 0,
        });
    }

    _setGroupOpenRooms(groupId) {
        this._cleanupOpenRooms();
        // TODO: register to GroupStore updates
        const rooms = GroupStore.getGroupRooms(groupId);
        const openRooms = rooms.map((room) => {
            return this._createOpenRoom(room.roomId);
        });
        this._setState({
            rooms: openRooms,
            group_id: groupId,
            currentIndex: 0,
        });
    }

    _forwardAction(payload) {
        // don't forward an event to a room dispatcher
        // if the event originated from that dispatcher, as this
        // would cause the event to be observed twice in that
        // dispatcher
        if (payload.grid_src_room_id || payload.grid_src_room_alias) {
            const srcPayload = {
                room_id: payload.grid_src_room_id,
                room_alias: payload.grid_src_room_alias,
            };
            const srcIndex = this._roomIndex(srcPayload);
            if (srcIndex === this._state.currentIndex) {
                return;
            }
        }
        const currentRoom = this._getActiveOpenRoom();
        if (currentRoom) {
            currentRoom.dispatcher.dispatch(payload, true);
        }
    }

    async _resolveRoomAlias(payload) {
        try {
            const result = await MatrixClientPeg.get()
                .getRoomIdForAlias(payload.room_alias);
            this.getDispatcher().dispatch({
                action: 'view_room',
                room_id: result.room_id,
                event_id: payload.event_id,
                highlighted: payload.highlighted,
                room_alias: payload.room_alias,
                auto_join: payload.auto_join,
                oob_data: payload.oob_data,
            });
        } catch (err) {
            this._forwardAction({
                action: 'view_room_error',
                room_id: null,
                room_alias: payload.room_alias,
                err: err,
            });
        }
    }

    _viewRoom(payload) {
        console.log("!!! OpenRoomsStore: view_room", payload);
        if (!payload.room_id && payload.room_alias) {
            this._resolveRoomAlias(payload);
        }
        const currentStore = this.getActiveRoomStore();
        if (!matchesRoom(payload, currentStore)) {
            if (this._hasRoom(payload)) {
                const roomIndex = this._roomIndex(payload);
                this._setState({currentIndex: roomIndex});
            } else {
                this._cleanupOpenRooms();
            }
        }
        if (!this.getActiveRoomStore()) {
            console.log("OpenRoomsStore: _setSingleOpenRoom");
            this._setSingleOpenRoom(payload);
        }
        console.log("OpenRoomsStore: _forwardAction");
        this._forwardAction(payload);
        if (this._forwardingEvent) {
            this.getDispatcher().dispatch({
                action: 'send_event',
                room_id: payload.room_id,
                event: this._forwardingEvent,
            });
            this._forwardingEvent = null;
        }
    }

    __onDispatch(payload) {
        let proposedIndex;
        switch (payload.action) {
            // view_room:
            //      - room_alias:   '#somealias:matrix.org'
            //      - room_id:      '!roomid123:matrix.org'
            //      - event_id:     '$213456782:matrix.org'
            //      - event_offset: 100
            //      - highlighted:  true
            case 'view_room':
                this._viewRoom(payload);
                break;
            case 'view_my_groups':
            case 'view_group':
                this._forwardAction(payload);
                this._cleanupOpenRooms();
                break;
            case 'will_join':
            case 'cancel_join':
            case 'join_room':
            case 'join_room_error':
            case 'on_logged_out':
            case 'reply_to_event':
            case 'open_room_settings':
            case 'close_settings':
            case 'focus_composer':
                this._forwardAction(payload);
                break;
            case 'forward_event':
                this._forwardingEvent = payload.event;
                break;
            case 'group_grid_set_active':
                proposedIndex = this._roomIndex(payload);
                if (proposedIndex !== -1) {
                    this._setState({
                        currentIndex: proposedIndex,
                    });
                }
                break;
            case 'group_grid_view':
                if (payload.group_id !== this._state.group_id) {
                    this._setGroupOpenRooms(payload.group_id);
                }
                break;
        }
    }
}

let singletonOpenRoomsStore = null;
if (!singletonOpenRoomsStore) {
    singletonOpenRoomsStore = new OpenRoomsStore();
}
module.exports = singletonOpenRoomsStore;
