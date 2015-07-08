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

var React = require("react");
var MatrixClientPeg = require("../../MatrixClientPeg");
var RoomListSorter = require("../../RoomListSorter");

var ComponentBroker = require('../../ComponentBroker');

var RoomTile = ComponentBroker.get("molecules/RoomTile");

module.exports = {
    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("Room", this.onRoom);
        cli.on("Room.timeline", this.onRoomTimeline);
        cli.on("Room.name", this.onRoomName);

        var rooms = this.getRoomList();
        this.setState({
            roomList: rooms,
            activityMap: {}
        });
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room", this.onRoom);
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
            MatrixClientPeg.get().removeListener("Room.name", this.onRoomName);
        }
    },

    componentWillReceiveProps: function(newProps) {
        this.state.activityMap[newProps.selectedRoom] = undefined;
        this.setState({
            activityMap: this.state.activityMap
        });
    },

    onRoom: function(room) {
        this.refreshRoomList();
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (toStartOfTimeline) return;

        var newState = {
            roomList: this.getRoomList()
        };
        if (
            room.roomId != this.props.selectedRoom &&
            ev.getSender() != MatrixClientPeg.get().credentials.userId)
        {
            var hl = 1;

            var actions = MatrixClientPeg.get().getPushActionsForEvent(ev);
            if (actions && actions.tweaks && actions.tweaks.highlight) {
                hl = 2;
            }
            if (actions.notify) {
                // obviously this won't deep copy but this shouldn't be necessary
                var amap = this.state.activityMap;
                amap[room.roomId] = Math.max(amap[room.roomId] || 0, hl);

                newState.activityMap = amap;
            }
        }
        this.setState(newState);
    },

    onRoomName: function(room) {
        this.refreshRoomList();
    },

    refreshRoomList: function() {
        var rooms = this.getRoomList();
        this.setState({
            roomList: rooms
        });
    },

    getRoomList() {
        return RoomListSorter.mostRecentFirst(MatrixClientPeg.get().getRooms());
    },

    makeRoomTiles: function() {
        var that = this;
        return this.state.roomList.map(function(room) {
            var selected = room.roomId == that.props.selectedRoom;
            return (
                <RoomTile
                    room={room}
                    key={room.roomId}
                    selected={selected}
                    unread={that.state.activityMap[room.roomId] === 1}
                    highlight={that.state.activityMap[room.roomId] === 2}
                />
            );
        });
    },
};

