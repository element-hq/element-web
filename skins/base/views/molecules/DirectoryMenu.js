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
var classNames = require('classnames');

var dis = require("../../../../src/dispatcher");

//var DirectoryMenuController = require("../../../../src/controllers/molecules/DirectoryMenuController");

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");

module.exports = React.createClass({
    displayName: 'DirectoryMenu',
    // mixins: [DirectoryMenuController],

    // FIXME: should these onClicks be in the controller instead?
    onSettingsClick: function() {
        dis.dispatch({action: 'view_user_settings'});
    },

    onCreateRoomClick: function() {
        dis.dispatch({action: 'view_create_room'});
    },

    render: function() {
        return (
            <div className="mx_DirectoryMenu">
                <div className="mx_DirectoryMenu_options">
                    <div className="mx_RoomTile" onClick={this.onCreateRoomClick}>
                        <div className="mx_RoomTile_avatar">
                            <img src="img/create-big.png" width="42" height="42"/>
                        </div>
                        <div className="mx_RoomTile_name">Create new room</div>
                    </div>
                    <div className="mx_RoomTile">
                        <div className="mx_RoomTile_avatar">
                            <img src="img/directory-big.png" width="42" height="42"/>
                        </div>
                        <div className="mx_RoomTile_name">Directory</div>
                    </div>
                    <div className="mx_RoomTile" onClick={this.onSettingsClick}>
                        <div className="mx_RoomTile_avatar">
                            <img src="img/settings-big.png" width="42" height="42"/>
                        </div>
                        <div className="mx_RoomTile_name">Settings</div>
                    </div>
                </div>
            </div>
        );
    }
});
