/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

// should be atomised
var Loader = require("react-loader");

var MatrixClientPeg = require("../../MatrixClientPeg");
var RoomListSorter = require("../../RoomListSorter");
var Presence = require("../../Presence");
var dis = require("../../dispatcher");
var q = require("q");

var ComponentBroker = require('../../ComponentBroker');
var Notifier = ComponentBroker.get('organisms/Notifier');
var MatrixTools = require('../../MatrixTools');

module.exports = {
    PageTypes: {
        RoomView: "room_view",
        UserSettings: "user_settings",
        CreateRoom: "create_room",
        RoomDirectory: "room_directory",
    },

    AuxPanel: {
        RoomSettings: "room_settings",
    },

    getInitialState: function() {
        var s = {
            logged_in: !!(MatrixClientPeg.get() && MatrixClientPeg.get().credentials),
            ready: false,
            aux_panel: null,
        };
        if (s.logged_in) {
            if (MatrixClientPeg.get().getRooms().length) {
                s.page_type = this.PageTypes.RoomView;
            } else {
                s.page_type = this.PageTypes.RoomDirectory;
            }
        }
        return s;
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        if (this.state.logged_in) {
            this.startMatrixClient();
        }
        this.focusComposer = false;
        document.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("focus", this.onFocus);
        if (this.state.logged_in) {
            this.notifyNewScreen('');
        } else {
            this.notifyNewScreen('login');
        }
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
        document.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("focus", this.onFocus);
    },

    componentDidUpdate: function() {
        if (this.focusComposer) {
            dis.dispatch({action: 'focus_composer'});
            this.focusComposer = false;
        }
    },

    onAction: function(payload) {
        var roomIndexDelta = 1;

        switch (payload.action) {
            case 'logout':
                this.replaceState({
                    logged_in: false,
                    ready: false
                });
                if (window.localStorage) {
                    window.localStorage.clear();
                }
                Notifier.stop();
                Presence.stop();
                MatrixClientPeg.get().stopClient();
                MatrixClientPeg.get().removeAllListeners();
                MatrixClientPeg.unset();
                this.notifyNewScreen('');
                break;
            case 'start_registration':
                if (this.state.logged_in) return;
                var newState = payload.params || {};
                newState.screen = 'register';
                if (
                    payload.params &&
                    payload.params.client_secret &&
                    payload.params.session_id &&
                    payload.params.hs_url &&
                    payload.params.is_url &&
                    payload.params.sid
                ) {
                    newState.register_client_secret = payload.params.client_secret;
                    newState.register_session_id = payload.params.session_id;
                    newState.register_hs_url = payload.params.hs_url;
                    newState.register_is_url = payload.params.is_url;
                    newState.register_id_sid = payload.params.sid;
                }
                this.replaceState(newState);
                this.notifyNewScreen('register');
                break;
            case 'start_login':
                if (this.state.logged_in) return;
                this.replaceState({
                    screen: 'login'
                });
                this.notifyNewScreen('login');
                break;
            case 'view_room':
                this.focusComposer = true;
                this.setState({
                    currentRoom: payload.room_id,
                    page_type: this.PageTypes.RoomView,
                });
                if (this.sdkReady) {
                    // if the SDK is not ready yet, remember what room
                    // we're supposed to be on but don't notify about
                    // the new screen yet (we won't be showing it yet)
                    // The normal case where this happens is navigating
                    // to the room in the URL bar on page load.
                    var presentedId = payload.room_id;
                    var room = MatrixClientPeg.get().getRoom(payload.room_id);
                    if (room) {
                        var theAlias = MatrixTools.getCanonicalAliasForRoom(room);
                        if (theAlias) presentedId = theAlias;
                    }
                    this.notifyNewScreen('room/'+presentedId);
                }
                break;
            case 'view_prev_room':
                roomIndexDelta = -1;
            case 'view_next_room':
                var allRooms = RoomListSorter.mostRecentActivityFirst(
                    MatrixClientPeg.get().getRooms()
                );
                var roomIndex = -1;
                for (var i = 0; i < allRooms.length; ++i) {
                    if (allRooms[i].roomId == this.state.currentRoom) {
                        roomIndex = i;
                        break;
                    }
                }
                roomIndex = (roomIndex + roomIndexDelta) % allRooms.length;
                if (roomIndex < 0) roomIndex = allRooms.length - 1;
                this.focusComposer = true;
                this.setState({
                    currentRoom: allRooms[roomIndex].roomId
                });
                this.notifyNewScreen('room/'+allRooms[roomIndex].roomId);
                break;
            case 'view_indexed_room':
                var allRooms = RoomListSorter.mostRecentActivityFirst(
                    MatrixClientPeg.get().getRooms()
                );
                var roomIndex = payload.roomIndex;
                if (allRooms[roomIndex]) {
                    this.focusComposer = true;
                    this.setState({
                        currentRoom: allRooms[roomIndex].roomId
                    });
                    this.notifyNewScreen('room/'+allRooms[roomIndex].roomId);
                }
                break;
            case 'view_user_settings':
                this.setState({
                    page_type: this.PageTypes.UserSettings,
                });
                break;
            case 'view_create_room':
                this.setState({
                    page_type: this.PageTypes.CreateRoom,
                });
                break;
            case 'view_room_directory':
                this.setState({
                    page_type: this.PageTypes.RoomDirectory,
                });
                break;
            case 'notifier_enabled':
                this.forceUpdate();
                break;
        }
    },

    onLoggedIn: function() {
        this.setState({
            screen: undefined,
            logged_in: true
        });
        this.startMatrixClient();
        this.notifyNewScreen('');
    },

    startMatrixClient: function() {
        var cli = MatrixClientPeg.get();
        var self = this;
        cli.on('syncComplete', function() {
            self.sdkReady = true;
            if (!self.state.currentRoom) {
                var firstRoom = null;
                if (cli.getRooms() && cli.getRooms().length) {
                    firstRoom = RoomListSorter.mostRecentActivityFirst(
                        cli.getRooms()
                    )[0].roomId;
                    self.setState({ready: true, currentRoom: firstRoom, page_type: self.PageTypes.RoomView});
                } else {
                    self.setState({ready: true, page_type: self.PageTypes.RoomDirectory});
                }
            } else {
                self.setState({ready: true, currentRoom: self.state.currentRoom});
            }

            // we notifyNewScreen now because now the room will actually be displayed,
            // and (mostly) now we can get the correct alias.
            var presentedId = self.state.currentRoom;
            var room = MatrixClientPeg.get().getRoom(self.state.currentRoom);
            if (room) {
                var theAlias = MatrixTools.getCanonicalAliasForRoom(room);
                if (theAlias) presentedId = theAlias;
            }
            self.notifyNewScreen('room/'+presentedId);
            dis.dispatch({action: 'focus_composer'});
        });
        cli.on('Call.incoming', function(call) {
            dis.dispatch({
                action: 'incoming_call',
                call: call
            });
        });
        Notifier.start();
        Presence.start();
        cli.startClient();
    },

    onKeyDown: function(ev) {
        if (ev.altKey) {
            if (ev.ctrlKey && ev.keyCode > 48 && ev.keyCode < 58) {
                dis.dispatch({
                    action: 'view_indexed_room',
                    roomIndex: ev.keyCode - 49,
                });
                ev.stopPropagation();
                ev.preventDefault();
                return;                
            }
            switch (ev.keyCode) {
                case 38:
                    dis.dispatch({action: 'view_prev_room'});
                    ev.stopPropagation();
                    ev.preventDefault();
                    break;
                case 40:
                    dis.dispatch({action: 'view_next_room'});
                    ev.stopPropagation();
                    ev.preventDefault();
                    break;
            }
        }
    },

    onFocus: function(ev) {
        dis.dispatch({action: 'focus_composer'});
    },

    showScreen: function(screen, params) {
        if (screen == 'register') {
            dis.dispatch({
                action: 'start_registration',
                params: params
            });
        } else if (screen == 'login') {
            dis.dispatch({
                action: 'start_login',
                params: params
            });
        } else if (screen.indexOf('room/') == 0) {
            var roomString = screen.split('/')[1];
            var defer = q.defer();
            if (roomString[0] == '#') {
                var self = this;
                MatrixClientPeg.get().getRoomIdForAlias(roomString).done(function(result) {
                    if (self.sdkReady) self.setState({ready: true});
                    defer.resolve(result.room_id);
                }, function() {
                    if (self.sdkReady) self.setState({ready: true});
                    defer.resolve(null);
                });
                this.setState({ready: false});
            } else {
                defer.resolve(roomString);
            }
            defer.promise.done(function(roomId) {
                dis.dispatch({
                    action: 'view_room',
                    room_id: roomId
                });
            });
        }
    },

    notifyNewScreen: function(screen) {
        if (this.props.onNewScreen) {
            this.props.onNewScreen(screen);
        }
    }
};
