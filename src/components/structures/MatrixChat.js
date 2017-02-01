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

import q from 'q';

var React = require('react');
var Matrix = require("matrix-js-sdk");

var MatrixClientPeg = require("../../MatrixClientPeg");
var PlatformPeg = require("../../PlatformPeg");
var SdkConfig = require("../../SdkConfig");
var ContextualMenu = require("./ContextualMenu");
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
var Rooms = require('../../Rooms');
var linkifyMatrix = require("../../linkify-matrix");
var Lifecycle = require('../../Lifecycle');
var PageTypes = require('../../PageTypes');

var createRoom = require("../../createRoom");

module.exports = React.createClass({
    displayName: 'MatrixChat',

    propTypes: {
        config: React.PropTypes.object,
        ConferenceHandler: React.PropTypes.any,
        onNewScreen: React.PropTypes.func,
        registrationUrl: React.PropTypes.string,
        enableGuest: React.PropTypes.bool,

        // the queryParams extracted from the [real] query-string of the URI
        realQueryParams: React.PropTypes.object,

        // the initial queryParams extracted from the hash-fragment of the URI
        startingFragmentQueryParams: React.PropTypes.object,

        // called when the session load completes
        onLoadCompleted: React.PropTypes.func,

        // displayname, if any, to set on the device when logging
        // in/registering.
        defaultDeviceDisplayName: React.PropTypes.string,
    },

    childContextTypes: {
        appConfig: React.PropTypes.object,
    },

    AuxPanel: {
        RoomSettings: "room_settings",
    },

    getChildContext: function() {
        return {
            appConfig: this.props.config,
        };
    },

    getInitialState: function() {
        var s = {
            loading: true,
            screen: undefined,

            // What the LoggedInView would be showing if visible
            page_type: null,

            // If we are viewing a room by alias, this contains the alias
            currentRoomAlias: null,

            // The ID of the room we're viewing. This is either populated directly
            // in the case where we view a room by ID or by RoomView when it resolves
            // what ID an alias points at.
            currentRoomId: null,

            // If we're trying to just view a user ID (i.e. /user URL), this is it
            viewUserId: null,

            logged_in: false,
            collapse_lhs: false,
            collapse_rhs: false,
            ready: false,
            width: 10000,
            sideOpacity: 1.0,
            middleOpacity: 1.0,

            version: null,
            newVersion: null,
            hasNewVersion: false,
            newVersionReleaseNotes: null,

            // The username to default to when upgrading an account from a guest
            upgradeUsername: null,
            // The access token we had for our guest account, used when upgrading to a normal account
            guestAccessToken: null,

            // Parameters used in the registration dance with the IS
            register_client_secret: null,
            register_session_id: null,
            register_hs_url: null,
            register_is_url: null,
            register_id_sid: null,
        };
        return s;
    },

    getDefaultProps: function() {
        return {
            realQueryParams: {},
            startingFragmentQueryParams: {},
            config: {},
            onLoadCompleted: () => {},
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
            return this.getDefaultHsUrl();
        }
    },

    getDefaultHsUrl() {
        return this.props.config.default_hs_url || "https://matrix.org";
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
            return this.getDefaultIsUrl();
        }
    },

    getDefaultIsUrl() {
        return this.props.config.default_is_url || "https://vector.im";
    },

    componentWillMount: function() {
        SdkConfig.put(this.props.config);

        // Stashed guest credentials if the user logs out
        // whilst logged in as a guest user (so they can change
        // their mind & log back in)
        this.guestCreds = null;

        // if the automatic session load failed, the error
        this.sessionLoadError = null;

        if (this.props.config.sync_timeline_limit) {
            MatrixClientPeg.opts.initialSyncLimit = this.props.config.sync_timeline_limit;
        }
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);

        this.focusComposer = false;
        window.addEventListener("focus", this.onFocus);

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

        // the extra q() ensures that synchronous exceptions hit the same codepath as
        // asynchronous ones.
        q().then(() => {
            return Lifecycle.loadSession({
                realQueryParams: this.props.realQueryParams,
                fragmentQueryParams: this.props.startingFragmentQueryParams,
                enableGuest: this.props.enableGuest,
                guestHsUrl: this.getCurrentHsUrl(),
                guestIsUrl: this.getCurrentIsUrl(),
                defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
            });
        }).catch((e) => {
            console.error("Unable to load session", e);
            this.sessionLoadError = e.message;
        }).done(()=>{
            // stuff this through the dispatcher so that it happens
            // after the on_logged_in action.
            dis.dispatch({action: 'load_completed'});
        });
    },

    componentWillUnmount: function() {
        Lifecycle.stopMatrixClient();
        dis.unregister(this.dispatcherRef);
        window.removeEventListener("focus", this.onFocus);
        window.removeEventListener('resize', this.handleResize);
    },

    componentDidUpdate: function() {
        if (this.focusComposer) {
            dis.dispatch({action: 'focus_composer'});
            this.focusComposer = false;
        }
    },

    setStateForNewScreen: function(state) {
        const newState = {
            screen: undefined,
            viewUserId: null,
            logged_in: false,
            ready: false,
            upgradeUsername: null,
            guestAccessToken: null,
       };
       Object.assign(newState, state);
       this.setState(newState);
    },

    onAction: function(payload) {
        var roomIndexDelta = 1;

        var self = this;
        switch (payload.action) {
            case 'logout':
                if (MatrixClientPeg.get().isGuest()) {
                    this.guestCreds = MatrixClientPeg.getCredentials();
                }
                Lifecycle.logout();
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
                this.setStateForNewScreen(newState);
                this.notifyNewScreen('register');
                break;
            case 'start_login':
                if (this.state.logged_in) return;
                this.setStateForNewScreen({
                    screen: 'login',
                });
                this.notifyNewScreen('login');
                break;
            case 'start_post_registration':
                this.setState({ // don't clobber logged_in status
                    screen: 'post_registration'
                });
                break;
            case 'start_upgrade_registration':
                // stash our guest creds so we can backout if needed
                this.guestCreds = MatrixClientPeg.getCredentials();
                this.setStateForNewScreen({
                    screen: "register",
                    upgradeUsername: MatrixClientPeg.get().getUserIdLocalpart(),
                    guestAccessToken: MatrixClientPeg.get().getAccessToken(),
                });
                this.notifyNewScreen('register');
                break;
            case 'start_password_recovery':
                if (this.state.logged_in) return;
                this.setStateForNewScreen({
                    screen: 'forgot_password',
                });
                this.notifyNewScreen('forgot_password');
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
                            var modal = Modal.createDialog(Loader, null, 'mx_Dialog_spinner');

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
            case 'view_user':
                // FIXME: ugly hack to expand the RightPanel and then re-dispatch.
                if (this.state.collapse_rhs) {
                    setTimeout(()=>{
                        dis.dispatch({
                            action: 'show_right_panel',
                        });
                        dis.dispatch({
                            action: 'view_user',
                            member: payload.member,
                        });
                    }, 0);
                }
                break;
            case 'view_room':
                // Takes either a room ID or room alias: if switching to a room the client is already
                // known to be in (eg. user clicks on a room in the recents panel), supply the ID
                // If the user is clicking on a room in the context of the alias being presented
                // to them, supply the room alias. If both are supplied, the room ID will be ignored.
                this._viewRoom(payload);
                break;
            case 'view_prev_room':
                roomIndexDelta = -1;
            case 'view_next_room':
                var allRooms = RoomListSorter.mostRecentActivityFirst(
                    MatrixClientPeg.get().getRooms()
                );
                var roomIndex = -1;
                for (var i = 0; i < allRooms.length; ++i) {
                    if (allRooms[i].roomId == this.state.currentRoomId) {
                        roomIndex = i;
                        break;
                    }
                }
                roomIndex = (roomIndex + roomIndexDelta) % allRooms.length;
                if (roomIndex < 0) roomIndex = allRooms.length - 1;
                this._viewRoom({ room_id: allRooms[roomIndex].roomId });
                break;
            case 'view_indexed_room':
                var allRooms = RoomListSorter.mostRecentActivityFirst(
                    MatrixClientPeg.get().getRooms()
                );
                var roomIndex = payload.roomIndex;
                if (allRooms[roomIndex]) {
                    this._viewRoom({ room_id: allRooms[roomIndex].roomId });
                }
                break;
            case 'view_user_settings':
                this._setPage(PageTypes.UserSettings);
                this.notifyNewScreen('settings');
                break;
            case 'view_create_room':
                //this._setPage(PageTypes.CreateRoom);
                //this.notifyNewScreen('new');

                var TextInputDialog = sdk.getComponent("dialogs.TextInputDialog");
                Modal.createDialog(TextInputDialog, {
                    title: "Create Room",
                    description: "Room name (optional)",
                    button: "Create Room",
                    onFinished: (should_create, name) => {
                        if (should_create) {
                            const createOpts = {};
                            if (name) createOpts.name = name;
                            createRoom({createOpts}).done();
                        }
                    }
                });
                break;
            case 'view_room_directory':
                this._setPage(PageTypes.RoomDirectory);
                this.notifyNewScreen('directory');
                break;
            case 'view_create_chat':
                this._createChat();
                break;
            case 'view_invite':
                this._invite(payload.roomId);
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
            case 'set_theme':
                this._onSetTheme(payload.value);
                break;
            case 'on_logged_in':
                this._onLoggedIn();
                break;
            case 'on_logged_out':
                this._onLoggedOut();
                break;
            case 'will_start_client':
                this._onWillStartClient();
                break;
            case 'load_completed':
                this._onLoadCompleted();
                break;
            case 'new_version':
                this.onVersion(
                    payload.currentVersion, payload.newVersion,
                    payload.releaseNotes
                );
                break;
        }
    },

    _setPage: function(pageType) {
        this.setState({
            page_type: pageType,
        });
    },

    // switch view to the given room
    //
    // @param {Object} room_info Object containing data about the room to be joined
    // @param {string=} room_info.room_id ID of the room to join. One of room_id or room_alias must be given.
    // @param {string=} room_info.room_alias Alias of the room to join. One of room_id or room_alias must be given.
    // @param {boolean=} room_info.auto_join If true, automatically attempt to join the room if not already a member.
    // @param {boolean=} room_info.show_settings Makes RoomView show the room settings dialog.
    // @param {string=} room_info.event_id ID of the event in this room to show: this will cause a switch to the
    //                                    context of that particular event.
    // @param {Object=} room_info.third_party_invite Object containing data about the third party
    //                                    we received to join the room, if any.
    // @param {string=} room_info.third_party_invite.inviteSignUrl 3pid invite sign URL
    // @param {string=} room_info.third_party_invite.invitedEmail The email address the invite was sent to
    // @param {Object=} room_info.oob_data Object of additional data about the room
    //                               that has been passed out-of-band (eg.
    //                               room name and avatar from an invite email)
    _viewRoom: function(room_info) {
        this.focusComposer = true;

        var newState = {
            initialEventId: room_info.event_id,
            highlightedEventId: room_info.event_id,
            initialEventPixelOffset: undefined,
            page_type: PageTypes.RoomView,
            thirdPartyInvite: room_info.third_party_invite,
            roomOobData: room_info.oob_data,
            currentRoomAlias: room_info.room_alias,
            autoJoin: room_info.auto_join,
        };

        if (!room_info.room_alias) {
            newState.currentRoomId = room_info.room_id;
        }

        // if we aren't given an explicit event id, look for one in the
        // scrollStateMap.
        //
        // TODO: do this in RoomView rather than here
        if (!room_info.event_id && this.refs.loggedInView) {
            var scrollState = this.refs.loggedInView.getScrollStateForRoom(room_info.room_id);
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
            var presentedId = room_info.room_alias || room_info.room_id;
            var room = MatrixClientPeg.get().getRoom(room_info.room_id);
            if (room) {
                var theAlias = Rooms.getDisplayAliasForRoom(room);
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

            if (room_info.event_id) {
                presentedId += "/"+room_info.event_id;
            }
            this.notifyNewScreen('room/'+presentedId);
            newState.ready = true;
        }
        this.setState(newState);
    },

    _createChat: function() {
        var ChatInviteDialog = sdk.getComponent("dialogs.ChatInviteDialog");
        Modal.createDialog(ChatInviteDialog, {
            title: "Start a new chat",
        });
    },

    _invite: function(roomId) {
        var ChatInviteDialog = sdk.getComponent("dialogs.ChatInviteDialog");
        Modal.createDialog(ChatInviteDialog, {
            title: "Invite new room members",
            button: "Send Invites",
            description: "Who would you like to add to this room?",
            roomId: roomId,
        });
    },

    /**
     * Called when the sessionloader has finished
     */
    _onLoadCompleted: function() {
        this.props.onLoadCompleted();
        this.setState({loading: false});
    },

    /**
     * Called whenever someone changes the theme
     */
    _onSetTheme: function(theme) {
        if (!theme) {
            theme = 'light';
        }

        // look for the stylesheet elements.
        // styleElements is a map from style name to HTMLLinkElement.
        var styleElements = Object.create(null);
        var i, a;
        for (i = 0; (a = document.getElementsByTagName("link")[i]); i++) {
            var href = a.getAttribute("href");
            // shouldn't we be using the 'title' tag rather than the href?
            var match = href.match(/^bundles\/.*\/theme-(.*)\.css$/);
            if (match) {
                styleElements[match[1]] = a;
            }
        }

        if (!(theme in styleElements)) {
            throw new Error("Unknown theme " + theme);
        }

        // disable all of them first, then enable the one we want. Chrome only
        // bothers to do an update on a true->false transition, so this ensures
        // that we get exactly one update, at the right time.

        Object.values(styleElements).forEach((a) => {
            a.disabled = true;
        });
        styleElements[theme].disabled = false;

        if (theme === 'dark') {
            // abuse the tinter to change all the SVG's #fff to #2d2d2d
            // XXX: obviously this shouldn't be hardcoded here.
            Tinter.tintSvgWhite('#2d2d2d');
        }
        else {
            Tinter.tintSvgWhite('#ffffff');
        }
    },

    /**
     * Called when a new logged in session has started
     */
    _onLoggedIn: function(credentials) {
        this.guestCreds = null;
        this.notifyNewScreen('');
        this.setState({
            screen: undefined,
            logged_in: true,
        });
    },

    /**
     * Called when the session is logged out
     */
    _onLoggedOut: function() {
        this.notifyNewScreen('login');
        this.setStateForNewScreen({
            logged_in: false,
            ready: false,
            collapse_lhs: false,
            collapse_rhs: false,
            currentRoomAlias: null,
            currentRoomId: null,
            page_type: PageTypes.RoomDirectory,
        });
    },

    /**
     * Called just before the matrix client is started
     * (useful for setting listeners)
     */
    _onWillStartClient() {
        var cli = MatrixClientPeg.get();

        var self = this;
        cli.on('sync', function(state, prevState) {
            self.updateStatusIndicator(state, prevState);
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
                if (!self.state.currentRoomId) {
                    var firstRoom = null;
                    if (cli.getRooms() && cli.getRooms().length) {
                        firstRoom = RoomListSorter.mostRecentActivityFirst(
                            cli.getRooms()
                        )[0].roomId;
                        self.setState({ready: true, currentRoomId: firstRoom, page_type: PageTypes.RoomView});
                    } else {
                        self.setState({ready: true, page_type: PageTypes.RoomDirectory});
                    }
                } else {
                    self.setState({ready: true, page_type: PageTypes.RoomView});
                }

                // we notifyNewScreen now because now the room will actually be displayed,
                // and (mostly) now we can get the correct alias.
                var presentedId = self.state.currentRoomId;
                var room = MatrixClientPeg.get().getRoom(self.state.currentRoomId);
                if (room) {
                    var theAlias = Rooms.getDisplayAliasForRoom(room);
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
                title: "Signed Out",
                description: "For security, this session has been signed out. Please sign in again."
            });
            dis.dispatch({
                action: 'logout'
            });
        });
        cli.on("accountData", function(ev) {
            if (ev.getType() === 'im.vector.web.settings') {
                if (ev.getContent() && ev.getContent().theme) {
                    dis.dispatch({
                        action: 'set_theme',
                        value: ev.getContent().theme,
                    });
                }
            }
        });
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
                // we may still be loading (ie, trying to register a guest
                // session); otherwise we're (probably) already showing a login
                // screen. Either way, we'll show the room once the client starts.
                this.starting_room_alias_payload = payload;
            } else {
                dis.dispatch(payload);
            }
        } else if (screen.indexOf('user/') == 0) {
            var userId = screen.substring(5);
            this.setState({ viewUserId: userId });
            this._setPage(PageTypes.UserView);
            this.notifyNewScreen('user/' + userId);
            var member = new Matrix.RoomMember(null, userId);
            if (member) {
                dis.dispatch({
                    action: 'view_user',
                    member: member,
                });
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

        // var MemberInfo = sdk.getComponent('rooms.MemberInfo');
        // var member = new Matrix.RoomMember(null, userId);
        // ContextualMenu.createMenu(MemberInfo, {
        //     member: member,
        //     right: window.innerWidth - event.pageX,
        //     top: event.pageY
        // });

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
        if (this.guestCreds) {
            Lifecycle.setLoggedIn(this.guestCreds);
            this.guestCreds = null;
        }
    },

    onRegistered: function(credentials) {
        Lifecycle.setLoggedIn(credentials);
        // do post-registration stuff
        // This now goes straight to user settings
        // We use _setPage since if we wait for
        // showScreen to do the dispatch loop,
        // the showScreen dispatch will race with the
        // sdk sync finishing and we'll probably see
        // the page type still unset when the MatrixClient
        // is started and show the Room Directory instead.
        //this.showScreen("view_user_settings");
        this._setPage(PageTypes.UserSettings);
    },

    onFinishPostRegistration: function() {
        // Don't confuse this with "PageType" which is the middle window to show
        this.setState({
            screen: undefined
        });
        this.showScreen("settings");
    },

    onVersion: function(current, latest, releaseNotes) {
        this.setState({
            version: current,
            newVersion: latest,
            hasNewVersion: current !== latest,
            newVersionReleaseNotes: releaseNotes,
        });
    },

    updateStatusIndicator: function(state, prevState) {
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

        if (PlatformPeg.get()) {
            PlatformPeg.get().setErrorStatus(state === 'ERROR');
            PlatformPeg.get().setNotificationCount(notifCount);
        }

        document.title = `Riot ${state === "ERROR" ? " [offline]" : ""}${notifCount > 0 ? ` [${notifCount}]` : ""}`;
    },

    onUserSettingsClose: function() {
        // XXX: use browser history instead to find the previous room?
        // or maintain a this.state.pageHistory in _setPage()?
        if (this.state.currentRoomId) {
            dis.dispatch({
                action: 'view_room',
                room_id: this.state.currentRoomId,
            });
        }
        else {
            dis.dispatch({
                action: 'view_room_directory',
            });
        }
    },

    onRoomIdResolved: function(room_id) {
        // It's the RoomView's resposibility to look up room aliases, but we need the
        // ID to pass into things like the Member List, so the Room View tells us when
        // its done that resolution so we can display things that take a room ID.
        this.setState({currentRoomId: room_id});
    },

    render: function() {
        var ForgotPassword = sdk.getComponent('structures.login.ForgotPassword');
        var LoggedInView = sdk.getComponent('structures.LoggedInView');

        // console.log("rendering; loading="+this.state.loading+"; screen="+this.state.screen +
        //             "; logged_in="+this.state.logged_in+"; ready="+this.state.ready);

        if (this.state.loading) {
            var Spinner = sdk.getComponent('elements.Spinner');
            return (
                <div className="mx_MatrixChat_splash">
                    <Spinner />
                </div>
            );
        }
        // needs to be before normal PageTypes as you are logged in technically
        else if (this.state.screen == 'post_registration') {
            return (
                <PostRegistration
                    onComplete={this.onFinishPostRegistration} />
            );
        } else if (this.state.logged_in && this.state.ready) {
            /* for now, we stuff the entirety of our props and state into the LoggedInView.
             * we should go through and figure out what we actually need to pass down, as well
             * as using something like redux to avoid having a billion bits of state kicking around.
             */
            return (
               <LoggedInView ref="loggedInView" matrixClient={MatrixClientPeg.get()}
                    onRoomIdResolved={this.onRoomIdResolved}
                    onRoomCreated={this.onRoomCreated}
                    onUserSettingsClose={this.onUserSettingsClose}
                    {...this.props}
                    {...this.state}
                />
            );
        } else if (this.state.logged_in) {
            // we think we are logged in, but are still waiting for the /sync to complete
            var Spinner = sdk.getComponent('elements.Spinner');
            return (
                <div className="mx_MatrixChat_splash">
                    <Spinner />
                    <a href="#" className="mx_MatrixChat_splashButtons" onClick={ this.onLogoutClick }>
                    Logout
                    </a>
                </div>
            );
        } else if (this.state.screen == 'register') {
            return (
                <Registration
                    clientSecret={this.state.register_client_secret}
                    sessionId={this.state.register_session_id}
                    idSid={this.state.register_id_sid}
                    email={this.props.startingFragmentQueryParams.email}
                    referrer={this.props.startingFragmentQueryParams.referrer}
                    username={this.state.upgradeUsername}
                    guestAccessToken={this.state.guestAccessToken}
                    defaultHsUrl={this.getDefaultHsUrl()}
                    defaultIsUrl={this.getDefaultIsUrl()}
                    brand={this.props.config.brand}
                    teamServerConfig={this.props.config.teamServerConfig}
                    customHsUrl={this.getCurrentHsUrl()}
                    customIsUrl={this.getCurrentIsUrl()}
                    registrationUrl={this.props.registrationUrl}
                    defaultDeviceDisplayName={this.props.defaultDeviceDisplayName}
                    onLoggedIn={this.onRegistered}
                    onLoginClick={this.onLoginClick}
                    onRegisterClick={this.onRegisterClick}
                    onCancelClick={this.guestCreds ? this.onReturnToGuestClick : null}
                    />
            );
        } else if (this.state.screen == 'forgot_password') {
            return (
                <ForgotPassword
                    defaultHsUrl={this.getDefaultHsUrl()}
                    defaultIsUrl={this.getDefaultIsUrl()}
                    customHsUrl={this.getCurrentHsUrl()}
                    customIsUrl={this.getCurrentIsUrl()}
                    onComplete={this.onLoginClick}
                    onRegisterClick={this.onRegisterClick}
                    onLoginClick={this.onLoginClick} />
            );
        } else {
            var r = (
                <Login
                    onLoggedIn={Lifecycle.setLoggedIn}
                    onRegisterClick={this.onRegisterClick}
                    defaultHsUrl={this.getDefaultHsUrl()}
                    defaultIsUrl={this.getDefaultIsUrl()}
                    customHsUrl={this.getCurrentHsUrl()}
                    customIsUrl={this.getCurrentIsUrl()}
                    fallbackHsUrl={this.getFallbackHsUrl()}
                    defaultDeviceDisplayName={this.props.defaultDeviceDisplayName}
                    onForgotPasswordClick={this.onForgotPasswordClick}
                    enableGuest={this.props.enableGuest}
                    onCancelClick={this.guestCreds ? this.onReturnToGuestClick : null}
                    initialErrorText={this.sessionLoadError}
                />
            );

            // we only want to show the session load error the first time the
            // Login component is rendered. This is pretty hacky but I can't
            // think of another way to achieve it.
            this.sessionLoadError = null;

            return r;
        }
    }
});
