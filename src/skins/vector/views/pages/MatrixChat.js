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

var React = require('react');
var sdk = require('matrix-react-sdk')

var MatrixChatController = require('matrix-react-sdk/lib/controllers/pages/MatrixChat')

var dis = require('matrix-react-sdk/lib/dispatcher');
var Matrix = require("matrix-js-sdk");

var ContextualMenu = require("../../../../ContextualMenu")
var Login = require("../../../../components/login/Login");
var Registration = require("../../../../components/login/Registration");
var config = require("../../../../../config.json");

module.exports = React.createClass({
    displayName: 'MatrixChat',
    mixins: [MatrixChatController],

    getInitialState: function() {
        return {
            width: 10000,
        }
    },

    componentDidMount: function() {
        window.addEventListener('resize', this.handleResize);
        this.handleResize();
    },

    componentWillUnmount: function() {
        window.removeEventListener('resize', this.handleResize);
    },

    onAliasClick: function(event, alias) {
        event.preventDefault();
        dis.dispatch({action: 'view_room_alias', room_alias: alias});
    },

    onUserClick: function(event, userId) {
        event.preventDefault();
        var MemberInfo = sdk.getComponent('molecules.MemberInfo');
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

    render: function() {
        var LeftPanel = sdk.getComponent('organisms.LeftPanel');
        var RoomView = sdk.getComponent('organisms.RoomView');
        var RightPanel = sdk.getComponent('organisms.RightPanel');
        var UserSettings = sdk.getComponent('organisms.UserSettings');
        var CreateRoom = sdk.getComponent('organisms.CreateRoom');
        var RoomDirectory = sdk.getComponent('organisms.RoomDirectory');
        var MatrixToolbar = sdk.getComponent('molecules.MatrixToolbar');
        var Notifier = sdk.getComponent('organisms.Notifier');

        if (this.state.logged_in && this.state.ready) {
            var page_element;
            var right_panel = "";

            switch (this.state.page_type) {
                case this.PageTypes.RoomView:
                    page_element = <RoomView roomId={this.state.currentRoom} key={this.state.currentRoom} />
                    right_panel = <RightPanel roomId={this.state.currentRoom} collapsed={this.state.collapse_rhs} />
                    break;
                case this.PageTypes.UserSettings:
                    page_element = <UserSettings />
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
            var Spinner = sdk.getComponent('atoms.Spinner');
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
                    hsUrl={config.default_hs_url}
                    isUrl={config.default_is_url}
                    registrationUrl={this.props.registrationUrl}
                    onLoggedIn={this.onLoggedIn}
                    onLoginClick={this.onLoginClick} />
            );
        } else {
            return (
                <Login
                    onLoggedIn={this.onLoggedIn}
                    onRegisterClick={this.onRegisterClick}
                    homeserverUrl={config.default_hs_url}
                    identityServerUrl={config.default_is_url} />
            );
        }
    }
});