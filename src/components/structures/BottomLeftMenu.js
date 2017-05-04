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
import sdk from 'matrix-react-sdk';

module.exports = React.createClass({
    displayName: 'BottomLeftMenu',

    propTypes: {
        collapsed: React.PropTypes.bool.isRequired,
        teamToken: React.PropTypes.string,
    },

    render: function() {
        const RoleButton = sdk.getComponent('elements.RoleButton');

        var homeButton;
        if (this.props.teamToken) {
            homeButton = <RoleButton role='home_page' tooltip={true} />;
        }

        return (
            <div className="mx_BottomLeftMenu">
                <div className="mx_BottomLeftMenu_options">
                    { homeButton }
                    <RoleButton role='start_chat' tooltip={true} />
                    <RoleButton role='room_directory' tooltip={true} />
                    <RoleButton role='create_room' tooltip={true} />
                    <span className="mx_BottomLeftMenu_settings">
                        <RoleButton role='settings' tooltip={true} />
                    </span>
                </div>
            </div>
        );
    }
});
