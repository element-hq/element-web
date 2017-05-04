/*
Copyright Vector Creations Ltd

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
        }
        if (action) dis.dispatch({action: action});
    },

    _getIconPath() {
        switch(this.props.role) {
            case 'start_chat':
                return 'img/icons-people.svg';
            case 'room_directory':
                return 'img/icons-directory.svg';
            case 'create_room':
                return 'img/icons-create-room.svg';
        }
    },

    render: function() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        return (
            <AccessibleButton className="mx_RoleButton" onClick={ this._onClick }>
                <TintableSvg src={this._getIconPath()} width={this.props.size} height={this.props.size} />
            </AccessibleButton>
        );
    }
});
