/*
Copyright 2015, 2016 OpenMarket Ltd

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
var React = require('react');
var Matrix = require("matrix-js-sdk");
var url = require('url');
var Favico = require('favico.js');

var MatrixClientPeg = require("../../MatrixClientPeg");
var Notifier = require("../../Notifier");
var ContextualMenu = require("../../ContextualMenu");
var RoomListSorter = require("../../RoomListSorter");
var UserActivity = require("../../UserActivity");
var Presence = require("../../Presence");
var dis = require("../../dispatcher");

var Login = require("./login/Login");
var Registration = require("./login/Registration");
var PostRegistration = require("./login/PostRegistration");

var Modal = require("../../Modal");
var Tinter = require("../../Tinter");
var sdk = require('../../index');
var MatrixTools = require('../../MatrixTools');
var linkifyMatrix = require("../../linkify-matrix");
var KeyCode = require('../../KeyCode');

var createRoom = require("../../createRoom");

module.exports = React.createClass({
    displayName: 'MatrixChat',

    propTypes: {
        config: React.PropTypes.object,
        ConferenceHandler: React.PropTypes.any,
        onNewScreen: React.PropTypes.func,
        registrationUrl: React.PropTypes.string,
        enableGuest: React.PropTypes.bool,
        startingQueryParams: React.PropTypes.object
    },

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
            width: 10000,
            sideOpacity: 1.0,
            middleOpacity: 1.0,
        };
        if (s.logged_in) {
            if (MatrixClientPeg.get().getRooms().length) {
                s.page_type = this.PageTypes.RoomView;
            } else {
                // we don't need to default to the directoy here
                // as we'll go there anyway after syncing
                // s.page_type = this.PageTypes.RoomDirectory;
            }
        }
        return s;
    },

    getDefaultProps: function() {
        return {
            startingQueryParams: {},
            config: {},
        };
    },

    getCurrentHsUrl: function() {
        if (this.state.register_hs_url) {
            return this.state.register_hs_url;
        } else if (MatrixClientPeg.get()) {
            return MatrixClientPeg.get().getHomeserverUrl();
        }
        else if (window.localStorage && window.localStorage.getItem("mx_hs_url")) {
            return window.localStorage.getItem("mx_hs_url");
        }
        else {
            return this.props.config.default_hs_url || "https://matrix.org";
        }
    },

    getFallbackHsUrl: function() {
        return this.props.config.fallback_hs_url;
    },

    getCurrentIsUrl: function() {
        if (this.state.register_is_url) {
            return this.state.register_is_url;
        } else if (MatrixClientPeg.get()) {
            return MatrixClientPeg.get().getIdentityServerUrl();
        }
        else if (window.localStorage && window.localStorage.getItem("mx_is_url")) {
            return window.localStorage.getItem("mx_is_url");
        }
        else {
            return this.props.config.default_is_url || "https://vector.im"
        }
    },

    componentWillMount: function() {
        this.favicon = new Favico({animation: 'none'});
    },

    componentDidMount: function() {
        this._autoRegisterAsGuest = false;
        if (this.props.enableGuest) {
            if (!this.getCurrentHsUrl()) {
                console.error("Cannot enable guest access: can't determine HS URL to use");
            }
            else if (this.props.startingQueryParams.client_secret && this.props.startingQueryParams.sid) {
                console.log("Not registering as guest; registration.");
                this._autoRegisterAsGuest = false;
            }
            else if (this.props.startingQueryParams.guest_user_id &&
                this.props.startingQueryParams.guest_access_token)
            {
                this._autoRegisterAsGuest = false;
                this.onLoggedIn({
                    userId: this.props.startingQueryParams.guest_user_id,
                    accessToken: this.props.startingQueryParams.guest_access_token,
                    homeserverUrl: this.props.config.default_hs_url,
                    identityServerUrl: this.props.config.default_is_url,
                    guest: true
                });
            }
            else {
                this._autoRegisterAsGuest = true;
            }
        }

        this.dispatcherRef = dis.register(this.onAction);
        if (this.state.logged_in) {
            // Don't auto-register as a guest. This applies if you refresh the page on a
            // logged in client THEN hit the Sign Out button.
            this._autoRegisterAsGuest = false;
            this.startMatrixClient();
        }
        this.focusComposer = false;
        // scrollStateMap is a map from room id to the scroll state returned by
        // RoomView.getScrollState()
        this.scrollStateMap = {};
        document.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("focus", this.onFocus);

        if (this.state.logged_in) {
            this.notifyNewScreen('');
        } else if (this._autoRegisterAsGuest) {
            this._registerAsGuest();
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

        window.addEventListener('resize', this.handleResize);
        this.handleResize();
    },

    componentWillUnmount: function() {
        this._stopMatrixClient();
        dis.unregister(this.dispatcherRef);
        document.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("focus", this.onFocus);
        window.removeEventListener('resize', this.handleResize);
    },

    componentDidUpdate: function() {
        if (this.focusComposer) {
            dis.dispatch({action: 'focus_composer'});
            this.focusComposer = false;
        }
    },

    _registerAsGuest: function(showWarning) {
        var self = this;
        console.log("Doing guest login on %s", this.getCurrentHsUrl());
        var hsUrl = this.getCurrentHsUrl();
        var isUrl = this.getCurrentIsUrl();

        MatrixClientPeg.replaceUsingUrls(hsUrl, isUrl);
        MatrixClientPeg.get().registerGuest().done(function(creds) {
            console.log("Registered as guest: %s", creds.user_id);
            self._setAutoRegisterAsGuest(false);
            self.onLoggedIn({
                userId: creds.user_id,
                accessToken: creds.access_token,
                homeserverUrl: hsUrl,
                identityServerUrl: isUrl,
                guest: true
            });
        }, function(err) {
            if (showWarning) {
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Failed to login as guest",
                    description: err.data
                });
            }
            console.error("Failed to register as guest: " + err + " " + err.data);
            self._setAutoRegisterAsGuest(false);
        });
    },

    _setAutoRegisterAsGuest: function(shouldAutoRegister) {
        this._autoRegisterAsGuest = shouldAutoRegister;
        this.forceUpdate();
    },

    onAction: function(payload) {
        var roomIndexDelta = 1;

        var self = this;
        switch (payload.action) {
            case 'logout':
                var guestCreds;
                if (MatrixClientPeg.get().isGuest()) {
                    guestCreds = { // stash our guest creds so we can backout if needed
                        userId: MatrixClientPeg.get().credentials.userId,
                        accessToken: MatrixClientPeg.get().getAccessToken(),
                        homeserverUrl: MatrixClientPeg.get().getHomeserverUrl(),
                        identityServerUrl: MatrixClientPeg.get().getIdentityServerUrl(),
                        guest: true
                    }
                }

                if (window.localStorage) {
                    var hsUrl = this.getCurrentHsUrl();
                    var isUrl = this.getCurrentIsUrl();
                    window.localStorage.clear();
                    // preserve our HS & IS URLs for convenience
                    // N.B. we cache them in hsUrl/isUrl and can't really inline them
                    // as getCurrentHsUrl() may call through to localStorage.
                    window.localStorage.setItem("mx_hs_url", hsUrl);
                    window.localStorage.setItem("mx_is_url", isUrl);
                }
                this._stopMatrixClient();
                this.notifyNewScreen('login');
                this.replaceState({
                    logged_in: false,
                    ready: false,
                    guestCreds: guestCreds,
                });
                break;
            case 'start_registration':
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
                    screen: 'login',
                    guestCreds: this.state.guestCreds,
                });
                this.notifyNewScreen('login');
                break;
            case 'start_post_registration':
                this.setState({ // don't clobber logged_in status
                    screen: 'post_registration'
                });
                break;
            case 'start_upgrade_registration':
                this.replaceState({
                    screen: "register",
                    upgradeUsername: MatrixClientPeg.get().getUserIdLocalpart(),
                    guestAccessToken: MatrixClientPeg.get().getAccessToken(),
                    guestCreds: { // stash our guest creds so we can backout if needed
                        userId: MatrixClientPeg.get().credentials.userId,
                        accessToken: MatrixClientPeg.get().getAccessToken(),
                        homeserverUrl: MatrixClientPeg.get().getHomeserverUrl(),
                        identityServerUrl: MatrixClientPeg.get().getIdentityServerUrl(),
                        guest: true
                    }
                });
                this.notifyNewScreen('register');
                break;
            case 'start_password_recovery':
                if (this.state.logged_in) return;
                this.replaceState({
                    screen: 'forgot_password'
                });
                this.notifyNewScreen('forgot_password');
                break;
            case 'token_login':
                if (this.state.logged_in) return;

                var self = this;
                MatrixClientPeg.replaceUsingUrls(
                    payload.params.homeserver,
                    payload.params.identityServer
                );

                var client = MatrixClientPeg.get();
                client.loginWithToken(payload.params.loginToken).done(function(data) {
                    MatrixClientPeg.replaceUsingAccessToken(
                        client.getHomeserverUrl(), client.getIdentityServerUrl(),
                        data.user_id, data.access_token
                    );
                    self.setState({
                        screen: undefined,
                        logged_in: true
                    });

                    // We're left with the login token, hs and is url as query params
                    // in the url, a little nasty but let's redirect to clear them
                    var parsedUrl = url.parse(window.location.href);
                    parsedUrl.search = "";
                    window.location.href = url.format(parsedUrl);

                }, function(error) {
                    self.notifyNewScreen('login');
                    self.setState({errorText: 'Login failed.'});
                });

                break;
            case 'leave_room':
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

                var roomId = payload.room_id;
                Modal.createDialog(QuestionDialog, {
                    title: "Leave room",
                    description: "Are you sure you want to leave the room?",
                    onFinished: function(should_leave) {
                        if (should_leave) {
                            var d = MatrixClientPeg.get().leave(roomId);

                            // FIXME: controller shouldn't be loading a view :(
                            var Loader = sdk.getComponent("elements.Spinner");
                            var modal = Modal.createDialog(Loader);

                            d.then(function() {
                                modal.close();
                                dis.dispatch({action: 'view_next_room'});
                            }, function(err) {
                                modal.close();
                                Modal.createDialog(ErrorDialog, {
                                    title: "Failed to leave room",
                                    description: err.toString()
                                });
                            });
                        }
                    }
                });
                break;
            case 'view_room':
                // Takes both room ID and room alias: if switching to a room the client is already
                // know to be in (eg. user clicks on a room in the recents panel), supply only the
                // ID. If the user is clicking on a room in the context of the alias being presented
                // to them, supply the room alias and optionally the room ID.
                this._viewRoom(
                    payload.room_id, payload.room_alias, payload.show_settings, payload.event_id,
                    payload.third_party_invite, payload.oob_data
                );
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
                this._viewRoom(allRooms[roomIndex].roomId);
                break;
            case 'view_indexed_room':
                var allRooms = RoomListSorter.mostRecentActivityFirst(
                    MatrixClientPeg.get().getRooms()
                );
                var roomIndex = payload.roomIndex;
                if (allRooms[roomIndex]) {
                    this._viewRoom(allRooms[roomIndex].roomId);
                }
                break;
            case 'view_user_settings':
                this._setPage(this.PageTypes.UserSettings);
                this.notifyNewScreen('settings');
                break;
            case 'view_create_room':
                //this._setPage(this.PageTypes.CreateRoom);
                //this.notifyNewScreen('new');

                createRoom().done();
                break;
            case 'view_room_directory':
                this._setPage(this.PageTypes.RoomDirectory);
                this.notifyNewScreen('directory');
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
            case 'ui_opacity':
                this.setState({
                    sideOpacity: payload.sideOpacity,
                    middleOpacity: payload.middleOpacity,
                });
                break;
        }
    },

    _setPage: function(pageType) {
        // record the scroll state if we're in a room view.
        this._updateScrollMap();

        this.setState({
            page_type: pageType,
        });
    },

    // switch view to the given room
    //
    // eventId is optional and will cause a switch to the context of that
    // particular event.
    // @param {Object} thirdPartyInvite Object containing data about the third party
    //                                    we received to join the room, if any.
    // @param {string} thirdPartyInvite.inviteSignUrl 3pid invite sign URL
    // @param {string} thirdPartyInvite.invitedwithEmail The email address the invite was sent to
    // @param {Object} oob_data Object of additional data about the room
    //                               that has been passed out-of-band (eg.
    //                               room name and avatar from an invite email)
    _viewRoom: function(roomId, roomAlias, showSettings, eventId, thirdPartyInvite, oob_data) {
        // before we switch room, record the scroll state of the current room
        this._updateScrollMap();

        this.focusComposer = true;

        var newState = {
            initialEventId: eventId,
            highlightedEventId: eventId,
            initialEventPixelOffset: undefined,
            page_type: this.PageTypes.RoomView,
            thirdPartyInvite: thirdPartyInvite,
            roomOobData: oob_data,
        };

        // If an alias has been provided, we use that and only that,
        // since otherwise we'll prefer to pass in an ID to RoomView
        // but if we're not in the room, we should join by alias rather
        // than ID.
        if (roomAlias) {
            newState.currentRoomAlias = roomAlias;
            newState.currentRoom = null;
        } else {
            newState.currentRoomAlias = null;
            newState.currentRoom = roomId;
        }

        // if we aren't given an explicit event id, look for one in the
        // scrollStateMap.
        if (!eventId) {
            var scrollState = this.scrollStateMap[roomId];
            if (scrollState) {
                newState.initialEventId = scrollState.focussedEvent;
                newState.initialEventPixelOffset = scrollState.pixelOffset;
            }
        }

        if (this.sdkReady) {
            // if the SDK is not ready yet, remember what room
            // we're supposed to be on but don't notify about
            // the new screen yet (we won't be showing it yet)
            // The normal case where this happens is navigating
            // to the room in the URL bar on page load.
            var presentedId = roomAlias || roomId;
            var room = MatrixClientPeg.get().getRoom(roomId);
            if (room) {
                var theAlias = MatrixTools.getCanonicalAliasForRoom(room);
                if (theAlias) presentedId = theAlias;

                // No need to do this given RoomView triggers it itself...
                // var color_scheme_event = room.getAccountData("org.matrix.room.color_scheme");
                // var color_scheme = {};
                // if (color_scheme_event) {
                //     color_scheme = color_scheme_event.getContent();
                //     // XXX: we should validate the event
                // }
                // console.log("Tinter.tint from _viewRoom");
                // Tinter.tint(color_scheme.primary_color, color_scheme.secondary_color);
            }

            if (eventId) {
                presentedId += "/"+eventId;
            }
            this.notifyNewScreen('room/'+presentedId);
            newState.ready = true;
        }
        this.setState(newState);

        if (this.refs.roomView && showSettings) {
            this.refs.roomView.showSettings(true);
        }
    },

    // update scrollStateMap according to the current scroll state of the
    // room view.
    _updateScrollMap: function() {
        if (!this.refs.roomView) {
            return;
        }
        var roomview = this.refs.roomView;
        var roomId = this.refs.roomView.getRoomId();
        if (!roomId) {
            return;
        }
        var state = roomview.getScrollState();
        this.scrollStateMap[roomId] = state;
    },

    onLoggedIn: function(credentials) {
        credentials.guest = Boolean(credentials.guest);
        console.log("onLoggedIn => %s (guest=%s)", credentials.userId, credentials.guest);
        MatrixClientPeg.replaceUsingAccessToken(
            credentials.homeserverUrl, credentials.identityServerUrl,
            credentials.userId, credentials.accessToken, credentials.guest
        );
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
        cli.on('sync', function(state, prevState) {
            self.updateFavicon(state, prevState);
            if (state === "SYNCING" && prevState === "SYNCING") {
                return;
            }
            console.log("MatrixClient sync state => %s", state);
            if (state !== "PREPARED") { return; }
            self.sdkReady = true;

            if (self.starting_room_alias_payload) {
                dis.dispatch(self.starting_room_alias_payload);
                delete self.starting_room_alias_payload;
            } else if (!self.state.page_type) {
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

                if (presentedId != undefined) {
                    self.notifyNewScreen('room/'+presentedId);
                } else {
                    // There is no information on presentedId
                    // so point user to fallback like /directory
                    self.notifyNewScreen('directory');
                }

                dis.dispatch({action: 'focus_composer'});
            } else {
                self.setState({ready: true});
            }
        });
        cli.on('Call.incoming', function(call) {
            dis.dispatch({
                action: 'incoming_call',
                call: call
            });
        });
        cli.on('Session.logged_out', function(call) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Logged Out",
                description: "For security, this session has been logged out. Please log in again."
            });
            dis.dispatch({
                action: 'logout'
            });
        });
        Notifier.start();
        UserActivity.start();
        Presence.start();
        cli.startClient({
            pendingEventOrdering: "detached",
            initialSyncLimit: this.props.config.sync_timeline_limit || 20,
        });
    },

    // stop all the background processes related to the current client
    _stopMatrixClient: function() {
        Notifier.stop();
        UserActivity.stop();
        Presence.stop();
        MatrixClientPeg.get().stopClient();
        MatrixClientPeg.get().removeAllListeners();
        MatrixClientPeg.unset();
    },

    onKeyDown: function(ev) {
            /*
            // Remove this for now as ctrl+alt = alt-gr so this breaks keyboards which rely on alt-gr for numbers
            // Will need to find a better meta key if anyone actually cares about using this.
            if (ev.altKey && ev.ctrlKey && ev.keyCode > 48 && ev.keyCode < 58) {
                dis.dispatch({
                    action: 'view_indexed_room',
                    roomIndex: ev.keyCode - 49,
                });
                ev.stopPropagation();
                ev.preventDefault();
                return;
            }
            */

        var handled = false;

        switch (ev.keyCode) {
            case KeyCode.UP:
            case KeyCode.DOWN:
                if (ev.altKey) {
                    var action = ev.keyCode == KeyCode.UP ?
                        'view_prev_room' : 'view_next_room';
                    dis.dispatch({action: action});
                    handled = true;
                }
                break;

            case KeyCode.PAGE_UP:
            case KeyCode.PAGE_DOWN:
                this._onScrollKeyPressed(ev);
                handled = true;
                break;

            case KeyCode.HOME:
            case KeyCode.END:
                if (ev.ctrlKey) {
                    this._onScrollKeyPressed(ev);
                    handled = true;
                }
                break;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    },

    /** dispatch a page-up/page-down/etc to the appropriate component */
    _onScrollKeyPressed(ev) {
        if (this.refs.roomView) {
            this.refs.roomView.handleScrollKey(ev);
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
        } else if (screen == 'token_login') {
            dis.dispatch({
                action: 'token_login',
                params: params
            });
        } else if (screen == 'forgot_password') {
            dis.dispatch({
                action: 'start_password_recovery',
                params: params
            });
        } else if (screen == 'new') {
            dis.dispatch({
                action: 'view_create_room',
            });
        } else if (screen == 'settings') {
            dis.dispatch({
                action: 'view_user_settings',
            });
        } else if (screen == 'directory') {
            dis.dispatch({
                action: 'view_room_directory',
            });
        } else if (screen == 'post_registration') {
            dis.dispatch({
                action: 'start_post_registration',
            });
        } else if (screen.indexOf('room/') == 0) {
            var segments = screen.substring(5).split('/');
            var roomString = segments[0];
            var eventId = segments[1]; // undefined if no event id given

            // FIXME: sort_out caseConsistency
            var third_party_invite = {
                inviteSignUrl: params.signurl,
                invitedEmail: params.email,
            };
            var oob_data = {
                name: params.room_name,
                avatarUrl: params.room_avatar_url,
                inviterName: params.inviter_name,
            };

            var payload = {
                action: 'view_room',
                event_id: eventId,
                third_party_invite: third_party_invite,
                oob_data: oob_data,
            };
            if (roomString[0] == '#') {
                payload.room_alias = roomString;
            } else {
                payload.room_id = roomString;
            }

            // we can't view a room unless we're logged in
            // (a guest account is fine)
            if (!this.state.logged_in) {
                this.starting_room_alias_payload = payload;
                // Login is the default screen, so we'd do this anyway,
                // but this will set the URL bar appropriately.
                dis.dispatch({ action: 'start_login' });
                return;
            } else {
                dis.dispatch(payload);
            }
        }
        else {
            console.info("Ignoring showScreen for '%s'", screen);
        }
    },

    notifyNewScreen: function(screen) {
        if (this.props.onNewScreen) {
            this.props.onNewScreen(screen);
        }
    },

    onAliasClick: function(event, alias) {
        event.preventDefault();
        dis.dispatch({action: 'view_room', room_alias: alias});
    },

    onUserClick: function(event, userId) {
        event.preventDefault();

        /*
        var MemberInfo = sdk.getComponent('rooms.MemberInfo');
        var member = new Matrix.RoomMember(null, userId);
        ContextualMenu.createMenu(MemberInfo, {
            member: member,
            right: window.innerWidth - event.pageX,
            top: event.pageY
        });
        */

        var member = new Matrix.RoomMember(null, userId);
        if (!member) { return; }
        dis.dispatch({
            action: 'view_user',
            member: member,
        });
    },

    onLogoutClick: function(event) {
        dis.dispatch({
            action: 'logout'
        });
        event.stopPropagation();
        event.preventDefault();
    },

    handleResize: function(e) {
        var hideLhsThreshold = 1000;
        var showLhsThreshold = 1000;
        var hideRhsThreshold = 820;
        var showRhsThreshold = 820;

        if (this.state.width > hideLhsThreshold && window.innerWidth <= hideLhsThreshold) {
            dis.dispatch({ action: 'hide_left_panel' });
        }
        if (this.state.width <= showLhsThreshold && window.innerWidth > showLhsThreshold) {
            dis.dispatch({ action: 'show_left_panel' });
        }
        if (this.state.width > hideRhsThreshold && window.innerWidth <= hideRhsThreshold) {
            dis.dispatch({ action: 'hide_right_panel' });
        }
        if (this.state.width <= showRhsThreshold && window.innerWidth > showRhsThreshold) {
            dis.dispatch({ action: 'show_right_panel' });
        }

        this.setState({width: window.innerWidth});
    },

    onRoomCreated: function(room_id) {
        dis.dispatch({
            action: "view_room",
            room_id: room_id,
        });
    },

    onRegisterClick: function() {
        this.showScreen("register");
    },

    onLoginClick: function() {
        this.showScreen("login");
    },

    onForgotPasswordClick: function() {
        this.showScreen("forgot_password");
    },

    onReturnToGuestClick: function() {
        // reanimate our guest login
        this.onLoggedIn(this.state.guestCreds);
        this.setState({ guestCreds: null });
    },

    onRegistered: function(credentials) {
        this.onLoggedIn(credentials);
        // do post-registration stuff
        // This now goes straight to user settings
        // We use _setPage since if we wait for
        // showScreen to do the dispatch loop,
        // the showScreen dispatch will race with the
        // sdk sync finishing and we'll probably see
        // the page type still unset when the MatrixClient
        // is started and show the Room Directory instead.
        //this.showScreen("view_user_settings");
        this._setPage(this.PageTypes.UserSettings);
    },

    onFinishPostRegistration: function() {
        // Don't confuse this with "PageType" which is the middle window to show
        this.setState({
            screen: undefined
        });
        this.showScreen("settings");
    },

    onVersion: function(current, latest) {
        this.setState({
            version: current,
            hasNewVersion: current !== latest
        });
    },

    updateFavicon: function(state, prevState) {
        var notifCount = 0;

        var rooms = MatrixClientPeg.get().getRooms();
        for (var i = 0; i < rooms.length; ++i) {
            if (rooms[i].hasMembershipState(MatrixClientPeg.get().credentials.userId, 'invite')) {
                notifCount++;
            } else if (rooms[i].getUnreadNotificationCount()) {
                // if we were summing unread notifs:
                // notifCount += rooms[i].getUnreadNotificationCount();
                // instead, we just count the number of rooms with notifs.
                notifCount++;
            }
        }
        try {
            // This needs to be in in a try block as it will throw
            // if there are more than 100 badge count changes in
            // its internal queue
            var bgColor = "#d00",
                notif = notifCount;

            if(state === "ERROR") {
                notif = notif || "×";
                bgColor = "#f00";
            }

            this.favicon.badge(notif, {
                bgColor: bgColor
            });
        } catch (e) {
            console.warn("Failed to set badge count: "+e.message);
        }
        document.title = `Vector ${state === "ERROR" ? " [offline]" : ""}${notifCount > 0 ? ` [${notifCount}]` : ""}`;
    },

    onUserSettingsClose: function() {
        // XXX: use browser history instead to find the previous room?
        // or maintain a this.state.pageHistory in _setPage()?
        if (this.state.currentRoom) {
            dis.dispatch({
                action: 'view_room',
                room_id: this.state.currentRoom,
            });
        }
        else {
            dis.dispatch({
                action: 'view_room_directory',
            });
        }
    },

    render: function() {
        var LeftPanel = sdk.getComponent('structures.LeftPanel');
        var RoomView = sdk.getComponent('structures.RoomView');
        var RightPanel = sdk.getComponent('structures.RightPanel');
        var UserSettings = sdk.getComponent('structures.UserSettings');
        var CreateRoom = sdk.getComponent('structures.CreateRoom');
        var RoomDirectory = sdk.getComponent('structures.RoomDirectory');
        var MatrixToolbar = sdk.getComponent('globals.MatrixToolbar');
        var GuestWarningBar = sdk.getComponent('globals.GuestWarningBar');
        var NewVersionBar = sdk.getComponent('globals.NewVersionBar');
        var ForgotPassword = sdk.getComponent('structures.login.ForgotPassword');

        // work out the HS URL prompts we should show for

        // needs to be before normal PageTypes as you are logged in technically
        if (this.state.screen == 'post_registration') {
            return (
                <PostRegistration
                    onComplete={this.onFinishPostRegistration} />
            );
        }
        else if (this.state.logged_in && this.state.ready) {
            var page_element;
            var right_panel = "";

            switch (this.state.page_type) {
                case this.PageTypes.RoomView:
                    page_element = (
                        <RoomView
                            ref="roomView"
                            roomAddress={this.state.currentRoom || this.state.currentRoomAlias}
                            eventId={this.state.initialEventId}
                            thirdPartyInvite={this.state.thirdPartyInvite}
                            oobData={this.state.roomOobData}
                            highlightedEventId={this.state.highlightedEventId}
                            eventPixelOffset={this.state.initialEventPixelOffset}
                            key={this.state.currentRoom || this.state.currentRoomAlias}
                            opacity={this.state.middleOpacity}
                            ConferenceHandler={this.props.ConferenceHandler} />
                    );
                    right_panel = <RightPanel roomId={this.state.currentRoom} collapsed={this.state.collapse_rhs} opacity={this.state.sideOpacity} />
                    break;
                case this.PageTypes.UserSettings:
                    page_element = <UserSettings onClose={this.onUserSettingsClose} version={this.state.version} brand={this.props.config.brand} />
                    right_panel = <RightPanel collapsed={this.state.collapse_rhs} opacity={this.state.sideOpacity}/>
                    break;
                case this.PageTypes.CreateRoom:
                    page_element = <CreateRoom onRoomCreated={this.onRoomCreated}/>
                    right_panel = <RightPanel collapsed={this.state.collapse_rhs} opacity={this.state.sideOpacity}/>
                    break;
                case this.PageTypes.RoomDirectory:
                    page_element = <RoomDirectory />
                    right_panel = <RightPanel collapsed={this.state.collapse_rhs} opacity={this.state.sideOpacity}/>
                    break;
            }

            var topBar;
            if (this.state.hasNewVersion) {
                topBar = <NewVersionBar />;
            }
            else if (MatrixClientPeg.get().isGuest()) {
                topBar = <GuestWarningBar />;
            }
            else if (Notifier.supportsDesktopNotifications() && !Notifier.isEnabled() && !Notifier.isToolbarHidden()) {
                topBar = <MatrixToolbar />;
            }

            var bodyClasses = "mx_MatrixChat";
            if (topBar) {
                bodyClasses += " mx_MatrixChat_toolbarShowing";
            }

            return (
                <div className="mx_MatrixChat_wrapper">
                    {topBar}
                    <div className={bodyClasses}>
                        <LeftPanel selectedRoom={this.state.currentRoom} collapsed={this.state.collapse_lhs} opacity={this.state.sideOpacity}/>
                        <main className="mx_MatrixChat_middlePanel">
                            {page_element}
                        </main>
                        {right_panel}
                    </div>
                </div>
            );
        } else if (this.state.logged_in || (!this.state.logged_in && this._autoRegisterAsGuest)) {
            var Spinner = sdk.getComponent('elements.Spinner');
            var logoutLink;
            if (this.state.logged_in) {
                logoutLink = (
                    <a href="#" className="mx_MatrixChat_splashButtons" onClick={ this.onLogoutClick }>
                    Logout
                    </a>
                );
            }
            return (
                <div className="mx_MatrixChat_splash">
                    <Spinner />
                    {logoutLink}
                </div>
            );
        } else if (this.state.screen == 'register') {
            return (
                <Registration
                    clientSecret={this.state.register_client_secret}
                    sessionId={this.state.register_session_id}
                    idSid={this.state.register_id_sid}
                    email={this.props.startingQueryParams.email}
                    username={this.state.upgradeUsername}
                    guestAccessToken={this.state.guestAccessToken}
                    defaultHsUrl={this.props.config.default_hs_url}
                    defaultIsUrl={this.props.config.default_is_url}
                    brand={this.props.config.brand}
                    customHsUrl={this.getCurrentHsUrl()}
                    customIsUrl={this.getCurrentIsUrl()}
                    registrationUrl={this.props.registrationUrl}
                    onLoggedIn={this.onRegistered}
                    onLoginClick={this.onLoginClick}
                    onRegisterClick={this.onRegisterClick}
                    onCancelClick={ this.state.guestCreds ? this.onReturnToGuestClick : null }
                    />
            );
        } else if (this.state.screen == 'forgot_password') {
            return (
                <ForgotPassword
                    defaultHsUrl={this.props.config.default_hs_url}
                    defaultIsUrl={this.props.config.default_is_url}
                    customHsUrl={this.getCurrentHsUrl()}
                    customIsUrl={this.getCurrentIsUrl()}
                    onComplete={this.onLoginClick}
                    onLoginClick={this.onLoginClick} />
            );
        } else {
            return (
                <Login
                    onLoggedIn={this.onLoggedIn}
                    onRegisterClick={this.onRegisterClick}
                    defaultHsUrl={this.props.config.default_hs_url}
                    defaultIsUrl={this.props.config.default_is_url}
                    customHsUrl={this.getCurrentHsUrl()}
                    customIsUrl={this.getCurrentIsUrl()}
                    fallbackHsUrl={this.getFallbackHsUrl()}
                    onForgotPasswordClick={this.onForgotPasswordClick}
                    onLoginAsGuestClick={this.props.enableGuest && this.props.config && this.props.config.default_hs_url ? this._registerAsGuest.bind(this, true) : undefined}
                    onCancelClick={ this.state.guestCreds ? this.onReturnToGuestClick : null }
                    />
            );
        }
    }
});
