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
var React = require("react");
var ReactDOM = require("react-dom");
var GeminiScrollbar = require('react-gemini-scrollbar');
var MatrixClientPeg = require("../../../MatrixClientPeg");
var CallHandler = require('../../../CallHandler');
var RoomListSorter = require("../../../RoomListSorter");
var Unread = require('../../../Unread');
var dis = require("../../../dispatcher");
var sdk = require('../../../index');
var rate_limited_func = require('../../../ratelimitedfunc');
var Rooms = require('../../../Rooms');
import DMRoomMap from '../../../utils/DMRoomMap';
var Receipt = require('../../../utils/Receipt');

var HIDE_CONFERENCE_CHANS = true;

module.exports = React.createClass({
    displayName: 'RoomList',

    propTypes: {
        ConferenceHandler: React.PropTypes.any,
        collapsed: React.PropTypes.bool.isRequired,
        currentRoom: React.PropTypes.string,
        searchFilter: React.PropTypes.string,
    },

    getInitialState: function() {
        return {
            isLoadingLeftRooms: false,
            lists: {},
            incomingCall: null,
        };
    },

    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("Room", this.onRoom);
        cli.on("deleteRoom", this.onDeleteRoom);
        cli.on("Room.timeline", this.onRoomTimeline);
        cli.on("Room.name", this.onRoomName);
        cli.on("Room.tags", this.onRoomTags);
        cli.on("Room.receipt", this.onRoomReceipt);
        cli.on("RoomState.events", this.onRoomStateEvents);
        cli.on("RoomMember.name", this.onRoomMemberName);
        cli.on("accountData", this.onAccountData);

        var s = this.getRoomLists();
        this.setState(s);
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        // Initialise the stickyHeaders when the component is created
        this._updateStickyHeaders(true);
    },

    componentDidUpdate: function() {
        // Reinitialise the stickyHeaders when the component is updated
        this._updateStickyHeaders(true);
        this._repositionIncomingCallBox(undefined, false);
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'view_tooltip':
                this.tooltip = payload.tooltip;
                break;
            case 'call_state':
                var call = CallHandler.getCall(payload.room_id);
                if (call && call.call_state === 'ringing') {
                    this.setState({
                        incomingCall: call
                    });
                    this._repositionIncomingCallBox(undefined, true);
                }
                else {
                    this.setState({
                        incomingCall: null
                    });
                }
                break;
        }
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room", this.onRoom);
            MatrixClientPeg.get().removeListener("deleteRoom", this.onDeleteRoom);
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
            MatrixClientPeg.get().removeListener("Room.name", this.onRoomName);
            MatrixClientPeg.get().removeListener("Room.tags", this.onRoomTags);
            MatrixClientPeg.get().removeListener("Room.receipt", this.onRoomReceipt);
            MatrixClientPeg.get().removeListener("RoomState.events", this.onRoomStateEvents);
            MatrixClientPeg.get().removeListener("RoomMember.name", this.onRoomMemberName);
            MatrixClientPeg.get().removeListener("accountData", this.onAccountData);
        }
        // cancel any pending calls to the rate_limited_funcs
        this._delayedRefreshRoomList.cancelPendingCall();
    },

    onRoom: function(room) {
        this._delayedRefreshRoomList();
    },

    onDeleteRoom: function(roomId) {
        this._delayedRefreshRoomList();
    },

    onArchivedHeaderClick: function(isHidden, scrollToPosition) {
        if (!isHidden) {
            var self = this;
            this.setState({ isLoadingLeftRooms: true });

            // Try scrolling to position
            this._updateStickyHeaders(true, scrollToPosition);

            // we don't care about the response since it comes down via "Room"
            // events.
            MatrixClientPeg.get().syncLeftRooms().catch(function(err) {
                console.error("Failed to sync left rooms: %s", err);
                console.error(err);
            }).finally(function() {
                self.setState({ isLoadingLeftRooms: false });
            });
        }
    },

    onSubListHeaderClick: function(isHidden, scrollToPosition) {
        // The scroll area has expanded or contracted, so re-calculate sticky headers positions
        this._updateStickyHeaders(true, scrollToPosition);
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline, removed, data) {
        if (toStartOfTimeline) return;
        if (!room) return;
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) return;
        this._delayedRefreshRoomList();
    },

    onRoomReceipt: function(receiptEvent, room) {
        // because if we read a notification, it will affect notification count
        // only bother updating if there's a receipt from us
        if (Receipt.findReadReceiptFromUserId(receiptEvent, MatrixClientPeg.get().credentials.userId)) {
            this._delayedRefreshRoomList();
        }
    },

    onRoomName: function(room) {
        this._delayedRefreshRoomList();
    },

    onRoomTags: function(event, room) {
        this._delayedRefreshRoomList();
    },

    onRoomStateEvents: function(ev, state) {
        this._delayedRefreshRoomList();
    },

    onRoomMemberName: function(ev, member) {
        this._delayedRefreshRoomList();
    },

    onAccountData: function(ev) {
        if (ev.getType() == 'm.direct') {
            this._delayedRefreshRoomList();
        }
    },

    _delayedRefreshRoomList: new rate_limited_func(function() {
        this.refreshRoomList();
    }, 500),

    refreshRoomList: function() {
        // console.log("DEBUG: Refresh room list delta=%s ms",
        //     (!this._lastRefreshRoomListTs ? "-" : (Date.now() - this._lastRefreshRoomListTs))
        // );

        // TODO: rather than bluntly regenerating and re-sorting everything
        // every time we see any kind of room change from the JS SDK
        // we could do incremental updates on our copy of the state
        // based on the room which has actually changed.  This would stop
        // us re-rendering all the sublists every time anything changes anywhere
        // in the state of the client.
        this.setState(this.getRoomLists());
        this._lastRefreshRoomListTs = Date.now();
    },

    getRoomLists: function() {
        var self = this;
        var s = { lists: {} };

        s.lists["im.vector.fake.invite"] = [];
        s.lists["m.favourite"] = [];
        s.lists["im.vector.fake.recent"] = [];
        s.lists["im.vector.fake.direct"] = [];
        s.lists["m.lowpriority"] = [];
        s.lists["im.vector.fake.archived"] = [];

        const dmRoomMap = new DMRoomMap(MatrixClientPeg.get());

        MatrixClientPeg.get().getRooms().forEach(function(room) {
            const me = room.getMember(MatrixClientPeg.get().credentials.userId);
            if (!me) return;

            // console.log("room = " + room.name + ", me.membership = " + me.membership +
            //             ", sender = " + me.events.member.getSender() +
            //             ", target = " + me.events.member.getStateKey() +
            //             ", prevMembership = " + me.events.member.getPrevContent().membership);

            if (me.membership == "invite") {
                s.lists["im.vector.fake.invite"].push(room);
            }
            else if (HIDE_CONFERENCE_CHANS && Rooms.isConfCallRoom(room, me, self.props.ConferenceHandler)) {
                // skip past this room & don't put it in any lists
            }
            else if (me.membership == "join" || me.membership === "ban" ||
                     (me.membership === "leave" && me.events.member.getSender() !== me.events.member.getStateKey()))
            {
                // Used to split rooms via tags
                var tagNames = Object.keys(room.tags);

                if (tagNames.length) {
                    for (var i = 0; i < tagNames.length; i++) {
                        var tagName = tagNames[i];
                        s.lists[tagName] = s.lists[tagName] || [];
                        s.lists[tagNames[i]].push(room);
                    }
                }
                else if (dmRoomMap.getUserIdForRoomId(room.roomId)) {
                    // "Direct Message" rooms (that we're still in and that aren't otherwise tagged)
                    s.lists["im.vector.fake.direct"].push(room);
                }
                else {
                    s.lists["im.vector.fake.recent"].push(room);
                }
            }
            else if (me.membership === "leave") {
                s.lists["im.vector.fake.archived"].push(room);
            }
            else {
                console.error("unrecognised membership: " + me.membership + " - this should never happen");
            }
        });

        if (s.lists["im.vector.fake.direct"].length == 0 &&
            MatrixClientPeg.get().getAccountData('m.direct') === undefined &&
            !MatrixClientPeg.get().isGuest())
        {
            // scan through the 'recents' list for any rooms which look like DM rooms
            // and make them DM rooms
            const oldRecents = s.lists["im.vector.fake.recent"];
            s.lists["im.vector.fake.recent"] = [];

            for (const room of oldRecents) {
                const me = room.getMember(MatrixClientPeg.get().credentials.userId);

                if (me && Rooms.looksLikeDirectMessageRoom(room, me)) {
                    s.lists["im.vector.fake.direct"].push(room);
                } else {
                    s.lists["im.vector.fake.recent"].push(room);
                }
            }

            // save these new guessed DM rooms into the account data
            const newMDirectEvent = {};
            for (const room of s.lists["im.vector.fake.direct"]) {
                const me = room.getMember(MatrixClientPeg.get().credentials.userId);
                const otherPerson = Rooms.getOnlyOtherMember(room, me);
                if (!otherPerson) continue;

                const roomList = newMDirectEvent[otherPerson.userId] || [];
                roomList.push(room.roomId);
                newMDirectEvent[otherPerson.userId] = roomList;
            }

            // if this fails, fine, we'll just do the same thing next time we get the room lists
            MatrixClientPeg.get().setAccountData('m.direct', newMDirectEvent).done();
        }

        //console.log("calculated new roomLists; im.vector.fake.recent = " + s.lists["im.vector.fake.recent"]);

        // we actually apply the sorting to this when receiving the prop in RoomSubLists.

        return s;
    },

    _getScrollNode: function() {
        var panel = ReactDOM.findDOMNode(this);
        if (!panel) return null;

        if (panel.classList.contains('gm-prevented')) {
            return panel;
        } else {
            return panel.children[2]; // XXX: Fragile!
        }
    },

    _whenScrolling: function(e) {
        this._hideTooltip(e);
        this._repositionIncomingCallBox(e, false);
        this._updateStickyHeaders(false);
    },

    _hideTooltip: function(e) {
        // Hide tooltip when scrolling, as we'll no longer be over the one we were on
        if (this.tooltip && this.tooltip.style.display !== "none") {
            this.tooltip.style.display = "none";
        }
    },

    _repositionIncomingCallBox: function(e, firstTime) {
        var incomingCallBox = document.getElementById("incomingCallBox");
        if (incomingCallBox && incomingCallBox.parentElement) {
            var scrollArea = this._getScrollNode();
            // Use the offset of the top of the scroll area from the window
            // as this is used to calculate the CSS fixed top position for the stickies
            var scrollAreaOffset = scrollArea.getBoundingClientRect().top + window.pageYOffset;
            // Use the offset of the top of the componet from the window
            // as this is used to calculate the CSS fixed top position for the stickies
            var scrollAreaHeight = ReactDOM.findDOMNode(this).getBoundingClientRect().height;

            var top = (incomingCallBox.parentElement.getBoundingClientRect().top + window.pageYOffset);
            // Make sure we don't go too far up, if the headers aren't sticky
            top = (top < scrollAreaOffset) ? scrollAreaOffset : top;
            // make sure we don't go too far down, if the headers aren't sticky
            var bottomMargin = scrollAreaOffset + (scrollAreaHeight - 45);
            top = (top > bottomMargin) ? bottomMargin : top;

            incomingCallBox.style.top = top + "px";
            incomingCallBox.style.left = scrollArea.offsetLeft + scrollArea.offsetWidth + 12 + "px";
        }
    },

    // Doing the sticky headers as raw DOM, for speed, as it gets very stuttery if done
    // properly through React
    _initAndPositionStickyHeaders: function(initialise, scrollToPosition) {
        var scrollArea = this._getScrollNode();
        // Use the offset of the top of the scroll area from the window
        // as this is used to calculate the CSS fixed top position for the stickies
        var scrollAreaOffset = scrollArea.getBoundingClientRect().top + window.pageYOffset;
        // Use the offset of the top of the componet from the window
        // as this is used to calculate the CSS fixed top position for the stickies
        var scrollAreaHeight = ReactDOM.findDOMNode(this).getBoundingClientRect().height;

        if (initialise) {
            // Get a collection of sticky header containers references
            this.stickies = document.getElementsByClassName("mx_RoomSubList_labelContainer");

            if (!this.stickies.length) return;

            // Make sure there is sufficient space to do sticky headers: 120px plus all the sticky headers
            this.scrollAreaSufficient = (120 + (this.stickies[0].getBoundingClientRect().height * this.stickies.length)) < scrollAreaHeight;

            // Initialise the sticky headers
            if (typeof this.stickies === "object" && this.stickies.length > 0) {
                // Initialise the sticky headers
                Array.prototype.forEach.call(this.stickies, function(sticky, i) {
                    // Save the positions of all the stickies within scroll area.
                    // These positions are relative to the LHS Panel top
                    sticky.dataset.originalPosition = sticky.offsetTop - scrollArea.offsetTop;

                    // Save and set the sticky heights
                    var originalHeight = sticky.getBoundingClientRect().height;
                    sticky.dataset.originalHeight = originalHeight;
                    sticky.style.height = originalHeight;

                    return sticky;
                });
            }
        }

        var self = this;
        var scrollStuckOffset = 0;
        // Scroll to the passed in position, i.e. a header was clicked and in a scroll to state
        // rather than a collapsable one (see RoomSubList.isCollapsableOnClick method for details)
        if (scrollToPosition !== undefined) {
            scrollArea.scrollTop = scrollToPosition;
        }
        // Stick headers to top and bottom, or free them
        Array.prototype.forEach.call(this.stickies, function(sticky, i, stickyWrappers) {
            var stickyPosition = sticky.dataset.originalPosition;
            var stickyHeight = sticky.dataset.originalHeight;
            var stickyHeader = sticky.childNodes[0];
            var topStuckHeight = stickyHeight * i;
            var bottomStuckHeight = stickyHeight * (stickyWrappers.length - i);

            if (self.scrollAreaSufficient && stickyPosition < (scrollArea.scrollTop + topStuckHeight)) {
                // Top stickies
                sticky.dataset.stuck = "top";
                stickyHeader.classList.add("mx_RoomSubList_fixed");
                stickyHeader.style.top = scrollAreaOffset + topStuckHeight + "px";
                // If stuck at top adjust the scroll back down to take account of all the stuck headers
                if (scrollToPosition !== undefined && stickyPosition === scrollToPosition) {
                    scrollStuckOffset = topStuckHeight;
                }
            } else if (self.scrollAreaSufficient && stickyPosition > ((scrollArea.scrollTop + scrollAreaHeight) - bottomStuckHeight)) {
                /// Bottom stickies
                sticky.dataset.stuck = "bottom";
                stickyHeader.classList.add("mx_RoomSubList_fixed");
                stickyHeader.style.top = (scrollAreaOffset + scrollAreaHeight) - bottomStuckHeight + "px";
            } else {
                // Not sticky
                sticky.dataset.stuck = "none";
                stickyHeader.classList.remove("mx_RoomSubList_fixed");
                stickyHeader.style.top = null;
            }
        });
        // Adjust the scroll to take account of top stuck headers
        if (scrollToPosition !== undefined) {
            scrollArea.scrollTop -= scrollStuckOffset;
        }
    },

    _updateStickyHeaders: function(initialise, scrollToPosition) {
        var self = this;

        if (initialise) {
            // Useing setTimeout to ensure that the code is run after the painting
            // of the newly rendered object as using requestAnimationFrame caused
            // artefacts to appear on screen briefly
            window.setTimeout(function() {
                self._initAndPositionStickyHeaders(initialise, scrollToPosition);
            });
        } else {
            this._initAndPositionStickyHeaders(initialise, scrollToPosition);
        }
    },

    onShowMoreRooms: function() {
        // kick gemini in the balls to get it to wake up
        // XXX: uuuuuuugh.
        this.refs.gemscroll.forceUpdate();
    },

    render: function() {
        var RoomSubList = sdk.getComponent('structures.RoomSubList');
        var self = this;

        return (
            <GeminiScrollbar className="mx_RoomList_scrollbar"
                 autoshow={true} onScroll={ self._whenScrolling } ref="gemscroll">
            <div className="mx_RoomList">
                <RoomSubList list={ self.state.lists['im.vector.fake.invite'] }
                             label="Invites"
                             editable={ false }
                             order="recent"
                             selectedRoom={ self.props.selectedRoom }
                             incomingCall={ self.state.incomingCall }
                             collapsed={ self.props.collapsed }
                             searchFilter={ self.props.searchFilter }
                             onHeaderClick={ self.onSubListHeaderClick }
                             onShowMoreRooms={ self.onShowMoreRooms } />

                <RoomSubList list={ self.state.lists['m.favourite'] }
                             label="Favourites"
                             tagName="m.favourite"
                             verb="favourite"
                             editable={ true }
                             order="manual"
                             selectedRoom={ self.props.selectedRoom }
                             incomingCall={ self.state.incomingCall }
                             collapsed={ self.props.collapsed }
                             searchFilter={ self.props.searchFilter }
                             onHeaderClick={ self.onSubListHeaderClick }
                             onShowMoreRooms={ self.onShowMoreRooms } />

                <RoomSubList list={ self.state.lists['im.vector.fake.direct'] }
                             label="People"
                             editable={ false }
                             order="recent"
                             selectedRoom={ self.props.selectedRoom }
                             incomingCall={ self.state.incomingCall }
                             collapsed={ self.props.collapsed }
                             searchFilter={ self.props.searchFilter }
                             onHeaderClick={ self.onSubListHeaderClick }
                             onShowMoreRooms={ self.onShowMoreRooms } />

                <RoomSubList list={ self.state.lists['im.vector.fake.recent'] }
                             label="Rooms"
                             editable={ true }
                             verb="restore"
                             order="recent"
                             selectedRoom={ self.props.selectedRoom }
                             incomingCall={ self.state.incomingCall }
                             collapsed={ self.props.collapsed }
                             searchFilter={ self.props.searchFilter }
                             onHeaderClick={ self.onSubListHeaderClick }
                             onShowMoreRooms={ self.onShowMoreRooms } />

                { Object.keys(self.state.lists).map(function(tagName) {
                    if (!tagName.match(/^(m\.(favourite|lowpriority)|im\.vector\.fake\.(invite|recent|direct|archived))$/)) {
                        return <RoomSubList list={ self.state.lists[tagName] }
                             key={ tagName }
                             label={ tagName }
                             tagName={ tagName }
                             verb={ "tag as " + tagName }
                             editable={ true }
                             order="manual"
                             selectedRoom={ self.props.selectedRoom }
                             incomingCall={ self.state.incomingCall }
                             collapsed={ self.props.collapsed }
                             searchFilter={ self.props.searchFilter }
                             onHeaderClick={ self.onSubListHeaderClick }
                             onShowMoreRooms={ self.onShowMoreRooms } />;

                    }
                }) }

                <RoomSubList list={ self.state.lists['m.lowpriority'] }
                             label="Low priority"
                             tagName="m.lowpriority"
                             verb="demote"
                             editable={ true }
                             order="recent"
                             selectedRoom={ self.props.selectedRoom }
                             incomingCall={ self.state.incomingCall }
                             collapsed={ self.props.collapsed }
                             searchFilter={ self.props.searchFilter }
                             onHeaderClick={ self.onSubListHeaderClick }
                             onShowMoreRooms={ self.onShowMoreRooms } />

                <RoomSubList list={ self.state.lists['im.vector.fake.archived'] }
                             label="Historical"
                             editable={ false }
                             order="recent"
                             selectedRoom={ self.props.selectedRoom }
                             collapsed={ self.props.collapsed }
                             alwaysShowHeader={ true }
                             startAsHidden={ true }
                             showSpinner={ self.state.isLoadingLeftRooms }
                             onHeaderClick= { self.onArchivedHeaderClick }
                             incomingCall={ self.state.incomingCall }
                             searchFilter={ self.props.searchFilter }
                             onShowMoreRooms={ self.onShowMoreRooms } />
            </div>
            </GeminiScrollbar>
        );
    }
});
