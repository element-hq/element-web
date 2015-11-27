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
var DropTarget = require('react-dnd').DropTarget;
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');

// turn this on for drop & drag console debugging galore
var debug = false;

var roomListTarget = {
    canDrop: function() {
        return true;
    },

    drop: function(props, monitor, component) {
        if (debug) console.log("dropped on sublist")
    },

    hover: function(props, monitor, component) {
        var item = monitor.getItem();

        if (component.state.sortedList.length == 0 && props.editable) {
            if (debug) console.log("hovering on sublist " + props.label + ", isOver=" + monitor.isOver());

            if (item.targetList !== component) {
                 item.targetList.removeRoomTile(item.room);
                 item.targetList = component;
            }

            component.moveRoomTile(item.room, 0);
        }
    },
};

var RoomSubList = React.createClass({
    displayName: 'RoomSubList',

    debug: debug,

    propTypes: {
        list: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
        label: React.PropTypes.string.isRequired,
        tagName: React.PropTypes.string,
        editable: React.PropTypes.bool,
        order: React.PropTypes.string.isRequired,
        bottommost: React.PropTypes.bool,
        selectedRoom: React.PropTypes.string.isRequired,
        activityMap: React.PropTypes.object.isRequired,
        collapsed: React.PropTypes.bool.isRequired
    },

    getInitialState: function() {
        return {
            hidden: false,
            sortedList: [],
        };
    },

    componentWillMount: function() {
        this.sortList(this.props.list, this.props.order);
    },

    componentWillReceiveProps: function(newProps) {
        // order the room list appropriately before we re-render
        //if (debug) console.log("received new props, list = " + newProps.list);
        this.sortList(newProps.list, newProps.order);
    },

    onClick: function(ev) {
        this.setState({ hidden : !this.state.hidden });
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
        if (!roomA.tags[this.props.tagName] || !roomB.tags[this.props.tagName]) return 0;
        var a = roomA.tags[this.props.tagName].order;
        var b = roomB.tags[this.props.tagName].order;
        return a == b ? this.recentsComparator(roomA, roomB) : ( a > b  ? 1 : -1);
    },

    sortList: function(list, order) {
        if (list === undefined) list = this.state.sortedList;
        if (order === undefined) order = this.props.order;
        var comparator;
        list = list || [];
        if (order === "manual") comparator = this.manualComparator;
        if (order === "recent") comparator = this.recentsComparator;

        //if (debug) console.log("sorting list for sublist " + this.props.label + " with length " + list.length + ", this.props.list = " + this.props.list);
        this.setState({ sortedList: list.sort(comparator) });
    },

    moveRoomTile: function(room, atIndex) {
        if (debug) console.log("moveRoomTile: id " + room.roomId + ", atIndex " + atIndex);
        //console.log("moveRoomTile before: " + JSON.stringify(this.state.rooms));
        var found = this.findRoomTile(room);
        var rooms = this.state.sortedList;
        if (found.room) {
            if (debug) console.log("removing at index " + found.index + " and adding at index " + atIndex);
            rooms.splice(found.index, 1);
            rooms.splice(atIndex, 0, found.room);
        }
        else {
            if (debug) console.log("Adding at index " + atIndex);
            rooms.splice(atIndex, 0, room);
        }
        this.setState({ sortedList: rooms });
        // console.log("moveRoomTile after: " + JSON.stringify(this.state.rooms));
    },

    // XXX: this isn't invoked via a property method but indirectly via
    // the roomList property method.  Unsure how evil this is.
    removeRoomTile: function(room) {
        if (debug) console.log("remove room " + room.roomId);
        var found = this.findRoomTile(room);
        var rooms = this.state.sortedList;
        if (found.room) {
            rooms.splice(found.index, 1);
        }        
        else {
            console.warn("Can't remove room " + room.roomId + " - can't find it");
        }
        this.setState({ sortedList: rooms });
    },

    findRoomTile: function(room) {        
        var index = this.state.sortedList.indexOf(room); 
        if (index >= 0) {
            // console.log("found: room: " + room.roomId + " with index " + index);
        }
        else {
            if (debug) console.log("didn't find room");
            room = null;
        }
        return ({
            room: room,
            index: index,
        });
    },

    calcManualOrderTagData: function(room) {
        var index = this.state.sortedList.indexOf(room); 

        // we sort rooms by the lexicographic ordering of the 'order' metadata on their tags.
        // for convenience, we calculate this for now a floating point number between 0.0 and 1.0.

        var orderA = 0.0; // by default we're next to the beginning of the list
        if (index > 0) {
            var prevTag = this.state.sortedList[index - 1].tags[this.props.tagName];
            if (!prevTag) {
                console.error("Previous room in sublist is not tagged to be in this list. This should never happen.")
            }
            else if (prevTag.order === undefined) {
                console.error("Previous room in sublist has no ordering metadata. This should never happen.");
            }
            else {
                orderA = prevTag.order;
            }
        }

        var orderB = 1.0; // by default we're next to the end of the list too
        if (index < this.state.sortedList.length - 1) {
            var nextTag = this.state.sortedList[index + 1].tags[this.props.tagName];
            if (!nextTag) {
                console.error("Next room in sublist is not tagged to be in this list. This should never happen.")
            }
            else if (nextTag.order === undefined) {
                console.error("Next room in sublist has no ordering metadata. This should never happen.");
            }
            else {
                orderB = nextTag.order;
            }
        }

        var order = (orderA + orderB) / 2.0;
        if (order === orderA || order === orderB) {
            console.error("Cannot describe new list position.  This should be incredibly unlikely.");
            // TODO: renumber the list
        }

        return order;
    },

    makeRoomTiles: function() {
        var self = this;
        var RoomTile = sdk.getComponent("rooms.RoomTile");
        return this.state.sortedList.map(function(room) {
            var selected = room.roomId == self.props.selectedRoom;
            // XXX: is it evil to pass in self as a prop to RoomTile?
            return (
                <RoomTile
                    room={ room }
                    roomSubList={ self }
                    key={ room.roomId }
                    collapsed={ self.props.collapsed || false}
                    selected={ selected }
                    unread={ self.props.activityMap[room.roomId] === 1 }
                    highlight={ self.props.activityMap[room.roomId] === 2 }
                    isInvite={ self.props.label === 'Invites' } />
            );
        });
    },

    render: function() {
        var connectDropTarget = this.props.connectDropTarget;
        var RoomDropTarget = sdk.getComponent('molecules.RoomDropTarget');

        var label = this.props.collapsed ? null : this.props.label;

        //console.log("render: " + JSON.stringify(this.state.sortedList));

        var target;
        if (this.state.sortedList.length == 0 && this.props.editable) {
            target = <RoomDropTarget label={ 'Drop here to ' + this.props.verb }/>;
        }

        if (this.state.sortedList.length > 0 || this.props.editable) {
            var subList;
            var classes = "mx_RoomSubList" +
                          (this.props.bottommost ? " mx_RoomSubList_bottommost" : "");

            if (!this.state.hidden) {
                subList = <div className={ classes }>
                                { target }
                                { this.makeRoomTiles() }
                          </div>;
            }
            else {
                subList = <div className={ classes }>
                          </div>;                
            }

            return connectDropTarget(
                <div>
                    <h2 onClick={ this.onClick } className="mx_RoomSubList_label">{ this.props.collapsed ? '' : this.props.label }
                        <img className="mx_RoomSubList_chevron" src={ this.state.hidden ? "img/list-open.png" : "img/list-close.png" } width="10" height="10"/>
                    </h2>
                    { subList }
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

// Export the wrapped version, inlining the 'collect' functions
// to more closely resemble the ES7
module.exports = 
DropTarget('RoomTile', roomListTarget, function(connect) {
    return {
        connectDropTarget: connect.dropTarget(),
    }
})(RoomSubList);
