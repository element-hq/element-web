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
var DragSource = require('react-dnd').DragSource;
var DropTarget = require('react-dnd').DropTarget;
var classNames = require('classnames');

var RoomTileController = require('matrix-react-sdk/lib/controllers/molecules/RoomTile')

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

var sdk = require('matrix-react-sdk')

/**
 * Specifies the drag source contract.
 * Only `beginDrag` function is required.
 */
var roomTileSource = {
    beginDrag: function (props) {
        // Return the data describing the dragged item
        var item = {
            room: props.room,
            originalList: props.roomSubList,            
            originalIndex: props.roomSubList.findRoomTile(props.room).index,
            targetList: props.roomSubList, // at first target is same as original
        };

        console.log("roomTile beginDrag for " + item.room.roomId);

        return item;
    },

    endDrag: function (props, monitor, component) {
        var item = monitor.getItem();
        var dropResult = monitor.getDropResult();

        console.log("roomTile endDrag for " + item.room.roomId + " with didDrop=" + monitor.didDrop());

        if (!monitor.didDrop() || !item.targetList.props.editable) {
            props.roomSubList.moveRoomTile(item.room, item.originalIndex);
            if (item.targetList && item.targetList !== item.originalList) {
                item.targetList.removeRoomTile(item.room);
            }
            return;
        }
        else {
            // if it's not manual ordering, we'll need to position the tile correctly here according to the right ordering

            // When dropped on a compatible target, actually set the right tags for the new ordering
            // persistNewOrder(item.room, dropResult.listId);
        }
    }
};

var roomTileTarget = {
    canDrop: function() {
        return false;
    },

    hover: function(props, monitor) {
        var item = monitor.getItem();
        console.log("hovering on room " + props.room.roomId + ", isOver=" + monitor.isOver());

        //console.log("item.targetList=" + item.targetList + ", roomSubList=" + props.roomSubList);

        if (item.targetList !== props.roomSubList) {
            // we've switched target, so remove the tile from the previous target.
            // n.b. the previous target might actually be the source list.
            item.targetList.removeRoomTile(item.room);
            item.targetList = props.roomSubList;
        }

        if (item.targetList.props.order === 'manual' && item.room.roomId !== props.room.roomId) {
            var roomTile = props.roomSubList.findRoomTile(props.room);
            props.roomSubList.moveRoomTile(item.room, roomTile.index);
        }
    },
};

var RoomTile = React.createClass({
    displayName: 'RoomTile',
    mixins: [RoomTileController],

    propTypes: {
        connectDragSource: React.PropTypes.func.isRequired,
        connectDropTarget: React.PropTypes.func.isRequired,
        isDragging: React.PropTypes.bool.isRequired,
        room: React.PropTypes.object.isRequired,
        collapsed: React.PropTypes.bool.isRequired,
        selected: React.PropTypes.bool.isRequired,
        unread: React.PropTypes.bool.isRequired,
        highlight: React.PropTypes.bool.isRequired,
        isInvite: React.PropTypes.bool.isRequired,
        roomSubList: React.PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return( { hover : false });
    },

    onMouseEnter: function() {
        this.setState( { hover : true });
    },

    onMouseLeave: function() {
        this.setState( { hover : false });
    },

    render: function() {
        var myUserId = MatrixClientPeg.get().credentials.userId;
        var me = this.props.room.currentState.members[myUserId];
        var classes = classNames({
            'mx_RoomTile': true,
            'mx_RoomTile_selected': this.props.selected,
            'mx_RoomTile_unread': this.props.unread,
            'mx_RoomTile_highlight': this.props.highlight,
            'mx_RoomTile_invited': (me && me.membership == 'invite'),
        });

        var name;
        if (this.props.isInvite) {
            name = this.props.room.getMember(MatrixClientPeg.get().credentials.userId).events.member.getSender();
        }
        else {
            name = this.props.room.name;
        }

        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon
        var badge;
        if (this.props.highlight) {
            badge = <div className="mx_RoomTile_badge"/>;
        }
        /*
        if (this.props.highlight) {
            badge = <div className="mx_RoomTile_badge">!</div>;
        }
        else if (this.props.unread) {
            badge = <div className="mx_RoomTile_badge">1</div>;
        }
        var nameCell;
        if (badge) {
            nameCell = <div className="mx_RoomTile_nameBadge"><div className="mx_RoomTile_name">{name}</div><div className="mx_RoomTile_badgeCell">{badge}</div></div>;
        }
        else {
            nameCell = <div className="mx_RoomTile_name">{name}</div>;
        }
        */

        var label;
        if (!this.props.collapsed) {
            var className = 'mx_RoomTile_name' + (this.props.isInvite ? ' mx_RoomTile_invite' : '');
            label = <div className={ className }>{name}</div>;
        }
        else if (this.state.hover) {
            var RoomTooltip = sdk.getComponent("molecules.RoomTooltip");
            label = <RoomTooltip room={this.props.room}/>;
        }

        var RoomAvatar = sdk.getComponent('atoms.RoomAvatar');

        // These props are injected by React DnD,
        // as defined by your `collect` function above:
        var isDragging = this.props.isDragging;
        var connectDragSource = this.props.connectDragSource;
        var connectDropTarget = this.props.connectDropTarget;

        return connectDragSource(connectDropTarget(
            <div className={classes} onClick={this.onClick} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <div className="mx_RoomTile_avatar">
                    <RoomAvatar room={this.props.room} width="24" height="24" />
                    { badge }
                </div>
                { label }
            </div>
        ));
    }
});

// Export the wrapped version, inlining the 'collect' functions
// to more closely resemble the ES7
module.exports = 
DropTarget('RoomTile', roomTileTarget, function(connect) {
    return {
        // Call this function inside render()
        // to let React DnD handle the drag events:
        connectDropTarget: connect.dropTarget(),
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