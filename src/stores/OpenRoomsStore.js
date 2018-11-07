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
import {Store} from 'flux/utils';
import MatrixClientPeg from '../MatrixClientPeg';

/**
 * A class for keeping track of the RoomViewStores of the rooms shown on the screen.
 * Routes the dispatcher actions to the store of currently active room.
 */
class OpenRoomsStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = {
            room: {
                store: null,
                dispatcher: null
            },
        };

        this._forwardingEvent = null;
    }

    getRoomStore() {
        return this._state.room.store;
    }

    getCurrentRoomStore() {
        return this.getRoomStore(); // just one room for now
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    _cleanupRoom() {
        const room = this._state.room;
        room.dispatcher.unregister(room.store.getDispatchToken());
        this._setState({
            room: {
                store: null,
                dispatcher: null
            },
        });
    }

    _createRoom() {
        const dispatcher = new MatrixDispatcher();
        this._setState({
            room: {
                store: new RoomViewStore(dispatcher),
                dispatcher,
            },
        });
    }

    _forwardAction(payload) {
        if (this._state.room.dispatcher) {
            this._state.room.dispatcher.dispatch(payload, true);
        }
    }

    async _resolveRoomAlias(payload) {
        try {
            const result = await MatrixClientPeg.get()
                .getRoomIdForAlias(payload.room_alias);
            dis.dispatch({
                action: 'view_room',
                room_id: result.room_id,
                event_id: payload.event_id,
                highlighted: payload.highlighted,
                room_alias: payload.room_alias,
                auto_join: payload.auto_join,
                oob_data: payload.oob_data,
            });
        } catch(err) {
            this._forwardAction({
                action: 'view_room_error',
                room_id: null,
                room_alias: payload.room_alias,
                err: err,
            });
        }
    }

    __onDispatch(payload) {
        switch (payload.action) {
            // view_room:
            //      - room_alias:   '#somealias:matrix.org'
            //      - room_id:      '!roomid123:matrix.org'
            //      - event_id:     '$213456782:matrix.org'
            //      - event_offset: 100
            //      - highlighted:  true
            case 'view_room':
                console.log("!!! OpenRoomsStore: view_room", payload);
                if (!payload.room_id && payload.room_alias) {
                    this._resolveRoomAlias(payload);
                }
                const currentStore = this.getCurrentRoomStore();
                if (currentStore &&
                    (!payload.room_alias || payload.room_alias !== currentStore.getRoomAlias()) &&
                    (!currentStore.getRoomId() || payload.room_id !== currentStore.getRoomId())
                ) {
                    console.log("OpenRoomsStore: _cleanupRoom");
                    this._cleanupRoom();
                }
                if (!this._state.room.store) {
                    console.log("OpenRoomsStore: _createRoom");
                    this._createRoom();
                }
                console.log("OpenRoomsStore: _forwardAction");
                this._forwardAction(payload);
                if (this._forwardingEvent) {
                    dis.dispatch({
                        action: 'send_event',
                        room_id: payload.room_id,
                        event: this._forwardingEvent,
                    });
                    this._forwardingEvent = null;
                }
                break;
            case 'view_my_groups':
            case 'view_group':
                this._forwardAction(payload);
                this._cleanupRoom();
                break;
            case 'will_join':
            case 'cancel_join':
            case 'join_room':
            case 'join_room_error':
            case 'on_logged_out':
            case 'reply_to_event':
            case 'open_room_settings':
            case 'close_settings':
                this._forwardAction(payload);
                break;
            case 'forward_event':
                this._forwardingEvent = payload.event;
                break;
        }
    }
}

let singletonOpenRoomsStore = null;
if (!singletonOpenRoomsStore) {
    singletonOpenRoomsStore = new OpenRoomsStore();
}
module.exports = singletonOpenRoomsStore;
