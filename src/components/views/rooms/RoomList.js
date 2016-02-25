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

var HIDE_CONFERENCE_CHANS = true;

module.exports = React.createClass({
    displayName: 'RoomList',

    propTypes: {
        ConferenceHandler: React.PropTypes.any,
        collapsed: React.PropTypes.bool,
        currentRoom: React.PropTypes.string
    },

    getInitialState: function() {
        return {
            isLoadingLeftRooms: false,
            lists: {},
            incomingCall: null,
        }
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

        var s = this.getRoomLists();
        this.setState(s);
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'view_tooltip':
                this.tooltip = payload.tooltip;
                this._repositionTooltip();
                if (this.tooltip) this.tooltip.style.display = 'block';
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
        }
    },

    onRoom: function(room) {
        this._delayedRefreshRoomList();
    },

    onDeleteRoom: function(roomId) {
        this._delayedRefreshRoomList();
    },

    onArchivedHeaderClick: function(isHidden) {
        if (!isHidden) {
            var self = this;
            this.setState({ isLoadingLeftRooms: true });
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

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (toStartOfTimeline) return;
        this._delayedRefreshRoomList();
    },

    onRoomReceipt: function(receiptEvent, room) {
        // because if we read a notification, it will affect notification count
        // only bother updating if there's a receipt from us
        var receiptKeys = Object.keys(receiptEvent.getContent());
        for (var i = 0; i < receiptKeys.length; ++i) {
            var rcpt = receiptEvent.getContent()[receiptKeys[i]];
            if (rcpt['m.read'] && rcpt['m.read'][MatrixClientPeg.get().credentials.userId]) {
                this._delayedRefreshRoomList();
                break;
            }
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
        s.lists["m.lowpriority"] = [];
        s.lists["im.vector.fake.archived"] = [];

        MatrixClientPeg.get().getRooms().forEach(function(room) {
            var me = room.getMember(MatrixClientPeg.get().credentials.userId);

            if (me && me.membership == "invite") {
                s.lists["im.vector.fake.invite"].push(room);
            }
            else if (me && me.membership === "leave") {
                s.lists["im.vector.fake.archived"].push(room);
            }
            else {
                var shouldShowRoom =  (
                    me && (me.membership == "join" || me.membership === "ban")
                );

                // hiding conf rooms only ever toggles shouldShowRoom to false
                if (shouldShowRoom && HIDE_CONFERENCE_CHANS) {
                    // we want to hide the 1:1 conf<->user room and not the group chat
                    var joinedMembers = room.getJoinedMembers();
                    if (joinedMembers.length === 2) {
                        var otherMember = joinedMembers.filter(function(m) {
                            return m.userId !== me.userId
                        })[0];
                        var ConfHandler = self.props.ConferenceHandler;
                        if (ConfHandler && ConfHandler.isConferenceUser(otherMember.userId)) {
                            // console.log("Hiding conference 1:1 room %s", room.roomId);
                            shouldShowRoom = false;
                        }
                    }
                }

                if (shouldShowRoom) {
                    var tagNames = Object.keys(room.tags);
                    if (tagNames.length) {
                        for (var i = 0; i < tagNames.length; i++) {
                            var tagName = tagNames[i];
                            s.lists[tagName] = s.lists[tagName] || [];
                            s.lists[tagNames[i]].push(room);
                        }
                    }
                    else {
                        s.lists["im.vector.fake.recent"].push(room); 
                    }
                }
            }
        });

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

    _repositionTooltips: function(e) {
        this._repositionTooltip(e);
        this._repositionIncomingCallBox(e, false);
    },

    _repositionTooltip: function(e) {
        if (this.tooltip && this.tooltip.parentElement) {
            var scroll = ReactDOM.findDOMNode(this);
            this.tooltip.style.top = (scroll.parentElement.offsetTop + this.tooltip.parentElement.offsetTop - this._getScrollNode().scrollTop) + "px"; 
        }
    },

    _repositionIncomingCallBox: function(e, firstTime) {
        var incomingCallBox = document.getElementById("incomingCallBox");
        if (incomingCallBox && incomingCallBox.parentElement) {
            var scroll = this._getScrollNode();
            var top = (scroll.offsetTop + incomingCallBox.parentElement.offsetTop - scroll.scrollTop);

            if (firstTime) {
                // scroll to make sure the callbox is on the screen...
                if (top < 10) { // 10px of vertical margin at top of screen
                    scroll.scrollTop = incomingCallBox.parentElement.offsetTop - 10;
                }
                else if (top > scroll.clientHeight - incomingCallBox.offsetHeight + 50) {
                    scroll.scrollTop = incomingCallBox.parentElement.offsetTop - scroll.offsetHeight + incomingCallBox.offsetHeight - 50;
                }
                // recalculate top in case we clipped it.
                top = (scroll.offsetTop + incomingCallBox.parentElement.offsetTop - scroll.scrollTop);
            }
            else {
                // stop the box from scrolling off the screen
                if (top < 10) {
                    top = 10;
                }
                else if (top > scroll.clientHeight - incomingCallBox.offsetHeight + 50) {
                    top = scroll.clientHeight - incomingCallBox.offsetHeight + 50;
                }
            }

            // slightly ugly hack to offset if there's a toolbar present.
            // we really should be calculating our absolute offsets of top by recursing through the DOM
            toolbar = document.getElementsByClassName("mx_MatrixToolbar")[0];
            if (toolbar) {
                top += toolbar.offsetHeight;
            }

            incomingCallBox.style.top = top + "px";
            incomingCallBox.style.left = scroll.offsetLeft + scroll.offsetWidth + "px";
        }
    },

    onShowClick: function() {
        dis.dispatch({
            action: 'show_left_panel',
        });
    },

    onShowMoreRooms: function() {
        // kick gemini in the balls to get it to wake up
        // XXX: uuuuuuugh.
        this.refs.gemscroll.forceUpdate();
    },

    render: function() {
        var expandButton = this.props.collapsed ? 
                           <img className="mx_RoomList_expandButton" onClick={ this.onShowClick } src="img/menu.png" width="20" alt=">"/> :
                           null;

        var RoomSubList = sdk.getComponent('structures.RoomSubList');
        var self = this;

        return (
            <GeminiScrollbar className="mx_RoomList_scrollbar" autoshow={true} onScroll={ self._repositionTooltips } ref="gemscroll">
            <div className="mx_RoomList">
                { expandButton }

                <RoomSubList list={ self.state.lists['im.vector.fake.invite'] }
                             label="Invites"
                             editable={ false }
                             order="recent"
                             selectedRoom={ self.props.selectedRoom }
                             incomingCall={ self.state.incomingCall }
                             collapsed={ self.props.collapsed }
                             onShowMoreRooms={ this.onShowMoreRooms } />

                <RoomSubList list={ self.state.lists['m.favourite'] }
                             label="Favourites"
                             tagName="m.favourite"
                             verb="favourite"
                             editable={ true }
                             order="manual"
                             selectedRoom={ self.props.selectedRoom }
                             incomingCall={ self.state.incomingCall }
                             collapsed={ self.props.collapsed }
                             onShowMoreRooms={ this.onShowMoreRooms } />

                <RoomSubList list={ self.state.lists['im.vector.fake.recent'] }
                             label="Rooms"
                             editable={ true }
                             verb="restore"
                             order="recent"
                             selectedRoom={ self.props.selectedRoom }
                             incomingCall={ self.state.incomingCall }
                             collapsed={ self.props.collapsed }
                             onShowMoreRooms={ this.onShowMoreRooms } />

                { Object.keys(self.state.lists).map(function(tagName) {
                    if (!tagName.match(/^(m\.(favourite|lowpriority)|im\.vector\.fake\.(invite|recent|archived))$/)) {
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
                             onShowMoreRooms={ self.onShowMoreRooms } />

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
                             onShowMoreRooms={ this.onShowMoreRooms } />

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
                             onShowMoreRooms={ this.onShowMoreRooms } />
            </div>
            </GeminiScrollbar>
        );
    }
});
