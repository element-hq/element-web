/*
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import dis from '../dispatcher/dispatcher';
import {Store} from 'flux/utils';
import {MatrixClientPeg} from '../MatrixClientPeg';
import * as sdk from '../index';
import Modal from '../Modal';
import { _t } from '../languageHandler';
import { getCachedRoomIDForAlias, storeRoomAliasInCache } from '../RoomAliasCache';

const INITIAL_STATE = {
    // Whether we're joining the currently viewed room (see isJoining())
    joining: false,
    // Any error that has occurred during joining
    joinError: null,
    // The room ID of the room currently being viewed
    roomId: null,

    // The event to scroll to when the room is first viewed
    initialEventId: null,
    // Whether to highlight the initial event
    isInitialEventHighlighted: false,

    // The room alias of the room (or null if not originally specified in view_room)
    roomAlias: null,
    // Whether the current room is loading
    roomLoading: false,
    // Any error that has occurred during loading
    roomLoadError: null,

    forwardingEvent: null,

    quotingEvent: null,
    matrixClientIsReady: false,
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
        if (MatrixClientPeg.get()) {
            this._state.matrixClientIsReady = MatrixClientPeg.get().isInitialSyncComplete();
        }
    }

    _setState(newState) {
        // If values haven't changed, there's nothing to do.
        // This only tries a shallow comparison, so unchanged objects will slip
        // through, but that's probably okay for now.
        let stateChanged = false;
        for (const key of Object.keys(newState)) {
            if (this._state[key] !== newState[key]) {
                stateChanged = true;
                break;
            }
        }
        if (!stateChanged) {
            return;
        }

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
            case 'view_my_groups':
            case 'view_group':
                this._setState({
                    roomId: null,
                    roomAlias: null,
                });
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
            case 'join_room_error':
                this._joinRoomError(payload);
                break;
            case 'join_room_ready':
                this._setState({ shouldPeek: false });
                break;
            case 'on_client_not_viable':
            case 'on_logged_out':
                this.reset();
                break;
            case 'forward_event':
                this._setState({
                    forwardingEvent: payload.event,
                });
                break;
            case 'reply_to_event':
                // If currently viewed room does not match the room in which we wish to reply then change rooms
                // this can happen when performing a search across all rooms
                if (payload.event && payload.event.getRoomId() !== this._state.roomId) {
                    dis.dispatch({
                        action: 'view_room',
                        room_id: payload.event.getRoomId(),
                        replyingToEvent: payload.event,
                    });
                } else {
                    this._setState({
                        replyingToEvent: payload.event,
                    });
                }
                break;
            case 'open_room_settings': {
                const RoomSettingsDialog = sdk.getComponent("dialogs.RoomSettingsDialog");
                Modal.createTrackedDialog('Room settings', '', RoomSettingsDialog, {
                    roomId: payload.room_id || this._state.roomId,
                }, /*className=*/null, /*isPriority=*/false, /*isStatic=*/true);
                break;
            }
            case 'sync_state':
                this._setState({
                    matrixClientIsReady: MatrixClientPeg.get() && MatrixClientPeg.get().isInitialSyncComplete(),
                });
                break;
        }
    }

    async _viewRoom(payload) {
        if (payload.room_id) {
            const newState = {
                roomId: payload.room_id,
                roomAlias: payload.room_alias,
                initialEventId: payload.event_id,
                isInitialEventHighlighted: payload.highlighted,
                forwardingEvent: null,
                roomLoading: false,
                roomLoadError: null,
                // should peek by default
                shouldPeek: payload.should_peek === undefined ? true : payload.should_peek,
                // have we sent a join request for this room and are waiting for a response?
                joining: payload.joining || false,
                // Reset replyingToEvent because we don't want cross-room because bad UX
                replyingToEvent: null,
                // pull the user out of Room Settings
                isEditingSettings: false,
            };

            // Allow being given an event to be replied to when switching rooms but sanity check its for this room
            if (payload.replyingToEvent && payload.replyingToEvent.getRoomId() === payload.room_id) {
                newState.replyingToEvent = payload.replyingToEvent;
            }

            if (this._state.forwardingEvent) {
                dis.dispatch({
                    action: 'send_event',
                    room_id: newState.roomId,
                    event: this._state.forwardingEvent,
                });
            }

            this._setState(newState);

            if (payload.auto_join) {
                this._joinRoom(payload);
            }
        } else if (payload.room_alias) {
            // Try the room alias to room ID navigation cache first to avoid
            // blocking room navigation on the homeserver.
            let roomId = getCachedRoomIDForAlias(payload.room_alias);
            if (!roomId) {
                // Room alias cache miss, so let's ask the homeserver. Resolve the alias
                // and then do a second dispatch with the room ID acquired.
                this._setState({
                    roomId: null,
                    initialEventId: null,
                    initialEventPixelOffset: null,
                    isInitialEventHighlighted: null,
                    roomAlias: payload.room_alias,
                    roomLoading: true,
                    roomLoadError: null,
                });
                try {
                    const result = await MatrixClientPeg.get().getRoomIdForAlias(payload.room_alias);
                    storeRoomAliasInCache(payload.room_alias, result.room_id);
                    roomId = result.room_id;
                } catch (err) {
                    dis.dispatch({
                        action: 'view_room_error',
                        room_id: null,
                        room_alias: payload.room_alias,
                        err,
                    });
                    return;
                }
            }

            dis.dispatch({
                action: 'view_room',
                room_id: roomId,
                event_id: payload.event_id,
                highlighted: payload.highlighted,
                room_alias: payload.room_alias,
                auto_join: payload.auto_join,
                oob_data: payload.oob_data,
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
        MatrixClientPeg.get().joinRoom(
            this._state.roomAlias || this._state.roomId, payload.opts,
        ).then(() => {
            // We do *not* clear the 'joining' flag because the Room object and/or our 'joined' member event may not
            // have come down the sync stream yet, and that's the point at which we'd consider the user joined to the
            // room.
            dis.dispatch({ action: 'join_room_ready' });
        }, (err) => {
            dis.dispatch({
                action: 'join_room_error',
                err: err,
            });
            let msg = err.message ? err.message : JSON.stringify(err);
            // XXX: We are relying on the error message returned by browsers here.
            // This isn't great, but it does generalize the error being shown to users.
            if (msg && msg.startsWith("CORS request rejected")) {
                msg = _t("There was an error joining the room");
            }
            if (err.errcode === 'M_INCOMPATIBLE_ROOM_VERSION') {
                msg = <div>
                    {_t("Sorry, your homeserver is too old to participate in this room.")}<br />
                    {_t("Please contact your homeserver administrator.")}
                </div>;
            }
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to join room', '', ErrorDialog, {
                title: _t("Failed to join room"),
                description: msg,
            });
        });
    }

    _joinRoomError(payload) {
        this._setState({
            joining: false,
            joinError: payload.err,
        });
    }

    reset() {
        this._state = Object.assign({}, INITIAL_STATE);
    }

    // The room ID of the room currently being viewed
    getRoomId() {
        return this._state.roomId;
    }

    // The event to scroll to when the room is first viewed
    getInitialEventId() {
        return this._state.initialEventId;
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

    // True if we're expecting the user to be joined to the room currently being
    // viewed. Note that this is left true after the join request has finished,
    // since we should still consider a join to be in progress until the room
    // & member events come down the sync.
    //
    // This flag remains true after the room has been sucessfully joined,
    // (this store doesn't listen for the appropriate member events)
    // so you should always observe the joined state from the member event
    // if a room object is present.
    // ie. The correct logic is:
    // if (room) {
    //     if (myMember.membership == 'joined') {
    //         // user is joined to the room
    //     } else {
    //         // Not joined
    //     }
    // } else {
    //     if (RoomViewStore.isJoining()) {
    //         // show spinner
    //     } else {
    //         // show join prompt
    //     }
    // }
    isJoining() {
        return this._state.joining;
    }

    // Any error that has occurred during joining
    getJoinError() {
        return this._state.joinError;
    }

    // The mxEvent if one is about to be forwarded
    getForwardingEvent() {
        return this._state.forwardingEvent;
    }

    // The mxEvent if one is currently being replied to/quoted
    getQuotingEvent() {
        return this._state.replyingToEvent;
    }

    shouldPeek() {
        return this._state.shouldPeek && this._state.matrixClientIsReady;
    }
}

let singletonRoomViewStore = null;
if (!singletonRoomViewStore) {
    singletonRoomViewStore = new RoomViewStore();
}
export default singletonRoomViewStore;
