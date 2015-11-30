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

var Matrix = require("matrix-js-sdk");
var MatrixClientPeg = require("matrix-react-sdk/lib/MatrixClientPeg");
var React = require("react");
var ReactDOM = require("react-dom");
var q = require("q");
var ContentMessages = require("matrix-react-sdk/lib//ContentMessages");
var WhoIsTyping = require("matrix-react-sdk/lib/WhoIsTyping");
var Modal = require("matrix-react-sdk/lib/Modal");
var sdk = require('matrix-react-sdk/lib/index');
var CallHandler = require('matrix-react-sdk/lib/CallHandler');
var VectorConferenceHandler = require('../../modules/VectorConferenceHandler');
var Resend = require("../../Resend");

var dis = require("matrix-react-sdk/lib/dispatcher");

var PAGINATE_SIZE = 20;
var INITIAL_SIZE = 20;

module.exports = {
    getInitialState: function() {
        var room = this.props.roomId ? MatrixClientPeg.get().getRoom(this.props.roomId) : null;
        return {
            room: room,
            messageCap: INITIAL_SIZE,
            editingRoomSettings: false,
            uploadingRoomSettings: false,
            numUnreadMessages: 0,
            draggingFile: false,
            searching: false,
            searchResults: null,
            syncState: MatrixClientPeg.get().getSyncState(),
            hasUnsentMessages: this._hasUnsentMessages(room)
        }
    },

    componentWillMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        MatrixClientPeg.get().on("Room.name", this.onRoomName);
        MatrixClientPeg.get().on("Room.receipt", this.onRoomReceipt);
        MatrixClientPeg.get().on("RoomMember.typing", this.onRoomMemberTyping);
        MatrixClientPeg.get().on("RoomState.members", this.onRoomStateMember);
        MatrixClientPeg.get().on("sync", this.onSyncStateChange);
        this.atBottom = true;
    },

    componentWillUnmount: function() {
        if (this.refs.messagePanel) {
            var messagePanel = ReactDOM.findDOMNode(this.refs.messagePanel);
            messagePanel.removeEventListener('drop', this.onDrop);
            messagePanel.removeEventListener('dragover', this.onDragOver);
            messagePanel.removeEventListener('dragleave', this.onDragLeaveOrEnd);
            messagePanel.removeEventListener('dragend', this.onDragLeaveOrEnd);
        }
        dis.unregister(this.dispatcherRef);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
            MatrixClientPeg.get().removeListener("Room.name", this.onRoomName);
            MatrixClientPeg.get().removeListener("Room.receipt", this.onRoomReceipt);
            MatrixClientPeg.get().removeListener("RoomMember.typing", this.onRoomMemberTyping);
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
            MatrixClientPeg.get().removeListener("sync", this.onSyncStateChange);
        }
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'message_send_failed':
            case 'message_sent':
                this.setState({
                    hasUnsentMessages: this._hasUnsentMessages(this.state.room)
                });
            case 'message_resend_started':
                this.setState({
                    room: MatrixClientPeg.get().getRoom(this.props.roomId)
                });
                this.forceUpdate();
                break;
            case 'notifier_enabled':
                this.forceUpdate();
                break;
            case 'call_state':
                if (CallHandler.getCallForRoom(this.props.roomId)) {
                    // Call state has changed so we may be loading video elements
                    // which will obscure the message log.
                    // scroll to bottom
                    var scrollNode = this._getScrollNode();
                    if (scrollNode) {
                        scrollNode.scrollTop = scrollNode.scrollHeight;
                    }
                }

                // possibly remove the conf call notification if we're now in
                // the conf
                this._updateConfCallNotification();
                break;
            case 'user_activity':
                this.sendReadReceipt();
                break;
        }
    },

    _getScrollNode: function() {
        var panel = ReactDOM.findDOMNode(this.refs.messagePanel);
        if (!panel) return null;

        if (panel.classList.contains('gm-prevented')) {
            return panel;
        } else {
            return panel.children[2]; // XXX: Fragile!
        }
    },

    onSyncStateChange: function(state) {
        this.setState({
            syncState: state
        });
    },

    // MatrixRoom still showing the messages from the old room?
    // Set the key to the room_id. Sadly you can no longer get at
    // the key from inside the component, or we'd check this in code.
    /*componentWillReceiveProps: function(props) {
    },*/

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (!this.isMounted()) return;

        // ignore anything that comes in whilst paginating: we get one
        // event for each new matrix event so this would cause a huge
        // number of UI updates. Just update the UI when the paginate
        // call returns.
        if (this.state.paginating) return;

        // no point handling anything while we're waiting for the join to finish:
        // we'll only be showing a spinner.
        if (this.state.joining) return;
        if (room.roomId != this.props.roomId) return;

        var scrollNode = this._getScrollNode();
        if (scrollNode) {
            this.atBottom = (
                scrollNode.scrollHeight - scrollNode.scrollTop <=
                (scrollNode.clientHeight + 150) // 150?
            );
        }

        var currentUnread = this.state.numUnreadMessages;
        if (!toStartOfTimeline &&
                (ev.getSender() !== MatrixClientPeg.get().credentials.userId)) {
            // update unread count when scrolled up
            if (this.atBottom) {
                currentUnread = 0;
            }
            else {
                currentUnread += 1;
            }
        }


        this.setState({
            room: MatrixClientPeg.get().getRoom(this.props.roomId),
            numUnreadMessages: currentUnread
        });

        if (toStartOfTimeline && !this.state.paginating) {
            this.fillSpace();
        }
    },

    onRoomName: function(room) {
        if (room.roomId == this.props.roomId) {
            this.setState({
                room: room
            });
        }
    },

    onRoomReceipt: function(receiptEvent, room) {
        if (room.roomId == this.props.roomId) {
            this.forceUpdate();
        }
    },

    onRoomMemberTyping: function(ev, member) {
        this.forceUpdate();
    },

    onRoomStateMember: function(ev, state, member) {
        if (member.roomId !== this.props.roomId ||
                member.userId !== VectorConferenceHandler.getConferenceUserIdForRoom(member.roomId)) {
            return;
        }
        this._updateConfCallNotification();
    },

    _hasUnsentMessages: function(room) {
        return this._getUnsentMessages(room).length > 0;
    },

    _getUnsentMessages: function(room) {
        if (!room) { return []; }
        // TODO: It would be nice if the JS SDK provided nicer constant-time
        // constructs rather than O(N) (N=num msgs) on this.
        return room.timeline.filter(function(ev) {
            return ev.status === Matrix.EventStatus.NOT_SENT;
        });
    },

    _updateConfCallNotification: function() {
        var room = MatrixClientPeg.get().getRoom(this.props.roomId);
        if (!room) return;
        var confMember = room.getMember(
            VectorConferenceHandler.getConferenceUserIdForRoom(this.props.roomId)
        );

        if (!confMember) {
            return;
        }
        var confCall = VectorConferenceHandler.getConferenceCallForRoom(confMember.roomId);

        // A conf call notification should be displayed if there is an ongoing
        // conf call but this cilent isn't a part of it.
        this.setState({
            displayConfCallNotification: (
                (!confCall || confCall.call_state === "ended") &&
                confMember.membership === "join"
            )
        });
    },

    componentDidMount: function() {
        if (this.refs.messagePanel) {
            var messagePanel = ReactDOM.findDOMNode(this.refs.messagePanel);

            messagePanel.addEventListener('drop', this.onDrop);
            messagePanel.addEventListener('dragover', this.onDragOver);
            messagePanel.addEventListener('dragleave', this.onDragLeaveOrEnd);
            messagePanel.addEventListener('dragend', this.onDragLeaveOrEnd);

            var messageWrapperScroll = this._getScrollNode();

            messageWrapperScroll.scrollTop = messageWrapperScroll.scrollHeight;

            this.sendReadReceipt();

            this.fillSpace();
        }

        this._updateConfCallNotification();
    },

    componentDidUpdate: function() {
        if (!this.refs.messagePanel) return;

        var messageWrapperScroll = this._getScrollNode();

        if (this.state.paginating && !this.waiting_for_paginate) {
            var heightGained = messageWrapperScroll.scrollHeight - this.oldScrollHeight;
            messageWrapperScroll.scrollTop += heightGained;
            this.oldScrollHeight = undefined;
            if (!this.fillSpace()) {
                this.setState({paginating: false});
            }
        } else if (this.atBottom) {
            messageWrapperScroll.scrollTop = messageWrapperScroll.scrollHeight;
            if (this.state.numUnreadMessages !== 0) {
                this.setState({numUnreadMessages: 0});
            }
        }
    },

    fillSpace: function() {
        if (!this.refs.messagePanel) return;
        if (this.state.searchResults) return; // TODO: paginate search results
        var messageWrapperScroll = this._getScrollNode();
        if (messageWrapperScroll.scrollTop < messageWrapperScroll.clientHeight && this.state.room.oldState.paginationToken) {
            this.setState({paginating: true});

            this.oldScrollHeight = messageWrapperScroll.scrollHeight;

            if (this.state.messageCap < this.state.room.timeline.length) {
                this.waiting_for_paginate = false;
                var cap = Math.min(this.state.messageCap + PAGINATE_SIZE, this.state.room.timeline.length);
                this.setState({messageCap: cap, paginating: true});
            } else {
                this.waiting_for_paginate = true;
                var cap = this.state.messageCap + PAGINATE_SIZE;
                this.setState({messageCap: cap, paginating: true});
                var self = this;
                MatrixClientPeg.get().scrollback(this.state.room, PAGINATE_SIZE).finally(function() {
                    self.waiting_for_paginate = false;
                    if (self.isMounted()) {
                        self.setState({
                            room: MatrixClientPeg.get().getRoom(self.props.roomId)
                        });
                    }
                    // wait and set paginating to false when the component updates
                });
            }

            return true;
        }
        return false;
    },

    onResendAllClick: function() {
        var eventsToResend = this._getUnsentMessages(this.state.room);
        eventsToResend.forEach(function(event) {
            Resend.resend(event);
        });
    },

    onJoinButtonClicked: function(ev) {
        var self = this;
        MatrixClientPeg.get().joinRoom(this.props.roomId).then(function() {
            self.setState({
                joining: false,
                room: MatrixClientPeg.get().getRoom(self.props.roomId)
            });
        }, function(error) {
            self.setState({
                joining: false,
                joinError: error
            });
        });
        this.setState({
            joining: true
        });
    },

    onMessageListScroll: function(ev) {
        if (this.refs.messagePanel) {
            var messageWrapperScroll = this._getScrollNode();
            var wasAtBottom = this.atBottom;
            this.atBottom = messageWrapperScroll.scrollHeight - messageWrapperScroll.scrollTop <= messageWrapperScroll.clientHeight + 1;
            if (this.atBottom && !wasAtBottom) {
                this.forceUpdate(); // remove unread msg count
            }
        }
        if (!this.state.paginating) this.fillSpace();
    },

    onDragOver: function(ev) {
        ev.stopPropagation();
        ev.preventDefault();

        ev.dataTransfer.dropEffect = 'none';

        var items = ev.dataTransfer.items;
        if (items.length == 1) {
            if (items[0].kind == 'file') {
                this.setState({ draggingFile : true });
                ev.dataTransfer.dropEffect = 'copy';
            }
        }
    },

    onDrop: function(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.setState({ draggingFile : false });
        var files = ev.dataTransfer.files;
        if (files.length == 1) {
            this.uploadFile(files[0]);
        }
    },

    onDragLeaveOrEnd: function(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.setState({ draggingFile : false });
    },

    uploadFile: function(file) {
        this.setState({
            upload: {
                fileName: file.name,
                uploadedBytes: 0,
                totalBytes: file.size
            }
        });
        var self = this;
        ContentMessages.sendContentToRoom(
            file, this.props.roomId, MatrixClientPeg.get()
        ).progress(function(ev) {
            //console.log("Upload: "+ev.loaded+" / "+ev.total);
            self.setState({
                upload: {
                    fileName: file.name,
                    uploadedBytes: ev.loaded,
                    totalBytes: ev.total
                }
            });
        }).finally(function() {
            self.setState({
                upload: undefined
            });
        }).done(undefined, function(error) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Failed to upload file",
                description: error.toString()
            });
        });
    },

    getWhoIsTypingString: function() {
        return WhoIsTyping.whoIsTypingString(this.state.room);
    },

    onSearch: function(term, scope) {
        var filter;
        if (scope === "Room") {
            filter = {
                // XXX: it's unintuitive that the filter for searching doesn't have the same shape as the v2 filter API :(
                rooms: [
                    this.props.roomId
                ]
            };
        }

        var self = this;
        MatrixClientPeg.get().search({
            body: {
                search_categories: {
                    room_events: {
                        search_term: term,
                        filter: filter,
                        order_by: "recent",
                        include_state: true,
                        groupings: {
                            group_by: [
                                {
                                    key: "room_id"
                                }
                            ]
                        },
                        event_context: {
                            before_limit: 1,
                            after_limit: 1,
                            include_profile: true,
                        }
                    }
                }
            }            
        }).then(function(data) {
            // for debugging:
            // data.search_categories.room_events.highlights = ["hello", "everybody"];

            var highlights;
            if (data.search_categories.room_events.highlights &&
                data.search_categories.room_events.highlights.length > 0)
            {
                // postgres on synapse returns us precise details of the
                // strings which actually got matched for highlighting.
                // for overlapping highlights, favour longer (more specific) terms first
                highlights = data.search_categories.room_events.highlights
                             .sort(function(a, b) { b.length - a.length });
            }
            else {
                // sqlite doesn't, so just try to highlight the literal search term
                highlights = [ term ];
            }

            self.setState({
                highlights: highlights,
                searchResults: data,
                searchScope: scope,
            });
        }, function(error) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Search failed",
                description: error.toString()
            });
        });
    },

    getEventTiles: function() {
        var DateSeparator = sdk.getComponent('molecules.DateSeparator');
        var cli = MatrixClientPeg.get();

        var ret = [];
        var count = 0;

        var EventTile = sdk.getComponent('rooms.EventTile');
        var self = this;

        if (this.state.searchResults &&
            this.state.searchResults.search_categories.room_events.results &&
            this.state.searchResults.search_categories.room_events.groups)
        {
            // XXX: this dance is foul, due to the results API not directly returning sorted results
            var results = this.state.searchResults.search_categories.room_events.results;
            var roomIdGroups = this.state.searchResults.search_categories.room_events.groups.room_id;

            Object.keys(roomIdGroups)
                  .sort(function(a, b) { roomIdGroups[a].order - roomIdGroups[b].order }) // WHY NOT RETURN AN ORDERED ARRAY?!?!?!
                  .forEach(function(roomId)
            {
                // XXX: todo: merge overlapping results somehow?
                // XXX: why doesn't searching on name work?
                if (self.state.searchScope === 'All') {
                    ret.push(<li key={ roomId }><h1>Room: { cli.getRoom(roomId).name }</h1></li>);
                }

                var resultList = roomIdGroups[roomId].results.map(function(eventId) { return results[eventId]; });
                for (var i = resultList.length - 1; i >= 0; i--) {
                    var ts1 = resultList[i].result.origin_server_ts;
                    ret.push(<li key={ts1 + "-search"}><DateSeparator ts={ts1}/></li>); // Rank: {resultList[i].rank}
                    var mxEv = new Matrix.MatrixEvent(resultList[i].result);
                    if (resultList[i].context.events_before[0]) {
                        var mxEv2 = new Matrix.MatrixEvent(resultList[i].context.events_before[0]);
                        if (EventTile.haveTileForEvent(mxEv2)) {
                            ret.push(<li key={mxEv.getId() + "-1"}><EventTile mxEvent={mxEv2} contextual={true} /></li>);
                        }
                    }
                    if (EventTile.haveTileForEvent(mxEv)) {
                        ret.push(<li key={mxEv.getId() + "+0"}><EventTile mxEvent={mxEv} highlights={self.state.highlights}/></li>);
                    }
                    if (resultList[i].context.events_after[0]) {
                        var mxEv2 = new Matrix.MatrixEvent(resultList[i].context.events_after[0]);
                        if (EventTile.haveTileForEvent(mxEv2)) {
                            ret.push(<li key={mxEv.getId() + "+1"}><EventTile mxEvent={mxEv2} contextual={true} /></li>);
                        }
                    }
                }
            });
            return ret;
        }

        for (var i = this.state.room.timeline.length-1; i >= 0 && count < this.state.messageCap; --i) {
            var mxEv = this.state.room.timeline[i];

            if (!EventTile.haveTileForEvent(mxEv)) {
                continue;
            }

            var continuation = false;
            var last = false;
            var dateSeparator = null;
            if (i == this.state.room.timeline.length - 1) {
                last = true;
            }
            if (i > 0 && count < this.state.messageCap - 1) {
                if (this.state.room.timeline[i].sender &&
                    this.state.room.timeline[i - 1].sender &&
                    (this.state.room.timeline[i].sender.userId ===
                        this.state.room.timeline[i - 1].sender.userId) &&
                    (this.state.room.timeline[i].getType() ==
                        this.state.room.timeline[i - 1].getType())
                    )
                {
                    continuation = true;
                }

                var ts0 = this.state.room.timeline[i - 1].getTs();
                var ts1 = this.state.room.timeline[i].getTs();
                if (new Date(ts0).toDateString() !== new Date(ts1).toDateString()) {
                    dateSeparator = <li key={ts1}><DateSeparator key={ts1} ts={ts1}/></li>;
                    continuation = false;
                }
            }

            if (i === 1) { // n.b. 1, not 0, as the 0th event is an m.room.create and so doesn't show on the timeline
                var ts1 = this.state.room.timeline[i].getTs();
                dateSeparator = <li key={ts1}><DateSeparator ts={ts1}/></li>;
                continuation = false;
            }

            ret.unshift(
                <li key={mxEv.getId()} ref={this._collectEventNode.bind(this, mxEv.getId())}><EventTile mxEvent={mxEv} continuation={continuation} last={last}/></li>
            );
            if (dateSeparator) {
                ret.unshift(dateSeparator);
            }
            ++count;
        }
        return ret;
    },

    uploadNewState: function(new_name, new_topic, new_join_rule, new_history_visibility, new_power_levels) {
        var old_name = this.state.room.name;

        var old_topic = this.state.room.currentState.getStateEvents('m.room.topic', '');
        if (old_topic) {
            old_topic = old_topic.getContent().topic;
        } else {
            old_topic = "";
        }

        var old_join_rule = this.state.room.currentState.getStateEvents('m.room.join_rules', '');
        if (old_join_rule) {
            old_join_rule = old_join_rule.getContent().join_rule;
        } else {
            old_join_rule = "invite";
        }

        var old_history_visibility = this.state.room.currentState.getStateEvents('m.room.history_visibility', '');
        if (old_history_visibility) {
            old_history_visibility = old_history_visibility.getContent().history_visibility;
        } else {
            old_history_visibility = "shared";
        }

        var deferreds = [];

        if (old_name != new_name && new_name != undefined && new_name) {
            deferreds.push(
                MatrixClientPeg.get().setRoomName(this.state.room.roomId, new_name)
            );
        }

        if (old_topic != new_topic && new_topic != undefined) {
            deferreds.push(
                MatrixClientPeg.get().setRoomTopic(this.state.room.roomId, new_topic)
            );
        }

        if (old_join_rule != new_join_rule && new_join_rule != undefined) {
            deferreds.push(
                MatrixClientPeg.get().sendStateEvent(
                    this.state.room.roomId, "m.room.join_rules", {
                        join_rule: new_join_rule,
                    }, ""
                )
            );
        }

        if (old_history_visibility != new_history_visibility && new_history_visibility != undefined) {
            deferreds.push(
                MatrixClientPeg.get().sendStateEvent(
                    this.state.room.roomId, "m.room.history_visibility", {
                        history_visibility: new_history_visibility,
                    }, ""
                )
            );
        }

        if (new_power_levels) {
            deferreds.push(
                MatrixClientPeg.get().sendStateEvent(
                    this.state.room.roomId, "m.room.power_levels", new_power_levels, ""
                )
            );
        }

        if (deferreds.length) {
            var self = this;
            q.all(deferreds).fail(function(err) {
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Failed to set state",
                    description: err.toString()
                });
            }).finally(function() {
                self.setState({
                    uploadingRoomSettings: false,
                });
            });
        } else {
            this.setState({
                editingRoomSettings: false,
                uploadingRoomSettings: false,
            });
        }
    },

    _collectEventNode: function(eventId, node) {
        if (this.eventNodes == undefined) this.eventNodes = {};
        this.eventNodes[eventId] = node;
    },

    _indexForEventId(evId) {
        for (var i = 0; i < this.state.room.timeline.length; ++i) {
            if (evId == this.state.room.timeline[i].getId()) {
                return i;
            }
        }
        return null;
    },

    sendReadReceipt: function() {
        if (!this.state.room) return;
        var currentReadUpToEventId = this.state.room.getEventReadUpTo(MatrixClientPeg.get().credentials.userId);
        var currentReadUpToEventIndex = this._indexForEventId(currentReadUpToEventId);

        var lastReadEventIndex = this._getLastDisplayedEventIndexIgnoringOwn();
        if (lastReadEventIndex === null) return;

        if (lastReadEventIndex > currentReadUpToEventIndex) {
            MatrixClientPeg.get().sendReadReceipt(this.state.room.timeline[lastReadEventIndex]);
        }
    },

    _getLastDisplayedEventIndexIgnoringOwn: function() {
        if (this.eventNodes === undefined) return null;

        var messageWrapper = this.refs.messagePanel;
        if (messageWrapper === undefined) return null;
        var wrapperRect = ReactDOM.findDOMNode(messageWrapper).getBoundingClientRect();

        for (var i = this.state.room.timeline.length-1; i >= 0; --i) {
            var ev = this.state.room.timeline[i];

            if (ev.sender && ev.sender.userId == MatrixClientPeg.get().credentials.userId) {
                continue;
            }

            var node = this.eventNodes[ev.getId()];
            if (!node) continue;

            var boundingRect = node.getBoundingClientRect();

            if (boundingRect.bottom < wrapperRect.bottom) {
                return i;
            }
        }
        return null;
    }
};
