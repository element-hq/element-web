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

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');
var SdkConfig = require('matrix-react-sdk/lib/SdkConfig');

module.exports = React.createClass({
    displayName: 'BottomLeftMenu',

    propTypes: {
        collapsed: React.PropTypes.bool.isRequired,
    },

    getInitialState: function() {
        return({
            directoryHover : false,
            roomsHover : false,
            homeHover: false,
            peopleHover : false,
            settingsHover : false,
        });
    },

    // Room events
    onDirectoryClick: function() {
        dis.dispatch({ action: 'view_room_directory' });
    },

    onDirectoryMouseEnter: function() {
        this.setState({ directoryHover: true });
    },

    onDirectoryMouseLeave: function() {
        this.setState({ directoryHover: false });
    },

    onRoomsClick: function() {
        dis.dispatch({ action: 'view_create_room' });
    },

    onRoomsMouseEnter: function() {
        this.setState({ roomsHover: true });
    },

    onRoomsMouseLeave: function() {
        this.setState({ roomsHover: false });
    },

    // Home button events
    onHomeClick: function() {
        dis.dispatch({ action: 'view_home_page' });
    },

    onHomeMouseEnter: function() {
        this.setState({ homeHover: true });
    },

    onHomeMouseLeave: function() {
        this.setState({ homeHover: false });
    },

    // People events
    onPeopleClick: function() {
        dis.dispatch({ action: 'view_create_chat' });
    },

    onPeopleMouseEnter: function() {
        this.setState({ peopleHover: true });
    },

    onPeopleMouseLeave: function() {
        this.setState({ peopleHover: false });
    },

    // Settings events
    onSettingsClick: function() {
        dis.dispatch({ action: 'view_user_settings' });
    },

    onSettingsMouseEnter: function() {
        this.setState({ settingsHover: true });
    },

    onSettingsMouseLeave: function() {
        this.setState({ settingsHover: false });
    },

    // Get the label/tooltip to show
    getLabel: function(label, show) {
        if (show) {
            var RoomTooltip = sdk.getComponent("rooms.RoomTooltip");
            return <RoomTooltip className="mx_BottomLeftMenu_tooltip" label={label} />;
        }
    },

    render: function() {
        var TintableSvg = sdk.getComponent('elements.TintableSvg');

        var homeButton;
        if (SdkConfig.get().home_page) {
            homeButton = (
                <div className="mx_BottomLeftMenu_homePage" onClick={ this.onHomeClick } onMouseEnter={ this.onHomeMouseEnter } onMouseLeave={ this.onHomeMouseLeave } >
                    <TintableSvg src="img/icons-home.svg" width="25" height="25" />
                    { this.getLabel("Welcome page", this.state.homeHover) }
                </div>
            );
        }

        return (
            <div className="mx_BottomLeftMenu">
                <div className="mx_BottomLeftMenu_options">
                    { homeButton }
                    <div className="mx_BottomLeftMenu_people" onClick={ this.onPeopleClick } onMouseEnter={ this.onPeopleMouseEnter } onMouseLeave={ this.onPeopleMouseLeave } >
                        <TintableSvg src="img/icons-people.svg" width="25" height="25" />
                        { this.getLabel("Start chat", this.state.peopleHover) }
                    </div>
                    <div className="mx_BottomLeftMenu_directory" onClick={ this.onDirectoryClick } onMouseEnter={ this.onDirectoryMouseEnter } onMouseLeave={ this.onDirectoryMouseLeave } >
                        <TintableSvg src="img/icons-directory.svg" width="25" height="25"/>
                        { this.getLabel("Room directory", this.state.directoryHover) }
                    </div>
                    <div className="mx_BottomLeftMenu_createRoom" onClick={ this.onRoomsClick } onMouseEnter={ this.onRoomsMouseEnter } onMouseLeave={ this.onRoomsMouseLeave } >
                        <TintableSvg src="img/icons-create-room.svg" width="25" height="25" />
                        { this.getLabel("Create new room", this.state.roomsHover) }
                    </div>
                    <div className="mx_BottomLeftMenu_settings" onClick={ this.onSettingsClick } onMouseEnter={ this.onSettingsMouseEnter } onMouseLeave={ this.onSettingsMouseLeave } >
                        <TintableSvg src="img/icons-settings.svg" width="25" height="25" />
                        { this.getLabel("Settings", this.state.settingsHover) }
                    </div>
                </div>
            </div>
        );
    }
});
