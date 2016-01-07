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
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');

module.exports = React.createClass({
    displayName: 'BottomLeftMenu',

    onSettingsClick: function() {
        dis.dispatch({action: 'view_user_settings'});
    },

    onRoomDirectoryClick: function() {
        dis.dispatch({action: 'view_room_directory'});
    },

    onCreateRoomClick: function() {
        dis.dispatch({action: 'view_create_room'});
    },

    getLabel: function(name) {
        if (!this.props.collapsed) {
            return <div className="mx_RoomTile_name">{name}</div>
        }
        else if (this.state.hover) {
            var RoomTooltip = sdk.getComponent("rooms.RoomTooltip");
            return <RoomTooltip name={name}/>;
        }
    },

    render: function() {
        var BottomLeftMenuTile = sdk.getComponent('rooms.BottomLeftMenuTile');
        return (
            <div className="mx_BottomLeftMenu">
                <div className="mx_BottomLeftMenu_options">
                    <BottomLeftMenuTile collapsed={ this.props.collapsed } img="img/create-big.png" label="Create new room" onClick={ this.onCreateRoomClick }/>
                    <BottomLeftMenuTile collapsed={ this.props.collapsed } img="img/directory-big.png" label="Directory" onClick={ this.onRoomDirectoryClick }/>
                    <BottomLeftMenuTile collapsed={ this.props.collapsed } img="img/settings-big.png" label="Settings" onClick={ this.onSettingsClick }/>
                </div>
            </div>
        );
    }
});
