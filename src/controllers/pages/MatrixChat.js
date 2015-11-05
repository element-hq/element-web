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

var MatrixClientPeg = require("../../MatrixClientPeg");
var RoomListSorter = require("../../RoomListSorter");
var UserActivity = require("../../UserActivity");
var Presence = require("../../Presence");
var dis = require("../../dispatcher");

var sdk = require('../../index');
var MatrixTools = require('../../MatrixTools');
var linkifyMatrix = require("../../linkify-matrix");

var Cas = require("../../CasLogic");

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
            collapse_lhs: false,
            collapse_rhs: false,
            ready: false,
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

        // this can technically be done anywhere but doing this here keeps all
        // the routing url path logic together.
        if (this.onAliasClick) {
            linkifyMatrix.onAliasClick = this.onAliasClick;
        }
        if (this.onUserClick) {
            linkifyMatrix.onUserClick = this.onUserClick;
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
        var Notifier = sdk.getComponent('organisms.Notifier');

        var self = this;
        switch (payload.action) {
            case 'logout':
                if (window.localStorage) {
                    window.localStorage.clear();
                }
                Notifier.stop();
                UserActivity.stop();
                Presence.stop();
                MatrixClientPeg.get().stopClient();
                MatrixClientPeg.get().removeAllListeners();
                MatrixClientPeg.unset();
                this.notifyNewScreen('login');
                this.replaceState({
                    logged_in: false,
                    ready: false
                });
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
            case 'cas_login':
                if (this.state.logged_in) return;

                var self = this;
                var client = MatrixClientPeg.get();
                var serviceUrl = Cas.getServiceUrl();

                client.loginWithCas(payload.params.ticket, serviceUrl).done(function(data) {
                    MatrixClientPeg.replaceUsingAccessToken(
                        client.getHomeserverUrl(), client.getIdentityServerUrl(),
                        data.user_id, data.access_token
                    );
                    self.setState({
                        screen: undefined,
                        logged_in: true
                    });
                    self.startMatrixClient();
                    self.notifyNewScreen('');
                }, function(error) {
                    self.notifyNewScreen('login');
                    self.setState({errorText: 'Login failed.'});
                });

                break;
            case 'view_room':
                this.focusComposer = true;
                var newState = {
                    currentRoom: payload.room_id,
                    page_type: this.PageTypes.RoomView,
                };
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
                    newState.ready = true;
                }
                this.setState(newState);
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
            case 'view_room_alias':
                var foundRoom = MatrixTools.getRoomForAlias(
                    MatrixClientPeg.get().getRooms(), payload.room_alias
                );
                if (foundRoom) {
                    dis.dispatch({
                        action: 'view_room',
                        room_id: foundRoom.roomId
                    });
                    return;
                }
                // resolve the alias and *then* view it
                MatrixClientPeg.get().getRoomIdForAlias(payload.room_alias).done(
                function(result) {
                    dis.dispatch({
                        action: 'view_room',
                        room_id: result.room_id
                    });
                });
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
            case 'hide_left_panel':
                this.setState({
                    collapse_lhs: true,
                });
                break;
            case 'show_left_panel':
                this.setState({
                    collapse_lhs: false,
                });
                break;
            case 'hide_right_panel':
                this.setState({
                    collapse_rhs: true,
                });
                break;
            case 'show_right_panel':
                this.setState({
                    collapse_rhs: false,
                });
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
        var Notifier = sdk.getComponent('organisms.Notifier');
        var cli = MatrixClientPeg.get();
        var self = this;
        cli.on('sync', function(state) {
            if (self.sdkReady || state !== "PREPARED") { return; }
            self.sdkReady = true;

            if (self.starting_room_alias) {
                dis.dispatch({
                    action: 'view_room_alias',
                    room_alias: self.starting_room_alias
                });
                delete self.starting_room_alias;
            } else {
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
                    self.setState({ready: true, page_type: self.PageTypes.RoomView});
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
            }
        });
        cli.on('Call.incoming', function(call) {
            dis.dispatch({
                action: 'incoming_call',
                call: call
            });
        });
        Notifier.start();
        UserActivity.start();
        Presence.start();
        cli.startClient({resolveInvitesToProfiles: true});
    },

    onKeyDown: function(ev) {
        if (ev.altKey) {
            /*
            // Remove this for now as ctrl+alt = alt-gr so this breaks keyboards which rely on alt-gr for numbers
            // Will need to find a better meta key if anyone actually cares about using this.
            if (ev.ctrlKey && ev.keyCode > 48 && ev.keyCode < 58) {
                dis.dispatch({
                    action: 'view_indexed_room',
                    roomIndex: ev.keyCode - 49,
                });
                ev.stopPropagation();
                ev.preventDefault();
                return;
            }
            */
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
        } else if (screen == 'cas_login') {
            dis.dispatch({
                action: 'cas_login',
                params: params
            });
        } else if (screen.indexOf('room/') == 0) {
            var roomString = screen.split('/')[1];
            if (roomString[0] == '#') {
                if (this.state.logged_in) {
                    dis.dispatch({
                        action: 'view_room_alias',
                        room_alias: roomString
                    });
                } else {
                    // Okay, we'll take you here soon...
                    this.starting_room_alias = roomString;
                    // ...but you're still going to have to log in.
                    this.notifyNewScreen('login');
                }
            } else {
                dis.dispatch({
                    action: 'view_room',
                    room_id: roomString
                });
            }
        }
    },

    notifyNewScreen: function(screen) {
        if (this.props.onNewScreen) {
            this.props.onNewScreen(screen);
        }
    }
};
