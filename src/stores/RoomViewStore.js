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

const INITIAL_STATE = {
    // Whether we're joining the currently viewed room
    joining: false,
    // Any error occurred during joining
    joinError: null,
    // The room ID of the room
    roomId: null,
    // The room alias of the room (or null if not originally specified in view_room)
    roomAlias: null,
    // Whether the current room is loading
    roomLoading: false,
    // Any error that has occurred during loading
    roomLoadError: null,
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
            //      - room_alias: '#somealias:matrix.org'
            //      - room_id:    '!roomid123:matrix.org'
            case 'view_room':
                this._viewRoom(payload);
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
        }
    }

    _viewRoom(payload) {
        const address = payload.room_alias || payload.room_id;
        if (address[0] == '#') {
            this._setState({
                roomLoading: true,
            });
            MatrixClientPeg.get().getRoomIdForAlias(address).then(
            (result) => {
                this._setState({
                    roomId: result.room_id,
                    roomAlias: address,
                    roomLoading: false,
                    roomLoadError: null,
                });
            }, (err) => {
                console.error(err);
                this._setState({
                    roomLoading: false,
                    roomLoadError: err,
                });
            });
        } else {
            this._setState({
                roomId: address,
            });
        }
    }

    _joinRoom(payload) {
        this._setState({
            joining: true,
        });
        MatrixClientPeg.get().joinRoom(this._state.roomId, payload.opts).then(
        () => {
            this._setState({
                joining: false,
            });
        }, (err) => {
            this._setState({
                joining: false,
                joinError: err,
            });
        });
    }

    reset() {
        this._state = Object.assign({}, INITIAL_STATE);
    }

    getRoomId() {
        return this._state.roomId;
    }

    getRoomAlias() {
        return this._state.roomAlias;
    }

    isRoomLoading() {
        return this._state.roomLoading;
    }

    isJoining() {
        return this._state.joining;
    }

    getJoinError() {
        return this._state.joinError;
    }

}

let singletonRoomViewStore = null;
if (!singletonRoomViewStore) {
    singletonRoomViewStore = new RoomViewStore();
}
module.exports = singletonRoomViewStore;
