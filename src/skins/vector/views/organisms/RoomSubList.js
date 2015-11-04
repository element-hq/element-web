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

module.exports = React.createClass({
    displayName: 'RoomSubList',

    propTypes: {
        list: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
        label: React.PropTypes.string.isRequired,
        tagname: React.PropTypes.string,
        editable: React.PropTypes.bool,
        order: React.PropTypes.string.isRequired,
        selectedRoom: React.PropTypes.string.isRequired,
        activityMap: React.PropTypes.object.isRequired,
        collapsed: React.PropTypes.bool.isRequired
    },

    getInitialState: function() {
        return {
            sortedList: [],
        };
    },

    componentWillMount: function() {
        this.sortList(this.props.list, this.props.order);
    },

    componentWillReceiveProps: function(newProps) {
        // order the room list appropriately before we re-render
        this.sortList(newProps.list, newProps.order);
    },

    tsOfNewestEvent: function(room) {
        if (room.timeline.length) {
            return room.timeline[room.timeline.length - 1].getTs();
        }
        else {
            return Number.MAX_SAFE_INTEGER;
        }
    },

    // TODO: factor the comparators back out into a generic comparator
    // so that view_prev_room and view_next_room can do the right thing

    recentsComparator: function(roomA, roomB) {
        return this.tsOfNewestEvent(roomB) - this.tsOfNewestEvent(roomA);
    },

    manualComparator: function(roomA, roomB) {
        var a = roomA.tags[this.props.tagname].order;
        var b = roomB.tags[this.props.tagname].order;
        return a == b ? this.recentsComparator(roomA, roomB) : ( a > b  ? 1 : -1);
    },

    sortList: function(list, order) {
        var comparator;
        list = list || [];
        if (order === "manual") comparator = this.manualComparator;
        if (order === "recent") comparator = this.recentsComparator;

        this.setState({ sortedList: list.sort(comparator) });
    },

    makeRoomTiles: function() {
        var self = this;
        var RoomTile = sdk.getComponent("molecules.RoomTile");
        return this.state.sortedList.map(function(room) {
            var selected = room.roomId == self.props.selectedRoom;
            return (
                <RoomTile
                    room={room}
                    key={room.roomId}
                    collapsed={self.props.collapsed}
                    selected={selected}
                    unread={self.props.activityMap[room.roomId] === 1}
                    highlight={self.props.activityMap[room.roomId] === 2}
                    isInvite={self.props.label === 'Invites'} />
            );
        });
    },

    render: function() {
        var RoomDropTarget = sdk.getComponent('molecules.RoomDropTarget');

        var label = this.props.collapsed ? null : this.props.label;

        if (this.state.sortedList.length > 0 || this.props.editable) {
            return (
                <div>
                    <h2 className="mx_RoomSubList_label">{ this.props.label }</h2>
                    <div className="mx_RoomSubList">
                        { this.makeRoomTiles() }
                    </div>
                </div>
            );
        }
        else {
            return (
                <div className="mx_RoomSubList">
                </div>
            );
        }
    }
});

