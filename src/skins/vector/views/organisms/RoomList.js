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
var dis = require('matrix-react-sdk/lib/dispatcher');

var RoomListController = require('../../../../controllers/organisms/RoomList')

module.exports = React.createClass({
    displayName: 'RoomList',
    mixins: [RoomListController],

    onShowClick: function() {
        dis.dispatch({
            action: 'show_left_panel',
        });
    },

    render: function() {
        var CallView = sdk.getComponent('molecules.voip.CallView');
        var RoomDropTarget = sdk.getComponent('molecules.RoomDropTarget');

        var callElement;
        if (this.state.show_call_element) {
            callElement = <CallView className="mx_MatrixChat_callView"/>
        }

        var expandButton = this.props.collapsed ? 
                           <img className="mx_RoomList_expandButton" onClick={ this.onShowClick } src="img/menu.png" width="20" alt=">"/> :
                           null;

        var invitesLabel = this.props.collapsed ? null : "Invites";
        var recentsLabel = this.props.collapsed ? null : "Recent";

        var invites;
        if (this.state.inviteList.length) {
            invites = <div>
                        <h2 className="mx_RoomList_invitesLabel">{ invitesLabel }</h2>
                        <div className="mx_RoomList_invites">
                            {this.makeRoomTiles(this.state.inviteList, true)}
                        </div>
                      </div>
        }

        return (
            <div className="mx_RoomList" onScroll={this._repositionTooltip}>
                { expandButton }
                { callElement }
                <h2 className="mx_RoomList_favouritesLabel">Favourites</h2>
                <RoomDropTarget text="Drop here to favourite"/>

                { invites }

                <h2 className="mx_RoomList_recentsLabel">{ recentsLabel }</h2>
                <div className="mx_RoomList_recents">
                    {this.makeRoomTiles(this.state.roomList, false)}
                </div>

                <h2 className="mx_RoomList_archiveLabel">Archive</h2>
                <RoomDropTarget text="Drop here to archive"/>
            </div>
        );
    }
});

