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

module.exports = React.createClass({
    displayName: 'LeftPanel',

    render: function() {
        var RoomList = sdk.getComponent('organisms.RoomList');
        var BottomLeftMenu = sdk.getComponent('molecules.BottomLeftMenu');
        var IncomingCallBox = sdk.getComponent('molecules.voip.IncomingCallBox');

        return (
            <aside className="mx_LeftPanel">
                <img className="mx_LeftPanel_hideButton" src="img/hide.png" width="32" height="32" alt="<"/>
                <IncomingCallBox />
                <RoomList selectedRoom={this.props.selectedRoom} />
                <BottomLeftMenu />
            </aside>
        );
    }
});

