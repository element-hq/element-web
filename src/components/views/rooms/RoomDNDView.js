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
var DragSource = require('react-dnd').DragSource;
var DropTarget = require('react-dnd').DropTarget;

var dis = require("matrix-react-sdk/lib/dispatcher");
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var sdk = require('matrix-react-sdk');
var RoomTile = require('matrix-react-sdk/lib/components/views/rooms/RoomTile');

/**
 * Specifies the drag source contract.
 * Only `beginDrag` function is required.
 */
var roomTileSource = {
    canDrag: function(props, monitor) {
        return props.roomSubList.props.editable;
    },

    beginDrag: function (props) {
        // Return the data describing the dragged item
        var item = {
            room: props.room,
            originalList: props.roomSubList,
            originalIndex: props.roomSubList.findRoomTile(props.room).index,
            targetList: props.roomSubList, // at first target is same as original
            // lastTargetRoom: null,
            // lastYOffset: null,
            // lastYDelta: null,
        };

        if (props.roomSubList.debug) console.log("roomTile beginDrag for " + item.room.roomId);

        // doing this 'correctly' with state causes react-dnd to break seemingly due to the state transitions
        props.room._dragging = true;

        return item;
    },

    endDrag: function (props, monitor, component) {
        var item = monitor.getItem();

        if (props.roomSubList.debug) console.log("roomTile endDrag for " + item.room.roomId + " with didDrop=" + monitor.didDrop());

        props.room._dragging = false;
        if (monitor.didDrop()) {
            if (props.roomSubList.debug) console.log("force updating component " + item.targetList.props.label);
            item.targetList.forceUpdate(); // as we're not using state
        }

        if (monitor.didDrop() && item.targetList.props.editable) {
            // if we moved lists, remove the old tag
            if (item.targetList !== item.originalList && item.originalList.props.tagName) {
                // commented out attempts to set a spinner on our target component as component is actually
                // the original source component being dragged, not our target.  To fix we just need to
                // move all of this to endDrop in the target instead.  FIXME later.

                //component.state.set({ spinner: component.state.spinner ? component.state.spinner++ : 1 });
                MatrixClientPeg.get().deleteRoomTag(item.room.roomId, item.originalList.props.tagName).finally(function() {
                    //component.state.set({ spinner: component.state.spinner-- });
                }).fail(function(err) {
                    var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createDialog(ErrorDialog, {
                        title: "Failed to remove tag " + item.originalList.props.tagName + " from room",
                        description: err.toString()
                    });
                });
            }

            var newOrder= {};
            if (item.targetList.props.order === 'manual') {
                newOrder['order'] = item.targetList.calcManualOrderTagData(item.room);
            }

            // if we moved lists or the ordering changed, add the new tag
            if (item.targetList.props.tagName && (item.targetList !== item.originalList || newOrder)) {
                //component.state.set({ spinner: component.state.spinner ? component.state.spinner++ : 1 });
                MatrixClientPeg.get().setRoomTag(item.room.roomId, item.targetList.props.tagName, newOrder).finally(function() {
                    //component.state.set({ spinner: component.state.spinner-- });
                }).fail(function(err) {
                    var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createDialog(ErrorDialog, {
                        title: "Failed to add tag " + item.targetList.props.tagName + " to room",
                        description: err.toString()
                    });
                });
            }
        }
        else {
            // cancel the drop and reset our original position
            if (props.roomSubList.debug) console.log("cancelling drop & drag");
            props.roomSubList.moveRoomTile(item.room, item.originalIndex);
            if (item.targetList && item.targetList !== item.originalList) {
                item.targetList.removeRoomTile(item.room);
            }
        }
    }
};

var roomTileTarget = {
    canDrop: function() {
        return false;
    },

    hover: function(props, monitor) {
        var item = monitor.getItem();
        //var off = monitor.getClientOffset();
        // console.log("hovering on room " + props.room.roomId + ", isOver=" + monitor.isOver());

        //console.log("item.targetList=" + item.targetList + ", roomSubList=" + props.roomSubList);

        var switchedTarget = false;
        if (item.targetList !== props.roomSubList) {
            // we've switched target, so remove the tile from the previous target.
            // n.b. the previous target might actually be the source list.
            if (props.roomSubList.debug) console.log("switched target sublist");
            switchedTarget = true;
            item.targetList.removeRoomTile(item.room);
            item.targetList = props.roomSubList;
        }

        if (!item.targetList.props.editable) return;

        if (item.targetList.props.order === 'manual') {
            if (item.room.roomId !== props.room.roomId && props.room !== item.lastTargetRoom) {
                // find the offset of the target tile in the list.
                var roomTile = props.roomSubList.findRoomTile(props.room);
                // shuffle the list to add our tile to that position.
                props.roomSubList.moveRoomTile(item.room, roomTile.index);
            }

            // stop us from flickering between our droptarget and the previous room.
            // whenever the cursor changes direction we have to reset the flicker-damping.
/*
            var yDelta = off.y - item.lastYOffset;

            if ((yDelta > 0 && item.lastYDelta < 0) ||
                (yDelta < 0 && item.lastYDelta > 0))
            {
                // the cursor changed direction - forget our previous room
                item.lastTargetRoom = null;
            }
            else {
                // track the last room we were hovering over so we can stop
                // bouncing back and forth if the droptarget is narrower than
                // the other list items.  The other way to do this would be
                // to reduce the size of the hittarget on the list items, but
                // can't see an easy way to do that.
                item.lastTargetRoom = props.room;
            }

            if (yDelta) item.lastYDelta = yDelta;
            item.lastYOffset = off.y;
*/
        }
        else if (switchedTarget) {
            if (!props.roomSubList.findRoomTile(item.room).room) {
                // add to the list in the right place
                props.roomSubList.moveRoomTile(item.room, 0);
            }
            // we have to sort the list whatever to recalculate it
            props.roomSubList.sortList();
        }
    },
};

// Export the wrapped version, inlining the 'collect' functions
// to more closely resemble the ES7
module.exports =
DropTarget('RoomTile', roomTileTarget, function(connect, monitor) {
    return {
        // Call this function inside render()
        // to let React DnD handle the drag events:
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver(),
    }
})(
DragSource('RoomTile', roomTileSource, function(connect, monitor) {
    return {
        // Call this function inside render()
        // to let React DnD handle the drag events:
        connectDragSource: connect.dragSource(),
        // You can ask the monitor about the current drag state:
        isDragging: monitor.isDragging()
    };
})(RoomTile));

module.exports.replaces = 'RoomTile';
