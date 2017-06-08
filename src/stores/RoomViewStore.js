/*
Copyright 2017 Vector Creations Ltd

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
import dis from '../dispatcher';
import {Store} from 'flux/utils';
import MatrixClientPeg from '../MatrixClientPeg';
import sdk from '../index';
import Modal from '../Modal';
import { _t } from '../languageHandler';

const INITIAL_STATE = {
    // Whether we're joining the currently viewed room
    joining: false,
    // Any error that has occurred during joining
    joinError: null,
    // The room ID of the room currently being viewed
    roomId: null,

    // The event to scroll to initially
    initialEventId: null,
    // The offset to display the initial event at (see scrollStateMap)
    initialEventPixelOffset: null,
    // Whether to highlight the initial event
    isInitialEventHighlighted: false,

    // The room alias of the room (or null if not originally specified in view_room)
    roomAlias: null,
    // Whether the current room is loading
    roomLoading: false,
    // Any error that has occurred during loading
    roomLoadError: null,
    // A map from room id to scroll state.
    //
    // If there is no special scroll state (ie, we are following the live
    // timeline), the scroll state is null. Otherwise, it is an object with
    // the following properties:
    //
    //    focussedEvent: the ID of the 'focussed' event. Typically this is
    //        the last event fully visible in the viewport, though if we
    //        have done an explicit scroll to an explicit event, it will be
    //        that event.
    //
    //    pixelOffset: the number of pixels the window is scrolled down
    //        from the focussedEvent.
    scrollStateMap: {},
};

/**
 * A class for storing application state for RoomView. This is the RoomView's interface
*  with a subset of the js-sdk.
 *  ```
 */
class RoomViewStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = INITIAL_STATE;
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
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
                this._viewRoom(payload);
                break;
            case 'view_room_error':
                this._viewRoomError(payload);
                break;
            case 'will_join':
                this._setState({
                    joining: true,
                });
                break;
            case 'cancel_join':
                this._setState({
                    joining: false,
                });
                break;
            // join_room:
            //      - opts: options for joinRoom
            case 'join_room':
                this._joinRoom(payload);
                break;
            case 'joined_room':
                this._joinedRoom(payload);
                break;
            case 'join_room_error':
                this._joinRoomError(payload);
                break;
            case 'on_logged_out':
                this.reset();
                break;
            case 'update_scroll_state':
                this._updateScrollState(payload);
                break;
        }
    }

    _viewRoom(payload) {
        if (payload.room_id) {
            const newState = {
                roomId: payload.room_id,
                initialEventId: payload.event_id,
                initialEventPixelOffset: payload.event_offset,
                isInitialEventHighlighted: payload.highlighted,
                roomLoading: false,
                roomLoadError: null,
            };

            // If an event ID wasn't specified, default to the one saved for this room
            // via update_scroll_state. Assume initialEventPixelOffset should be set.
            if (!newState.initialEventId) {
                const roomScrollState = this._state.scrollStateMap[payload.room_id];
                if (roomScrollState) {
                    newState.initialEventId = roomScrollState.focussedEvent;
                    newState.initialEventPixelOffset = roomScrollState.pixelOffset;
                }
            }

            this._setState(newState);
        } else if (payload.room_alias) {
            // Resolve the alias and then do a second dispatch with the room ID acquired
            this._setState({
                roomId: null,
                initialEventId: null,
                initialEventPixelOffset: null,
                isInitialEventHighlighted: null,
                roomAlias: payload.room_alias,
                roomLoading: true,
                roomLoadError: null,
            });
            MatrixClientPeg.get().getRoomIdForAlias(payload.room_alias).done(
            (result) => {
                dis.dispatch({
                    action: 'view_room',
                    room_id: result.room_id,
                    event_id: payload.event_id,
                    highlighted: payload.highlighted,
                    room_alias: payload.room_alias,
                });
            }, (err) => {
                dis.dispatch({
                    action: 'view_room_error',
                    room_id: null,
                    room_alias: payload.room_alias,
                    err: err,
                });
            });
        }
    }

    _viewRoomError(payload) {
        this._setState({
            roomId: payload.room_id,
            roomAlias: payload.room_alias,
            roomLoading: false,
            roomLoadError: payload.err,
        });
    }

    _joinRoom(payload) {
        this._setState({
            joining: true,
        });
        MatrixClientPeg.get().joinRoom(this._state.roomId, payload.opts).done(() => {
            dis.dispatch({
                action: 'joined_room',
            });
        }, (err) => {
            dis.dispatch({
                action: 'join_room_error',
                err: err,
            });
            const msg = err.message ? err.message : JSON.stringify(err);
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: _t("Failed to join room"),
                description: msg,
            });
        });
    }

    _joinedRoom(payload) {
        this._setState({
            joining: false,
        });
    }

    _joinRoomError(payload) {
        this._setState({
            joining: false,
            joinError: payload.err,
        });
    }

    _updateScrollState(payload) {
        // Clobber existing scroll state for the given room ID
        const newScrollStateMap = this._state.scrollStateMap;
        newScrollStateMap[payload.room_id] = payload.scroll_state;
        this._setState({
            scrollStateMap: newScrollStateMap,
        });
    }

    reset() {
        this._state = Object.assign({}, INITIAL_STATE);
    }

    // The room ID of the room currently being viewed
    getRoomId() {
        return this._state.roomId;
    }

    // The event to scroll to initially
    getInitialEventId() {
        return this._state.initialEventId;
    }

    // The offset to display the initial event at (see scrollStateMap)
    getInitialEventPixelOffset() {
        return this._state.initialEventPixelOffset;
    }

    // Whether to highlight the initial event
    isInitialEventHighlighted() {
        return this._state.isInitialEventHighlighted;
    }

    // The room alias of the room (or null if not originally specified in view_room)
    getRoomAlias() {
        return this._state.roomAlias;
    }

    // Whether the current room is loading (true whilst resolving an alias)
    isRoomLoading() {
        return this._state.roomLoading;
    }

    // Any error that has occurred during loading
    getRoomLoadError() {
        return this._state.roomLoadError;
    }

    // Whether we're joining the currently viewed room
    isJoining() {
        return this._state.joining;
    }

    // Any error that has occurred during joining
    getJoinError() {
        return this._state.joinError;
    }
}

let singletonRoomViewStore = null;
if (!singletonRoomViewStore) {
    singletonRoomViewStore = new RoomViewStore();
}
module.exports = singletonRoomViewStore;
