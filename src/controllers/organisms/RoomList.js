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
var MatrixClientPeg = require("matrix-react-sdk/lib/MatrixClientPeg");
var RoomListSorter = require("matrix-react-sdk/lib/RoomListSorter");
var dis = require("matrix-react-sdk/lib/dispatcher");

var sdk = require('matrix-react-sdk');
var VectorConferenceHandler = require("../../modules/VectorConferenceHandler");
var CallHandler = require("matrix-react-sdk/lib/CallHandler");

var HIDE_CONFERENCE_CHANS = true;

module.exports = {
    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("Room", this.onRoom);
        cli.on("Room.timeline", this.onRoomTimeline);
        cli.on("Room.name", this.onRoomName);
        cli.on("RoomState.events", this.onRoomStateEvents);

        var s = this.getRoomLists();
        s.activityMap = {};
        this.setState(s);
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    onAction: function(payload) {
        switch (payload.action) {
            // listen for call state changes to prod the render method, which
            // may hide the global CallView if the call it is tracking is dead
            case 'call_state':
                this._recheckCallElement(this.props.selectedRoom);
                break;
            case 'view_tooltip':
                this.tooltip = payload.tooltip;
                this._repositionTooltip();
                if (this.tooltip) this.tooltip.style.display = 'block';
                break
        }
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room", this.onRoom);
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
            MatrixClientPeg.get().removeListener("Room.name", this.onRoomName);
            MatrixClientPeg.get().removeListener("RoomState.events", this.onRoomStateEvents);
        }
    },

    componentWillReceiveProps: function(newProps) {
        this.state.activityMap[newProps.selectedRoom] = undefined;
        this._recheckCallElement(newProps.selectedRoom);
        this.setState({
            activityMap: this.state.activityMap
        });
    },

    onRoom: function(room) {
        this.refreshRoomList();
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (toStartOfTimeline) return;

        var newState = this.getRoomLists();
        if (
            room.roomId != this.props.selectedRoom &&
            ev.getSender() != MatrixClientPeg.get().credentials.userId)
        {
            var hl = 1;

            var actions = MatrixClientPeg.get().getPushActionsForEvent(ev);
            if (actions && actions.tweaks && actions.tweaks.highlight) {
                hl = 2;
            }
            // obviously this won't deep copy but this shouldn't be necessary
            var amap = this.state.activityMap;
            amap[room.roomId] = Math.max(amap[room.roomId] || 0, hl);

            newState.activityMap = amap;
        }
        this.setState(newState);
    },

    onRoomName: function(room) {
        this.refreshRoomList();
    },

    onRoomStateEvents: function(ev, state) {
        setTimeout(this.refreshRoomList, 0);
    },


    refreshRoomList: function() {
        this.setState(this.getRoomLists());
    },

    getRoomLists: function() {
        var s = {};
        var inviteList = [];
        s.roomList = RoomListSorter.mostRecentActivityFirst(
            MatrixClientPeg.get().getRooms().filter(function(room) {
                var me = room.getMember(MatrixClientPeg.get().credentials.userId);

                if (me && me.membership == "invite") {
                    inviteList.push(room);
                    return false;
                }

                var shouldShowRoom =  (
                    me && (me.membership == "join")
                );
                // hiding conf rooms only ever toggles shouldShowRoom to false
                if (shouldShowRoom && HIDE_CONFERENCE_CHANS) {
                    // we want to hide the 1:1 conf<->user room and not the group chat
                    var joinedMembers = room.getJoinedMembers();
                    if (joinedMembers.length === 2) {
                        var otherMember = joinedMembers.filter(function(m) {
                            return m.userId !== me.userId
                        })[0];
                        if (VectorConferenceHandler.isConferenceUser(otherMember)) {
                            // console.log("Hiding conference 1:1 room %s", room.roomId);
                            shouldShowRoom = false;
                        }
                    }
                }
                return shouldShowRoom;
            })
        );
        s.inviteList = RoomListSorter.mostRecentActivityFirst(inviteList);
        return s;
    },

    _recheckCallElement: function(selectedRoomId) {
        // if we aren't viewing a room with an ongoing call, but there is an
        // active call, show the call element - we need to do this to make
        // audio/video not crap out
        var activeCall = CallHandler.getAnyActiveCall();
        var callForRoom = CallHandler.getCallForRoom(selectedRoomId);
        var showCall = (activeCall && !callForRoom);
        this.setState({
            show_call_element: showCall
        });
    },

    _repositionTooltip: function(e) {
        if (this.tooltip && this.tooltip.parentElement) {
            var scroll = this.getDOMNode();
            this.tooltip.style.top = (scroll.parentElement.offsetTop + this.tooltip.parentElement.offsetTop - scroll.scrollTop) + "px"; 
        }
    },

    makeRoomTiles: function(list, isInvite) {
        var self = this;
        var RoomTile = sdk.getComponent("molecules.RoomTile");
        return list.map(function(room) {
            var selected = room.roomId == self.props.selectedRoom;
            return (
                <RoomTile
                    room={room}
                    key={room.roomId}
                    collapsed={self.props.collapsed}
                    selected={selected}
                    unread={self.state.activityMap[room.roomId] === 1}
                    highlight={self.state.activityMap[room.roomId] === 2}
                    isInvite={isInvite}
                />
            );
        });
    }
};
