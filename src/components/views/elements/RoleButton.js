/*
Copyright 2017 Vector Creations Ltd

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
import PropTypes from 'prop-types';
import AccessibleButton from './AccessibleButton';
import dis from '../../../dispatcher';
import sdk from '../../../index';

export default React.createClass({
    displayName: 'RoleButton',

    propTypes: {
        role: PropTypes.string.isRequired,
        size: PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            size: 25,
            tooltip: false,
        };
    },

    getInitialState: function() {
        return {
            showTooltip: false,
        };
    },

    _onClick: function(ev) {
        ev.stopPropagation();

        let action;
        switch(this.props.role) {
            case 'start_chat':
                action = 'view_create_chat';
                break;
            case 'room_directory':
                action = 'view_room_directory';
                break;
            case 'create_room':
                action = 'view_create_room';
                break;
            case 'home_page':
                action = 'view_home_page';
                break;
            case 'settings':
                action = 'view_user_settings';
                break;
        }
        if (action) dis.dispatch({action: action});
    },

    _onMouseEnter: function() {
        if (this.props.tooltip) this.setState({showTooltip: true});
    },

    _onMouseLeave: function() {
        this.setState({showTooltip: false});
    },

    _getLabel() {
        switch(this.props.role) {
            case 'start_chat':
                return 'Start chat';
            case 'room_directory':
                return 'Room directory';
            case 'create_room':
                return 'Create new room';
            case 'home_page':
                return 'Welcome page';
            case 'settings':
                return 'Settings';
        }
    },

    _getIconPath() {
        switch(this.props.role) {
            case 'start_chat':
                return 'img/icons-people.svg';
            case 'room_directory':
                return 'img/icons-directory.svg';
            case 'create_room':
                return 'img/icons-create-room.svg';
            case 'home_page':
                return 'img/icons-home.svg';
            case 'settings':
                return 'img/icons-settings.svg';
        }
    },

    render: function() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        let tooltip;
        if (this.state.showTooltip) {
            const RoomTooltip = sdk.getComponent("rooms.RoomTooltip");
            tooltip = <RoomTooltip className="mx_RoleButton_tooltip" label={this._getLabel()} />;
        }

        return (
            <AccessibleButton className="mx_RoleButton"
                onClick={this._onClick}
                onMouseEnter={this._onMouseEnter}
                onMouseLeave={this._onMouseLeave}
            >
                <TintableSvg src={this._getIconPath()} width={this.props.size} height={this.props.size} />
                {tooltip}
            </AccessibleButton>
        );
    }
});
