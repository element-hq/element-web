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
var ReactDOM = require('react-dom');
var classNames = require('classnames');
var DropTarget = require('react-dnd').DropTarget;
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');
var Unread = require('matrix-react-sdk/lib/Unread');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var RoomNotifs = require('matrix-react-sdk/lib/RoomNotifs');
var FormattingUtils = require('matrix-react-sdk/lib/utils/FormattingUtils');
var AccessibleButton = require('matrix-react-sdk/lib/components/views/elements/AccessibleButton');
var ConstantTimeDispatcher = require('matrix-react-sdk/lib/ConstantTimeDispatcher');

// turn this on for drag & drop console debugging galore
var debug = false;

const TRUNCATE_AT = 10;

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

        // undefined if no room is selected (eg we are showing settings)
        selectedRoom: React.PropTypes.string,

        startAsHidden: React.PropTypes.bool,
        showSpinner: React.PropTypes.bool, // true to show a spinner if 0 elements when expanded
        collapsed: React.PropTypes.bool.isRequired, // is LeftPanel collapsed?
        onHeaderClick: React.PropTypes.func,
        onRoomTileFocus: React.PropTypes.func,
        alwaysShowHeader: React.PropTypes.bool,
        incomingCall: React.PropTypes.object,
        onShowMoreRooms: React.PropTypes.func,
        searchFilter: React.PropTypes.string,
    },

    getInitialState: function() {
        return {
            hidden: this.props.startAsHidden || false,
            truncateAt: TRUNCATE_AT,
            sortedList: [],
        };
    },

    getDefaultProps: function() {
        return {
            onHeaderClick: function() {}, // NOP
            onShowMoreRooms: function() {} // NOP
        };
    },

    componentWillMount: function() {
        constantTimeDispatcher.register("RoomSubList.sort", this.props.tagName, this.onSort);
        this.sortList(this.applySearchFilter(this.props.list, this.props.searchFilter), this.props.order);
        this._fixUndefinedOrder(list);
    },

    componentWillUnmount: function() {
        constantTimeDispatcher.unregister("RoomSubList.sort", this.props.tagName, this.onSort);
    },

    componentWillReceiveProps: function(newProps) {
        // order the room list appropriately before we re-render
        //if (debug) console.log("received new props, list = " + newProps.list);
        this.sortList(this.applySearchFilter(newProps.list, newProps.searchFilter), newProps.order);
        this._fixUndefinedOrder(list);
    },

    onSort: function() {
        this.sortList(this.applySearchFilter(this.props.list, this.props.searchFilter), this.props.order);
        // we deliberately don't waste time trying to fix undefined ordering here
    },

    applySearchFilter: function(list, filter) {
        if (filter === "") return list;
        return list.filter((room) => {
            return room.name && room.name.toLowerCase().indexOf(filter.toLowerCase()) >= 0
        });
    },

    // The header is collapsable if it is hidden or not stuck
    // The dataset elements are added in the RoomList _initAndPositionStickyHeaders method
    isCollapsableOnClick: function() {
        var stuck = this.refs.header.dataset.stuck;
        if (this.state.hidden || stuck === undefined || stuck === "none") {
            return true;
        } else {
            return false;
        }
    },

    onClick: function(ev) {
        if (this.isCollapsableOnClick()) {
            // The header isCollapsable, so the click is to be interpreted as collapse and truncation logic
            var isHidden = !this.state.hidden;
            this.setState({ hidden : isHidden });

            if (isHidden) {
                // as good a way as any to reset the truncate state
                this.setState({ truncateAt : TRUNCATE_AT });
            }

            this.props.onShowMoreRooms();
            this.props.onHeaderClick(isHidden);
        } else {
            // The header is stuck, so the click is to be interpreted as a scroll to the header
            this.props.onHeaderClick(this.state.hidden, this.refs.header.dataset.originalPosition);
        }
    },

    onRoomTileClick(roomId) {
        dis.dispatch({
            action: 'view_room',
            room_id: roomId,
        });
    },

    tsOfNewestEvent: function(room) {
        for (var i = room.timeline.length - 1; i >= 0; --i) {
            var ev = room.timeline[i];
            if (ev.getTs() &&
                (Unread.eventTriggersUnreadCount(ev) ||
                (ev.getSender() === MatrixClientPeg.get().credentials.userId))
            ) {
                return ev.getTs();
            }
        }

        // we might only have events that don't trigger the unread indicator,
        // in which case use the oldest event even if normally it wouldn't count.
        // This is better than just assuming the last event was forever ago.
        if (room.timeline.length && room.timeline[0].getTs()) {
            return room.timeline[0].getTs();
        } else {
            return Number.MAX_SAFE_INTEGER;
        }
    },

    // TODO: factor the comparators back out into a generic comparator
    // so that view_prev_room and view_next_room can do the right thing

    recentsComparator: function(roomA, roomB) {
        return this.tsOfNewestEvent(roomB) - this.tsOfNewestEvent(roomA);
    },

    lexicographicalComparator: function(roomA, roomB) {
        return roomA.name > roomB.name ? 1 : -1;
    },

    // Generates the manual comparator using the given list
    manualComparator: function(roomA, roomB) {
        if (!roomA.tags[this.props.tagName] || !roomB.tags[this.props.tagName]) return 0;

        // Make sure the room tag has an order element, if not set it to be the bottom
        var a = roomA.tags[this.props.tagName].order;
        var b = roomB.tags[this.props.tagName].order;

        // Order undefined room tag orders to the bottom
        if (a === undefined && b !== undefined) {
            return 1;
        } else if (a !== undefined && b === undefined) {
            return -1;
        }

        return a == b ? this.lexicographicalComparator(roomA, roomB) : ( a > b  ? 1 : -1);
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

    _shouldShowNotifBadge: function(roomNotifState) {
        const showBadgeInStates = [RoomNotifs.ALL_MESSAGES, RoomNotifs.ALL_MESSAGES_LOUD];
        return showBadgeInStates.indexOf(roomNotifState) > -1;
    },

    _shouldShowMentionBadge: function(roomNotifState) {
        return roomNotifState != RoomNotifs.MUTE;
    },

    /**
     * Total up all the notification counts from the rooms
     *
     * @param {Number} If supplied will only total notifications for rooms outside the truncation number
     * @returns {Array} The array takes the form [total, highlight] where highlight is a bool
     */
    roomNotificationCount: function(truncateAt) {
        var self = this;

        return this.props.list.reduce(function(result, room, index) {
            if (truncateAt === undefined || index >= truncateAt) {
                var roomNotifState = RoomNotifs.getRoomNotifsState(room.roomId);
                var highlight = room.getUnreadNotificationCount('highlight') > 0 || self.props.label === 'Invites';
                var notificationCount = room.getUnreadNotificationCount();

                const notifBadges = notificationCount > 0 && self._shouldShowNotifBadge(roomNotifState);
                const mentionBadges = highlight && self._shouldShowMentionBadge(roomNotifState);
                const badges = notifBadges || mentionBadges;

                if (badges) {
                    result[0] += notificationCount;
                }

                result[1] |= highlight;
            }
            return result;
        }, [0, false]);
    },

    _updateSubListCount: function() {
        // Force an update by setting the state to the current state
        // Doing it this way rather than using forceUpdate(), so that the shouldComponentUpdate()
        // method is honoured
        this.setState(this.state);
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
        var DNDRoomTile = sdk.getComponent("rooms.DNDRoomTile");
        return this.state.sortedList.map(function(room) {
            var selected = room.roomId == self.props.selectedRoom;
            // XXX: is it evil to pass in self as a prop to RoomTile?
            return (
                <DNDRoomTile
                    room={ room }
                    roomSubList={ self }
                    key={ room.roomId }
                    collapsed={ self.props.collapsed || false}
                    selected={ selected }
                    unread={ Unread.doesRoomHaveUnreadMessages(room) }
                    highlight={ room.getUnreadNotificationCount('highlight') > 0 || self.props.label === 'Invites' }
                    isInvite={ self.props.label === 'Invites' }
                    refreshSubList={ self._updateSubListCount }
                    incomingCall={ null }
                    onClick={ self.onRoomTileClick }
                    onFocus={ self.props.onRoomTileFocus }
                />
            );
        });
    },

    _createOverflowTile: function(overflowCount, totalCount) {
        var content = <div className="mx_RoomSubList_chevronDown"></div>;

        var overflowNotifications = this.roomNotificationCount(TRUNCATE_AT);
        var overflowNotifCount = overflowNotifications[0];
        var overflowNotifHighlight = overflowNotifications[1];
        if (overflowNotifCount && !this.props.collapsed) {
            content = FormattingUtils.formatCount(overflowNotifCount);
        }

        var badgeClasses = classNames({
            'mx_RoomSubList_moreBadge': true,
            'mx_RoomSubList_moreBadgeNotify': overflowNotifCount && !this.props.collapsed,
            'mx_RoomSubList_moreBadgeHighlight': overflowNotifHighlight && !this.props.collapsed,
        });

        return (
            <AccessibleButton className="mx_RoomSubList_ellipsis" onClick={this._showFullMemberList}>
                <div className="mx_RoomSubList_line"></div>
                <div className="mx_RoomSubList_more">more</div>
                <div className={ badgeClasses }>{ content }</div>
            </AccessibleButton>
        );
    },

    _showFullMemberList: function() {
        this.setState({
            truncateAt: -1
        });

        this.props.onShowMoreRooms();
        this.props.onHeaderClick(false);
    },

    // Fix any undefined order elements of a room in a manual ordered list
    //     room.tag[tagname].order
    _fixUndefinedOrder: function(list) {
        if (this.props.order === "manual") {
            var order = 0.0;
            var self = this;

            // Find the highest (lowest position) order of a room in a manual ordered list
            list.forEach(function(room) {
                if (room.tags.hasOwnProperty(self.props.tagName)) {
                    if (order < room.tags[self.props.tagName].order) {
                        order = room.tags[self.props.tagName].order;
                    }
                }
            });

            // Fix any undefined order elements of a room in a manual ordered list
            // Do this one at a time, as each time a rooms tag data is updated the RoomList
            // gets triggered and another list is passed in. Doing it one at a time means that
            // we always correctly calculate the highest order for the list - stops multiple
            // rooms getting the same order. This is only really relevant for the first time this
            // is run with historical room tag data, after that there should only be one undefined
            // in the list at a time anyway.
            for (let i = 0; i < list.length; i++) {
                if (list[i].tags[self.props.tagName] && list[i].tags[self.props.tagName].order === undefined) {
                    MatrixClientPeg.get().setRoomTag(list[i].roomId, self.props.tagName, {order: (order + 1.0) / 2.0}).finally(function() {
                        // Do any final stuff here
                    }).fail(function(err) {
                        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                        console.error("Failed to add tag " + self.props.tagName + " to room" + err);
                        Modal.createDialog(ErrorDialog, {
                            title: "Error",
                            description: "Failed to add tag " + self.props.tagName + " to room",
                        });
                    });
                    break;
                };
            };
        }
    },

    render: function() {
        var connectDropTarget = this.props.connectDropTarget;
        var RoomDropTarget = sdk.getComponent('rooms.RoomDropTarget');
        var TruncatedList = sdk.getComponent('elements.TruncatedList');

        var label = this.props.collapsed ? null : this.props.label;

        //console.log("render: " + JSON.stringify(this.state.sortedList));

        var target;
        if (this.state.sortedList.length == 0 && this.props.editable) {
            target = <RoomDropTarget label={ 'Drop here to ' + this.props.verb }/>;
        }

        var roomCount = this.props.list.length > 0 ? this.props.list.length : '';

        var isIncomingCallRoom;
        if (this.props.incomingCall) {
            // Check if the incoming call is for this section
            isIncomingCallRoom = this.props.list.find(room=>{
                return this.props.incomingCall.roomId === room.roomId;
            }) ? true : false;
        }

        if (this.state.sortedList.length > 0 || this.props.editable) {
            var subList;
            var classes = "mx_RoomSubList";

            if (!this.state.hidden) {
                subList = <TruncatedList className={ classes } truncateAt={this.state.truncateAt}
                                         createOverflowElement={this._createOverflowTile} >
                                { target }
                                { this.makeRoomTiles() }
                          </TruncatedList>;
            }
            else {
                subList = <TruncatedList className={ classes }>
                          </TruncatedList>;
            }

            return connectDropTarget(
                <div>
                    <RoomSubListHeader
                        label={ this.props.label }
                        tagName={ this.props.tagName }
                        roomCount={ roomCount }
                        collapsed={ this.props.collapsed }
                        hidden={ this.state.hidden }
                        isIncomingCallRoom={ isIncomingCallRoom }
                        onHeaderClick={ this.props.onHeaderClick }
                    />
                    { subList }
                </div>
            );
        }
        else {
            var Loader = sdk.getComponent("elements.Spinner");
            return (
                <div className="mx_RoomSubList">
                    { this.props.alwaysShowHeader ? 
                        <RoomSubListHeader
                            label={ this.props.label }
                            tagName={ this.props.tagName }
                            roomCount={ roomCount }
                            collapsed={ this.props.collapsed }
                            hidden={ this.state.hidden }
                            isIncomingCallRoom={ isIncomingCallRoom }
                            onHeaderClick={ this.props.onHeaderClick }
                        />
                     : undefined }
                    { (this.props.showSpinner && !this.state.hidden) ? <Loader /> : undefined }
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
