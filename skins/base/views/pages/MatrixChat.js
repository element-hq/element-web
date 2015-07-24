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
var ComponentBroker = require('../../../../src/ComponentBroker');

var LeftPanel = ComponentBroker.get('organisms/LeftPanel');
var RoomView = ComponentBroker.get('organisms/RoomView');
var RightPanel = ComponentBroker.get('organisms/RightPanel');
var Login = ComponentBroker.get('templates/Login');
var UserSettings = ComponentBroker.get('organisms/UserSettings');
var Register = ComponentBroker.get('templates/Register');
var CreateRoom = ComponentBroker.get('organisms/CreateRoom');
var RoomDirectory = ComponentBroker.get('organisms/RoomDirectory');
var MatrixToolbar = ComponentBroker.get('molecules/MatrixToolbar');
var Notifier = ComponentBroker.get('organisms/Notifier');

var MatrixChatController = require("../../../../src/controllers/pages/MatrixChat");

// should be atomised
var Loader = require("react-loader");
var classNames = require("classnames");

var dis = require("../../../../src/dispatcher");


module.exports = React.createClass({
    displayName: 'MatrixChat',
    mixins: [MatrixChatController],

    onRoomCreated: function(room_id) {
        dis.dispatch({
            action: "view_room",
            room_id: room_id,
        });
    },

    render: function() {
        if (this.state.logged_in && this.state.ready) {

            var page_element;
            var right_panel = "";

            switch (this.state.page_type) {
                case this.PageTypes.RoomView:
                    page_element = <RoomView roomId={this.state.currentRoom} key={this.state.currentRoom} />
                    right_panel = <RightPanel roomId={this.state.currentRoom} />
                    break;
                case this.PageTypes.UserSettings:
                    page_element = <UserSettings />
                    right_panel = <RightPanel/>
                    break;
                case this.PageTypes.CreateRoom:
                    page_element = <CreateRoom onRoomCreated={this.onRoomCreated}/>
                    right_panel = <RightPanel/>
                    break;
                case this.PageTypes.RoomDirectory:
                    page_element = <RoomDirectory />
                    right_panel = <RightPanel/>
                    break;
            }

            if (Notifier.supportsDesktopNotifications() && !Notifier.isEnabled()) {
                return (
                        <div className="mx_MatrixChat_wrapper">
                            <MatrixToolbar />
                            <div className="mx_MatrixChat mx_MatrixChat_toolbarShowing">
                                <LeftPanel selectedRoom={this.state.currentRoom} />
                                <div className="mx_MatrixChat_middlePanel">
                                    {page_element}
                                </div>
                                {right_panel}
                            </div>
                        </div>
                );
            }
            else {
                return (
                        <div className="mx_MatrixChat">
                            <LeftPanel selectedRoom={this.state.currentRoom} />
                            <div className="mx_MatrixChat_middlePanel">
                                {page_element}
                            </div>
                            {right_panel}
                        </div>
                );
            }
        } else if (this.state.logged_in) {
            return (
                <Loader />
            );
        } else if (this.state.screen == 'register') {
            return (
                <Register onLoggedIn={this.onLoggedIn} clientSecret={this.state.register_client_secret}
                    sessionId={this.state.register_session_id} idSid={this.state.register_id_sid}
                    hsUrl={this.state.register_hs_url} isUrl={this.state.register_is_url}
                    registrationUrl={this.props.registrationUrl}
                />
            );
        } else {
            return (
                <Login onLoggedIn={this.onLoggedIn} />
            );
        }
    }
});
