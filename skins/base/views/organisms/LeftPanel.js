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

var RoomList = ComponentBroker.get('organisms/RoomList');
var DirectoryMenu = ComponentBroker.get('molecules/DirectoryMenu');
var IncomingCallBox = ComponentBroker.get('molecules/voip/IncomingCallBox');
var RoomCreate = ComponentBroker.get('molecules/RoomCreate');

module.exports = React.createClass({
    displayName: 'LeftPanel',

    render: function() {
        return (
            <div className="mx_LeftPanel">
                <img className="mx_LeftPanel_hideButton" src="img/hide.png" width="32" height="32" alt="<"/>
                <IncomingCallBox />
                <RoomList selectedRoom={this.props.currentRoom} />
                <DirectoryMenu />
            </div>
        );
    }
});

