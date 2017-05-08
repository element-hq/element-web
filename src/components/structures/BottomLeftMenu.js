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

import React from 'react';
import ReactDOM from 'react-dom';
import sdk from 'matrix-react-sdk';
import dis from 'matrix-react-sdk/lib/dispatcher';
import AccessibleButton from 'matrix-react-sdk/lib/components/views/elements/AccessibleButton';
import Velocity from 'velocity-vector';
import 'velocity-vector/velocity.ui';

const CALLOUT_ANIM_DURATION = 1000;

module.exports = React.createClass({
    displayName: 'BottomLeftMenu',

    propTypes: {
        collapsed: React.PropTypes.bool.isRequired,
        teamToken: React.PropTypes.string,
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

    componentWillMount: function() {
        this._dispatcherRef = dis.register(this.onAction);
        this._peopleButton = null;
        this._directoryButton = null;
        this._createRoomButton = null;
        this._lastCallouts = {};
    },

    componentWillUnmount: function() {
        dis.unregister(this._dispatcherRef);
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

    onAction: function(payload) {
        let calloutElement;
        switch (payload.action) {
            // Incoming instruction: dance!
            case 'callout_start_chat':
                calloutElement = this._peopleButton;
                break;
            case 'callout_room_directory':
                calloutElement = this._directoryButton;
                break;
            case 'callout_create_room':
                calloutElement = this._createRoomButton;
                break;
        }
        if (calloutElement) {
            const lastCallout = this._lastCallouts[payload.action];
            const now = Date.now();
            if (lastCallout == undefined || lastCallout < now - CALLOUT_ANIM_DURATION) {
                this._lastCallouts[payload.action] = now;
                Velocity(ReactDOM.findDOMNode(calloutElement), "callout.bounce", CALLOUT_ANIM_DURATION);
            }
        }
    },

    // Get the label/tooltip to show
    getLabel: function(label, show) {
        if (show) {
            var RoomTooltip = sdk.getComponent("rooms.RoomTooltip");
            return <RoomTooltip className="mx_BottomLeftMenu_tooltip" label={label} />;
        }
    },

    _collectPeopleButton: function(e) {
        this._peopleButton = e;
    },

    _collectDirectoryButton: function(e) {
        this._directoryButton = e;
    },

    _collectCreateRoomButton: function(e) {
        this._createRoomButton = e;
    },

    render: function() {
        var TintableSvg = sdk.getComponent('elements.TintableSvg');

        var homeButton;
        if (this.props.teamToken) {
            homeButton = (
                <AccessibleButton className="mx_BottomLeftMenu_homePage" onClick={ this.onHomeClick } onMouseEnter={ this.onHomeMouseEnter } onMouseLeave={ this.onHomeMouseLeave } >
                    <TintableSvg src="img/icons-home.svg" width="25" height="25" />
                    { this.getLabel("Welcome page", this.state.homeHover) }
                </AccessibleButton>
            );
        }

        return (
            <div className="mx_BottomLeftMenu">
                <div className="mx_BottomLeftMenu_options">
                    { homeButton }
                    <AccessibleButton className="mx_BottomLeftMenu_people" onClick={ this.onPeopleClick } onMouseEnter={ this.onPeopleMouseEnter } onMouseLeave={ this.onPeopleMouseLeave } >
                        <TintableSvg ref={this._collectPeopleButton} src="img/icons-people.svg" width="25" height="25" />
                        { this.getLabel("Start chat", this.state.peopleHover) }
                    </AccessibleButton>
                    <AccessibleButton className="mx_BottomLeftMenu_directory" onClick={ this.onDirectoryClick } onMouseEnter={ this.onDirectoryMouseEnter } onMouseLeave={ this.onDirectoryMouseLeave } >
                        <TintableSvg ref={this._collectDirectoryButton} src="img/icons-directory.svg" width="25" height="25"/>
                        { this.getLabel("Room directory", this.state.directoryHover) }
                    </AccessibleButton>
                    <AccessibleButton className="mx_BottomLeftMenu_createRoom" onClick={ this.onRoomsClick } onMouseEnter={ this.onRoomsMouseEnter } onMouseLeave={ this.onRoomsMouseLeave } >
                        <TintableSvg ref={this._collectCreateRoomButton} src="img/icons-create-room.svg" width="25" height="25" />
                        { this.getLabel("Create new room", this.state.roomsHover) }
                    </AccessibleButton>
                    <AccessibleButton className="mx_BottomLeftMenu_settings" onClick={ this.onSettingsClick } onMouseEnter={ this.onSettingsMouseEnter } onMouseLeave={ this.onSettingsMouseLeave } >
                        <TintableSvg src="img/icons-settings.svg" width="25" height="25" />
                        { this.getLabel("Settings", this.state.settingsHover) }
                    </AccessibleButton>
                </div>
            </div>
        );
    }
});
