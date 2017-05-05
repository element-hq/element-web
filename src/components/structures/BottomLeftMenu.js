/*
Copyright 2015, 2016 OpenMarket Ltd
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
import sdk from 'matrix-react-sdk';

module.exports = React.createClass({
    displayName: 'BottomLeftMenu',

    propTypes: {
        collapsed: React.PropTypes.bool.isRequired,
    },

    render: function() {
        const HomeButton = sdk.getComponent('elements.HomeButton');
        const StartChatButton = sdk.getComponent('elements.StartChatButton');
        const RoomDirectoryButton = sdk.getComponent('elements.RoomDirectoryButton');
        const CreateRoomButton = sdk.getComponent('elements.CreateRoomButton');
        const SettingsButton = sdk.getComponent('elements.SettingsButton');

        var homeButton;
        if (this.props.teamToken) {
            homeButton = <HomeButton tooltip={true} />;
        }

        return (
            <div className="mx_BottomLeftMenu">
                <div className="mx_BottomLeftMenu_options">
                    { homeButton }
                    <StartChatButton tooltip={true} />
                    <RoomDirectoryButton tooltip={true} />
                    <CreateRoomButton tooltip={true} />
                    <span className="mx_BottomLeftMenu_settings">
                        <SettingsButton tooltip={true} />
                    </span>
                </div>
            </div>
        );
    }
});
