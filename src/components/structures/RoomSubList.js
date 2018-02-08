/*
Copyright 2017 Vector Creations Ltd
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
var sdk = require('matrix-react-sdk');
import { Droppable } from 'react-beautiful-dnd';
import { _t } from 'matrix-react-sdk/lib/languageHandler';
var dis = require('matrix-react-sdk/lib/dispatcher');
var Unread = require('matrix-react-sdk/lib/Unread');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var RoomNotifs = require('matrix-react-sdk/lib/RoomNotifs');
var FormattingUtils = require('matrix-react-sdk/lib/utils/FormattingUtils');
var AccessibleButton = require('matrix-react-sdk/lib/components/views/elements/AccessibleButton');
import Modal from 'matrix-react-sdk/lib/Modal';
import { KeyCode } from 'matrix-react-sdk/lib/Keyboard';


// turn this on for drop & drag console debugging galore
var debug = false;

const TRUNCATE_AT = 10;

var RoomSubList = React.createClass({
    displayName: 'RoomSubList',

    debug: debug,

    propTypes: {
        list: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
        label: React.PropTypes.string.isRequired,
        tagName: React.PropTypes.string,
        editable: React.PropTypes.bool,

        order: React.PropTypes.string.isRequired,

        // passed through to RoomTile and used to highlight room with `!` regardless of notifications count
        isInvite: React.PropTypes.bool,

        startAsHidden: React.PropTypes.bool,
        showSpinner: React.PropTypes.bool, // true to show a spinner if 0 elements when expanded
        collapsed: React.PropTypes.bool.isRequired, // is LeftPanel collapsed?
        onHeaderClick: React.PropTypes.func,
        alwaysShowHeader: React.PropTypes.bool,
        incomingCall: React.PropTypes.object,
        onShowMoreRooms: React.PropTypes.func,
        searchFilter: React.PropTypes.string,
        emptyContent: React.PropTypes.node, // content shown if the list is empty
        headerItems: React.PropTypes.node, // content shown in the sublist header
        extraTiles: React.PropTypes.arrayOf(React.PropTypes.node), // extra elements added beneath tiles
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
            onShowMoreRooms: function() {}, // NOP
            extraTiles: [],
            isInvite: false,
        };
    },

    componentWillMount: function() {
        this.setState({
            sortedList: this.applySearchFilter(this.props.list, this.props.searchFilter),
        });
    },

    componentWillReceiveProps: function(newProps) {
        // order the room list appropriately before we re-render
        //if (debug) console.log("received new props, list = " + newProps.list);
        this.setState({
            sortedList: this.applySearchFilter(newProps.list, newProps.searchFilter),
        });
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

    onRoomTileClick(roomId, ev) {
        dis.dispatch({
            action: 'view_room',
            room_id: roomId,
            clear_search: (ev && (ev.keyCode == KeyCode.ENTER || ev.keyCode == KeyCode.SPACE)),
        });
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

        if (this.props.isInvite) {
            return [0, true];
        }

        return this.props.list.reduce(function(result, room, index) {
            if (truncateAt === undefined || index >= truncateAt) {
                var roomNotifState = RoomNotifs.getRoomNotifsState(room.roomId);
                var highlight = room.getUnreadNotificationCount('highlight') > 0;
                var notificationCount = room.getUnreadNotificationCount();

                const notifBadges = notificationCount > 0 && self._shouldShowNotifBadge(roomNotifState);
                const mentionBadges = highlight && self._shouldShowMentionBadge(roomNotifState);
                const badges = notifBadges || mentionBadges;

                if (badges) {
                    result[0] += notificationCount;
                    if (highlight) {
                        result[1] = true;
                    }
                }
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

    makeRoomTiles: function() {
        var self = this;
        var DNDRoomTile = sdk.getComponent("rooms.DNDRoomTile");
        return this.state.sortedList.map(function(room, index) {
            // XXX: is it evil to pass in self as a prop to RoomTile?
            return (
                <DNDRoomTile
                    index={index} // For DND
                    room={ room }
                    roomSubList={ self }
                    tagName={self.props.tagName}
                    key={ room.roomId }
                    collapsed={ self.props.collapsed || false}
                    unread={ Unread.doesRoomHaveUnreadMessages(room) }
                    highlight={ room.getUnreadNotificationCount('highlight') > 0 || self.props.isInvite }
                    isInvite={ self.props.isInvite }
                    refreshSubList={ self._updateSubListCount }
                    incomingCall={ null }
                    onClick={ self.onRoomTileClick }
                />
            );
        });
    },

    _getHeaderJsx: function() {
        var TintableSvg = sdk.getComponent("elements.TintableSvg");

        var subListNotifications = this.roomNotificationCount();
        var subListNotifCount = subListNotifications[0];
        var subListNotifHighlight = subListNotifications[1];

        var totalTiles = this.props.list.length + (this.props.extraTiles || []).length;
        var roomCount = totalTiles > 0 ? totalTiles : '';

        var chevronClasses = classNames({
            'mx_RoomSubList_chevron': true,
            'mx_RoomSubList_chevronRight': this.state.hidden,
            'mx_RoomSubList_chevronDown': !this.state.hidden,
        });

        var badgeClasses = classNames({
            'mx_RoomSubList_badge': true,
            'mx_RoomSubList_badgeHighlight': subListNotifHighlight,
        });

        var badge;
        if (subListNotifCount > 0) {
            badge = <div className={badgeClasses}>{ FormattingUtils.formatCount(subListNotifCount) }</div>;
        } else if (this.props.isInvite) {
            // no notifications but highlight anyway because this is an invite badge
            badge = <div className={badgeClasses}>!</div>;
        }

        // When collapsed, allow a long hover on the header to show user
        // the full tag name and room count
        var title;
        if (this.props.collapsed) {
            title = this.props.label;
            if (roomCount !== '') {
                title += " [" + roomCount + "]";
            }
        }

        var incomingCall;
        if (this.props.incomingCall) {
            var self = this;
            // Check if the incoming call is for this section
            var incomingCallRoom = this.props.list.filter(function(room) {
                return self.props.incomingCall.roomId === room.roomId;
            });

            if (incomingCallRoom.length === 1) {
                var IncomingCallBox = sdk.getComponent("voip.IncomingCallBox");
                incomingCall = <IncomingCallBox className="mx_RoomSubList_incomingCall" incomingCall={ this.props.incomingCall }/>;
            }
        }

        var tabindex = this.props.searchFilter === "" ? "0" : "-1";

        return (
            <div className="mx_RoomSubList_labelContainer" title={ title } ref="header">
                <AccessibleButton onClick={ this.onClick } className="mx_RoomSubList_label" tabIndex={tabindex}>
                    { this.props.collapsed ? '' : this.props.label }
                    <div className="mx_RoomSubList_roomCount">{ roomCount }</div>
                    <div className={chevronClasses}></div>
                    { badge }
                    { incomingCall }
                </AccessibleButton>
            </div>
        );
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
                <div className="mx_RoomSubList_more">{ _t("more") }</div>
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

    render: function() {
        var connectDropTarget = this.props.connectDropTarget;
        var TruncatedList = sdk.getComponent('elements.TruncatedList');

        var label = this.props.collapsed ? null : this.props.label;

        let content;
        if (this.state.sortedList.length === 0 && !this.props.searchFilter && this.props.extraTiles.length === 0) {
            content = this.props.emptyContent;
        } else {
            content = this.makeRoomTiles();
            content.push(...this.props.extraTiles);
        }

        if (this.state.sortedList.length > 0 || this.props.extraTiles.length > 0 || this.props.editable) {
            var subList;
            var classes = "mx_RoomSubList";

            if (!this.state.hidden) {
                subList = <TruncatedList className={ classes } truncateAt={this.state.truncateAt}
                                         createOverflowElement={this._createOverflowTile} >
                                { content }
                          </TruncatedList>;
            }
            else {
                subList = <TruncatedList className={ classes }>
                          </TruncatedList>;
            }

            const subListContent = <div>
                { this._getHeaderJsx() }
                { subList }
            </div>;

            return this.props.editable ?
                <Droppable
                    droppableId={"room-sub-list-droppable_" + this.props.tagName}
                    type="draggable-RoomTile"
                >
                    { (provided, snapshot) => (
                        <div ref={provided.innerRef}>
                            { subListContent }
                        </div>
                    ) }
                </Droppable> : subListContent;
        }
        else {
            var Loader = sdk.getComponent("elements.Spinner");
            return (
                <div className="mx_RoomSubList">
                    { this.props.alwaysShowHeader ? this._getHeaderJsx() : undefined }
                    { (this.props.showSpinner && !this.state.hidden) ? <Loader /> : undefined }
                </div>
            );
        }
    }
});

module.exports = RoomSubList;
