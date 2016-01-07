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
var sdk = require('../../index');
var MatrixTools = require('../../MatrixTools');
var linkifyMatrix = require("../../linkify-matrix");

module.exports = React.createClass({
    displayName: 'MatrixChat',

    propTypes: {
        config: React.PropTypes.object.isRequired,
        ConferenceHandler: React.PropTypes.any,
        onNewScreen: React.PropTypes.func,
        registrationUrl: React.PropTypes.string,
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
            width: 10000
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
            startingQueryParams: {}
        };
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        if (this.state.logged_in) {
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

    onAction: function(payload) {
        var roomIndexDelta = 1;

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
            case 'start_post_registration':
                this.setState({ // don't clobber logged_in status
                    screen: 'post_registration'
                });
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
                this._viewRoom(payload.room_id);
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
                this._setPage(this.PageTypes.UserSettings);
                this.notifyNewScreen('settings');
                break;
            case 'view_create_room':
                this._setPage(this.PageTypes.CreateRoom);
                this.notifyNewScreen('new');
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
        }
    },

    _setPage: function(pageType) {
        // record the scroll state if we're in a room view.
        this._updateScrollMap();

        this.setState({
            page_type: pageType,
        });
    },

    _viewRoom: function(roomId) {
        // before we switch room, record the scroll state of the current room
        this._updateScrollMap();

        this.focusComposer = true;
        var newState = {
            currentRoom: roomId,
            page_type: this.PageTypes.RoomView,
        };
        if (this.sdkReady) {
            // if the SDK is not ready yet, remember what room
            // we're supposed to be on but don't notify about
            // the new screen yet (we won't be showing it yet)
            // The normal case where this happens is navigating
            // to the room in the URL bar on page load.
            var presentedId = roomId;
            var room = MatrixClientPeg.get().getRoom(roomId);
            if (room) {
                var theAlias = MatrixTools.getCanonicalAliasForRoom(room);
                if (theAlias) presentedId = theAlias;
            }
            this.notifyNewScreen('room/'+presentedId);
            newState.ready = true;
        }
        this.setState(newState);
        if (this.scrollStateMap[roomId]) {
            var scrollState = this.scrollStateMap[roomId];
            this.refs.roomView.restoreScrollState(scrollState);
        }
    },

    // update scrollStateMap according to the current scroll state of the
    // room view.
    _updateScrollMap: function() {
        if (!this.refs.roomView) {
            return;
        }

        var roomview = this.refs.roomView;
        var state = roomview.getScrollState();
        this.scrollStateMap[roomview.props.roomId] = state;
    },

    onLoggedIn: function(credentials) {
        console.log("onLoggedIn => %s", credentials.userId);
        MatrixClientPeg.replaceUsingAccessToken(
            credentials.homeserverUrl, credentials.identityServerUrl,
            credentials.userId, credentials.accessToken
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
            if (state === "SYNCING" && prevState === "SYNCING") {
                return;
            }
            console.log("MatrixClient sync state => %s", state);
            if (state !== "PREPARED") { return; }
            self.sdkReady = true;

            if (self.starting_room_alias) {
                dis.dispatch({
                    action: 'view_room_alias',
                    room_alias: self.starting_room_alias
                });
                delete self.starting_room_alias;
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
                self.notifyNewScreen('room/'+presentedId);
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
        Notifier.start();
        UserActivity.start();
        Presence.start();
        cli.startClient({
            pendingEventOrdering: "end"
        });
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
        } else if (screen == 'token_login') {
            dis.dispatch({
                action: 'token_login',
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
        else {
            console.error("Unknown screen : %s", screen);
        }
    },

    notifyNewScreen: function(screen) {
        if (this.props.onNewScreen) {
            this.props.onNewScreen(screen);
        }
    },

    onAliasClick: function(event, alias) {
        event.preventDefault();
        dis.dispatch({action: 'view_room_alias', room_alias: alias});
    },

    onUserClick: function(event, userId) {
        event.preventDefault();
        var MemberInfo = sdk.getComponent('rooms.MemberInfo');
        var member = new Matrix.RoomMember(null, userId);
        ContextualMenu.createMenu(MemberInfo, {
            member: member,
            right: window.innerWidth - event.pageX,
            top: event.pageY
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

    onRegistered: function(credentials) {
        this.onLoggedIn(credentials);
        // do post-registration stuff
        this.showScreen("post_registration");
    },

    onFinishPostRegistration: function() {
        // Don't confuse this with "PageType" which is the middle window to show
        this.setState({
            screen: undefined
        });
        this.showScreen("settings");
    },

    onUserSettingsClose: function() {
        // XXX: use browser history instead to find the previous room?
        if (this.state.currentRoom) {
            dis.dispatch({
                action: 'view_room',
                room_id: this.state.currentRoom,
            });
        }
        else {
            dis.dispatch({
                action: 'view_indexed_room',
                roomIndex: 0,
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
                            roomId={this.state.currentRoom}
                            key={this.state.currentRoom}
                            ConferenceHandler={this.props.ConferenceHandler} />
                    );
                    right_panel = <RightPanel roomId={this.state.currentRoom} collapsed={this.state.collapse_rhs} />
                    break;
                case this.PageTypes.UserSettings:
                    page_element = <UserSettings onClose={this.onUserSettingsClose} />
                    right_panel = <RightPanel collapsed={this.state.collapse_rhs}/>
                    break;
                case this.PageTypes.CreateRoom:
                    page_element = <CreateRoom onRoomCreated={this.onRoomCreated}/>
                    right_panel = <RightPanel collapsed={this.state.collapse_rhs}/>
                    break;
                case this.PageTypes.RoomDirectory:
                    page_element = <RoomDirectory />
                    right_panel = <RightPanel collapsed={this.state.collapse_rhs}/>
                    break;
            }

            // TODO: Fix duplication here and do conditionals like we do above
            if (Notifier.supportsDesktopNotifications() && !Notifier.isEnabled() && !Notifier.isToolbarHidden()) {
                return (
                        <div className="mx_MatrixChat_wrapper">
                            <MatrixToolbar />
                            <div className="mx_MatrixChat mx_MatrixChat_toolbarShowing">
                                <LeftPanel selectedRoom={this.state.currentRoom} collapsed={this.state.collapse_lhs} />
                                <main className="mx_MatrixChat_middlePanel">
                                    {page_element}
                                </main>
                                {right_panel}
                            </div>
                        </div>
                );
            }
            else {
                return (
                        <div className="mx_MatrixChat">
                            <LeftPanel selectedRoom={this.state.currentRoom} collapsed={this.state.collapse_lhs} />
                            <main className="mx_MatrixChat_middlePanel">
                                {page_element}
                            </main>
                            {right_panel}
                        </div>
                );
            }
        } else if (this.state.logged_in) {
            var Spinner = sdk.getComponent('elements.Spinner');
            return (
                <div className="mx_MatrixChat_splash">
                    <Spinner />
                    <a href="#" className="mx_MatrixChat_splashButtons" onClick={ this.onLogoutClick }>Logout</a>
                </div>
            );
        } else if (this.state.screen == 'register') {
            return (
                <Registration
                    clientSecret={this.state.register_client_secret}
                    sessionId={this.state.register_session_id}
                    idSid={this.state.register_id_sid}
                    email={this.props.startingQueryParams.email}
                    hsUrl={this.props.config.default_hs_url}
                    isUrl={this.props.config.default_is_url}
                    registrationUrl={this.props.registrationUrl}
                    onLoggedIn={this.onRegistered}
                    onLoginClick={this.onLoginClick} />
            );
        } else {
            return (
                <Login
                    onLoggedIn={this.onLoggedIn}
                    onRegisterClick={this.onRegisterClick}
                    homeserverUrl={this.props.config.default_hs_url}
                    identityServerUrl={this.props.config.default_is_url} />
            );
        }
    }
});
