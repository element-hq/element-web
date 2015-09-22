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
var CallView = ComponentBroker.get('molecules/voip/CallView');
var RoomDropTarget = ComponentBroker.get('molecules/RoomDropTarget');

var RoomListController = require('matrix-react-sdk/lib/controllers/organisms/RoomList')

module.exports = React.createClass({
    displayName: 'RoomList',
    mixins: [RoomListController],

    render: function() {
        var callElement;
        if (this.state.show_call_element) {
            callElement = <CallView className="mx_MatrixChat_callView"/>
        }

        return (
            <div className="mx_RoomList">
                {callElement}
                <h2 className="mx_RoomList_favourites_label">Favourites</h2>
                <RoomDropTarget text="Drop here to favourite"/>

                <h2 className="mx_RoomList_recents_label">Recents</h2>
                <div className="mx_RoomList_recents">
                    {this.makeRoomTiles()}
                </div>

                <h2 className="mx_RoomList_archive_label">Archive</h2>
                <RoomDropTarget text="Drop here to archive"/>
            </div>
        );
    }
});

