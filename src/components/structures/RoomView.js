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

// TODO: This component is enormous! There's several things which could stand-alone:
//  - Aux component
//  - Search results component
//  - Drag and drop
//  - File uploading - uploadFile()
//  - Timeline component (alllll the logic in getEventTiles())

var React = require("react");
var ReactDOM = require("react-dom");
var GeminiScrollbar = require('react-gemini-scrollbar');
var q = require("q");
var classNames = require("classnames");
var Matrix = require("matrix-js-sdk");

var MatrixClientPeg = require("../../MatrixClientPeg");
var ContentMessages = require("../../ContentMessages");
var WhoIsTyping = require("../../WhoIsTyping");
var Modal = require("../../Modal");
var sdk = require('../../index');
var CallHandler = require('../../CallHandler');
var Resend = require("../../Resend");
var dis = require("../../dispatcher");

var PAGINATE_SIZE = 20;
var INITIAL_SIZE = 20;

module.exports = React.createClass({
    displayName: 'RoomView',
    propTypes: {
        ConferenceHandler: React.PropTypes.any
    },

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
            hasUnsentMessages: this._hasUnsentMessages(room),
            callState: null,
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
        this.savedScrollState = {atBottom: true};
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

        window.removeEventListener('resize', this.onResize);        
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
            case 'upload_failed':
            case 'upload_started':
            case 'upload_finished':
                this.forceUpdate();
                break;
            case 'call_state':
                // don't filter out payloads for room IDs other than props.room because
                // we may be interested in the conf 1:1 room

                if (!payload.room_id) {
                    return;
                }

                var call = CallHandler.getCallForRoom(payload.room_id);
                var callState;

                if (call) {
                    // Call state has changed so we may be loading video elements
                    // which will obscure the message log.
                    // scroll to bottom
                    this.scrollToBottom();
                    callState = call.call_state;
                }
                else {
                    callState = "ended";
                }

                // possibly remove the conf call notification if we're now in
                // the conf
                this._updateConfCallNotification();

                this.setState({
                    callState: callState
                });

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

    onSyncStateChange: function(state, prevState) {
        if (state === "SYNCING" && prevState === "SYNCING") {
            return;
        }
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

        var currentUnread = this.state.numUnreadMessages;
        if (!toStartOfTimeline &&
                (ev.getSender() !== MatrixClientPeg.get().credentials.userId)) {
            // update unread count when scrolled up
            if (this.savedScrollState.atBottom) {
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
        if (!this.props.ConferenceHandler) {
            return;
        }
        if (member.roomId !== this.props.roomId ||
                member.userId !== this.props.ConferenceHandler.getConferenceUserIdForRoom(member.roomId)) {
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
        if (!room || !this.props.ConferenceHandler) {
            return;
        }
        var confMember = room.getMember(
            this.props.ConferenceHandler.getConferenceUserIdForRoom(this.props.roomId)
        );

        if (!confMember) {
            return;
        }
        var confCall = this.props.ConferenceHandler.getConferenceCallForRoom(confMember.roomId);

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

            this.scrollToBottom();
            this.sendReadReceipt();
            this.fillSpace();
        }

        var call = CallHandler.getCallForRoom(this.props.roomId);
        var callState = call ? call.call_state : "ended";
        this.setState({
            callState: callState
        });

        this._updateConfCallNotification();

        window.addEventListener('resize', this.onResize);
        this.onResize();
    },

    componentDidUpdate: function() {
        // after adding event tiles, we may need to tweak the scroll (either to
        // keep at the bottom of the timeline, or to maintain the view after
        // adding events to the top).

        if (!this.refs.messagePanel) return;

        if (this.state.searchResults) return;
        var scrollState = this.savedScrollState;
        if (scrollState.atBottom) {
            this.scrollToBottom();
        } else if (scrollState.lastDisplayedEvent) {
            this.scrollToEvent(scrollState.lastDisplayedEvent,
                               scrollState.pixelOffset);
        }

        // have to fill space in case we're accepting an invite
        if (!this.state.paginating) this.fillSpace();
    },

    _paginateCompleted: function() {
        this.setState({
            room: MatrixClientPeg.get().getRoom(this.props.roomId)
        });

        // we might not have got enough results from the pagination
        // request, so give fillSpace() a chance to set off another.
        if (!this.fillSpace()) {
            this.setState({paginating: false});
        }
    },

    // check the scroll position, and if we need to, set off a pagination
    // request.
    //
    // returns true if a pagination request was started (or is still in progress)
    fillSpace: function() {
        if (!this.refs.messagePanel) return;
        if (this.state.searchResults) return; // TODO: paginate search results
        var messageWrapperScroll = this._getScrollNode();
        if (messageWrapperScroll.scrollTop < messageWrapperScroll.clientHeight && this.state.room.oldState.paginationToken) {
            // there's less than a screenful of messages left. Either wind back
            // the message cap (if there are enough events in the timeline to
            // do so), or fire off a pagination request.

            this.oldScrollHeight = messageWrapperScroll.scrollHeight;

            if (this.state.messageCap < this.state.room.timeline.length) {
                var cap = Math.min(this.state.messageCap + PAGINATE_SIZE, this.state.room.timeline.length);
                this.setState({messageCap: cap});
            } else {
                var cap = this.state.messageCap + PAGINATE_SIZE;
                this.setState({messageCap: cap, paginating: true});
                MatrixClientPeg.get().scrollback(this.state.room, PAGINATE_SIZE).finally(this._paginateCompleted).done();
                return true;
            }
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
        if (this.refs.messagePanel && !this.state.searchResults) {
            this.savedScrollState = this._calculateScrollState();
            if (this.savedScrollState.atBottom && this.state.numUnreadMessages != 0) {
                this.setState({numUnreadMessages: 0});
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
        var self = this;
        ContentMessages.sendContentToRoom(
            file, this.props.roomId, MatrixClientPeg.get()
        ).done(undefined, function(error) {
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
        self.setState({
            searchInProgress: true
        });

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

            if (!self.state.searching || term !== self.refs.search_bar.refs.search_term.value) {
                console.error("Discarding stale search results");
                return;
            }

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
                searchTerm: term,
                searchResults: data,
                searchScope: scope,
                searchCount: data.search_categories.room_events.count,
            });
        }, function(error) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Search failed",
                description: error.toString()
            });
        }).finally(function() {
            self.setState({
                searchInProgress: false
            });
        });
    },

    getEventTiles: function() {
        var DateSeparator = sdk.getComponent('messages.DateSeparator');
        var cli = MatrixClientPeg.get();

        var ret = [];
        var count = 0;

        var EventTile = sdk.getComponent('rooms.EventTile');
        var self = this;

        if (this.state.searchResults)
        {
            if (!this.state.searchResults.search_categories.room_events.results ||
                !this.state.searchResults.search_categories.room_events.groups)
            {
                return ret;
            }

            // XXX: this dance is foul, due to the results API not directly returning sorted results
            var results = this.state.searchResults.search_categories.room_events.results;
            var roomIdGroups = this.state.searchResults.search_categories.room_events.groups.room_id;

            if (Array.isArray(results)) {
                // Old search API used to return results as a event_id -> result dict, but now
                // returns a straightforward list.
                results = results.reduce(function(prev, curr) {
                    prev[curr.result.event_id] = curr;
                    return prev;
                }, {});
            }

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
            if (this.props.ConferenceHandler && mxEv.getType() === "m.room.member") {
                if (this.props.ConferenceHandler.isConferenceUser(mxEv.getSender()) ||
                        this.props.ConferenceHandler.isConferenceUser(mxEv.getStateKey())) {
                    continue; // suppress conf user join/parts
                }
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
    },

    onSettingsClick: function() {
        this.setState({editingRoomSettings: true});
    },

    onSaveClick: function() {
        this.setState({
            editingRoomSettings: false,
            uploadingRoomSettings: true,
        });

        var new_name = this.refs.header.getRoomName();
        var new_topic = this.refs.room_settings.getTopic();
        var new_join_rule = this.refs.room_settings.getJoinRules();
        var new_history_visibility = this.refs.room_settings.getHistoryVisibility();
        var new_power_levels = this.refs.room_settings.getPowerLevels();

        this.uploadNewState(
            new_name,
            new_topic,
            new_join_rule,
            new_history_visibility,
            new_power_levels
        );
    },

    onCancelClick: function() {
        this.setState(this.getInitialState());
    },

    onLeaveClick: function() {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.roomId,
        });
        this.props.onFinished();        
    },

    onRejectButtonClicked: function(ev) {
        var self = this;
        this.setState({
            rejecting: true
        });
        MatrixClientPeg.get().leave(this.props.roomId).done(function() {
            dis.dispatch({ action: 'view_next_room' });
            self.setState({
                rejecting: false
            });
        }, function(err) {
            console.error("Failed to reject invite: %s", err);
            self.setState({
                rejecting: false,
                rejectError: err
            });
        });
    },

    onSearchClick: function() {
        this.setState({ searching: true });
    },

    onConferenceNotificationClick: function() {
        dis.dispatch({
            action: 'place_call',
            type: "video",
            room_id: this.props.roomId
        });
    },

    getUnreadMessagesString: function() {
        if (!this.state.numUnreadMessages) {
            return "";
        }
        return this.state.numUnreadMessages + " new message" + (this.state.numUnreadMessages > 1 ? "s" : "");
    },

    scrollToBottom: function() {
        var scrollNode = this._getScrollNode();
        if (!scrollNode) return;
        scrollNode.scrollTop = scrollNode.scrollHeight;
    },

    // scroll the event view to put the given event at the bottom.
    //
    // pixel_offset gives the number of pixels between the bottom of the event
    // and the bottom of the container.
    scrollToEvent: function(eventId, pixelOffset) {
        var scrollNode = this._getScrollNode();
        if (!scrollNode) return;

        var messageWrapper = this.refs.messagePanel;
        if (messageWrapper === undefined) return;

        var idx = this._indexForEventId(eventId);
        if (idx === null) {
            // we don't seem to have this event in our timeline. Presumably
            // it's fallen out of scrollback. We ought to backfill until we
            // find it, but we'd have to be careful we didn't backfill forever
            // looking for a non-existent event.
            //
            // for now, just scroll to the top of the buffer.
            console.log("Refusing to scroll to unknown event "+eventId);
            scrollNode.scrollTop = 0;
            return;
        }

        // we might need to roll back the messagecap (to generate tiles for
        // older messages). This just means telling getEventTiles to create
        // tiles for events we already have in our timeline (we already know
        // the event in question is in our timeline, so we shouldn't need to
        // backfill).
        //
        // we actually wind back slightly further than the event in question,
        // because we want the event to be at the *bottom* of the container.
        // Don't roll it back past the timeline we have, though.
        var minCap = this.state.room.timeline.length - Math.min(idx - INITIAL_SIZE, 0);
        if (minCap > this.state.messageCap) {
            this.setState({messageCap: minCap});
        }

        var node = this.eventNodes[eventId];
        if (node === null) {
            // getEventTiles should have sorted this out when we set the
            // messageCap, so this is weird.
            console.error("No node for event, even after rolling back messageCap");
            return;
        }

        var wrapperRect = ReactDOM.findDOMNode(messageWrapper).getBoundingClientRect();
        var boundingRect = node.getBoundingClientRect();
        scrollNode.scrollTop += boundingRect.bottom + pixelOffset - wrapperRect.bottom;
    },

    _calculateScrollState: function() {
        // we don't save the absolute scroll offset, because that
        // would be affected by window width, zoom level, amount of scrollback,
        // etc.
        //
        // instead we save the id of the last fully-visible event, and the
        // number of pixels the window was scrolled below it - which will
        // hopefully be near enough.
        //
        if (this.eventNodes === undefined) return null;

        var messageWrapper = this.refs.messagePanel;
        if (messageWrapper === undefined) return null;
        var wrapperRect = ReactDOM.findDOMNode(messageWrapper).getBoundingClientRect();

        var messageWrapperScroll = this._getScrollNode();
        // + 1 here to avoid fractional pixel rounding errors
        var atBottom = messageWrapperScroll.scrollHeight - messageWrapperScroll.scrollTop <= messageWrapperScroll.clientHeight + 1;

        for (var i = this.state.room.timeline.length-1; i >= 0; --i) {
            var ev = this.state.room.timeline[i];
            var node = this.eventNodes[ev.getId()];
            if (!node) continue;

            var boundingRect = node.getBoundingClientRect();
            if (boundingRect.bottom < wrapperRect.bottom) {
                return {
                    atBottom: atBottom,
                    lastDisplayedEvent: ev.getId(),
                    pixelOffset: wrapperRect.bottom - boundingRect.bottom,
                }
            }
        }

        // apparently the entire timeline is below the viewport. Give up.
        return { atBottom: true };
    },

    // get the current scroll position of the room, so that it can be
    // restored when we switch back to it
    getScrollState: function() {
        return this.savedScrollState;
    },

    restoreScrollState: function(scrollState) {
        if(scrollState.atBottom) {
            // we were at the bottom before. Ideally we'd scroll to the
            // 'read-up-to' mark here.
        } else if (scrollState.lastDisplayedEvent) {
            this.scrollToEvent(scrollState.lastDisplayedEvent,
                               scrollState.pixelOffset);
        }
    },

    onResize: function(e) {
        // It seems flexbox doesn't give us a way to constrain the auxPanel height to have
        // a minimum of the height of the video element, whilst also capping it from pushing out the page
        // so we have to do it via JS instead.  In this implementation we cap the height by putting
        // a maxHeight on the underlying remote video tag.
        var auxPanelMaxHeight;
        if (this.refs.callView) {
            // XXX: don't understand why we have to call findDOMNode here in react 0.14 - it should already be a DOM node.
            var video = ReactDOM.findDOMNode(this.refs.callView.refs.video.refs.remote);

            // header + footer + status + give us at least 100px of scrollback at all times.
            auxPanelMaxHeight = window.innerHeight - (83 + 72 + 36 + 100);

            // XXX: this is a bit of a hack and might possibly cause the video to push out the page anyway
            // but it's better than the video going missing entirely
            if (auxPanelMaxHeight < 50) auxPanelMaxHeight = 50;

            video.style.maxHeight = auxPanelMaxHeight + "px";
        }
    },

    onFullscreenClick: function() {
        dis.dispatch({
            action: 'video_fullscreen',
            fullscreen: true
        }, true);
    },

    onMuteAudioClick: function() {
        var call = CallHandler.getCallForRoom(this.props.roomId);
        if (!call) {
            return;
        }
        var newState = !call.isMicrophoneMuted();
        call.setMicrophoneMuted(newState);
        this.setState({
            audioMuted: newState
        });
    },

    onMuteVideoClick: function() {
        var call = CallHandler.getCallForRoom(this.props.roomId);
        if (!call) {
            return;
        }
        var newState = !call.isLocalVideoMuted();
        call.setLocalVideoMuted(newState);
        this.setState({
            videoMuted: newState
        });
    },

    render: function() {
        var RoomHeader = sdk.getComponent('rooms.RoomHeader');
        var MessageComposer = sdk.getComponent('rooms.MessageComposer');
        var CallView = sdk.getComponent("voip.CallView");
        var RoomSettings = sdk.getComponent("rooms.RoomSettings");
        var SearchBar = sdk.getComponent("rooms.SearchBar");

        if (!this.state.room) {
            if (this.props.roomId) {
                return (
                    <div>
                    <button onClick={this.onJoinButtonClicked}>Join Room</button>
                    </div>
                );
            } else {
                return (
                    <div />
                );
            }
        }

        var myUserId = MatrixClientPeg.get().credentials.userId;
        var myMember = this.state.room.getMember(myUserId);
        if (myMember && myMember.membership == 'invite') {
            if (this.state.joining || this.state.rejecting) {
                var Loader = sdk.getComponent("elements.Spinner");
                return (
                    <div className="mx_RoomView">
                        <Loader />
                    </div>
                );
            } else {
                var inviteEvent = myMember.events.member;
                var inviterName = inviteEvent.sender ? inviteEvent.sender.name : inviteEvent.getSender();
                // XXX: Leaving this intentionally basic for now because invites are about to change totally
                var joinErrorText = this.state.joinError ? "Failed to join room!" : "";
                var rejectErrorText = this.state.rejectError ? "Failed to reject invite!" : "";
                return (
                    <div className="mx_RoomView">
                        <RoomHeader ref="header" room={this.state.room} simpleHeader="Room invite"/>
                        <div className="mx_RoomView_invitePrompt">
                            <div>{inviterName} has invited you to a room</div>
                            <br/>
                            <button ref="joinButton" onClick={this.onJoinButtonClicked}>Join</button>
                            <button onClick={this.onRejectButtonClicked}>Reject</button>
                            <div className="error">{joinErrorText}</div>
                            <div className="error">{rejectErrorText}</div>
                        </div>
                    </div>
                );
            }
        } else {
            var scrollheader_classes = classNames({
                mx_RoomView_scrollheader: true,
                loading: this.state.paginating
            });

            var statusBar;

            // for testing UI...
            // this.state.upload = {
            //     uploadedBytes: 123493,
            //     totalBytes: 347534,
            //     fileName: "testing_fooble.jpg",
            // }

            if (ContentMessages.getCurrentUploads().length > 0) {
                var UploadBar = sdk.getComponent('structures.UploadBar');
                statusBar = <UploadBar room={this.state.room} />
            } else if (!this.state.searchResults) {
                var typingString = this.getWhoIsTypingString();
                // typingString = "S͚͍̭̪̤͙̱͙̖̥͙̥̤̻̙͕͓͂̌ͬ͐̂k̜̝͎̰̥̻̼̂̌͛͗͊̅̒͂̊̍̍͌̈̈́͌̋̊ͬa͉̯͚̺̗̳̩ͪ̋̑͌̓̆̍̂̉̏̅̆ͧ̌̑v̲̲̪̝ͥ̌ͨͮͭ̊͆̾ͮ̍ͮ͑̚e̮̙͈̱̘͕̼̮͒ͩͨͫ̃͗̇ͩ͒ͣͦ͒̄̍͐ͣ̿ͥṘ̗̺͇̺̺͔̄́̊̓͊̍̃ͨ̚ā̼͎̘̟̼͎̜̪̪͚̋ͨͨͧ̓ͦͯͤ̄͆̋͂ͩ͌ͧͅt̙̙̹̗̦͖̞ͫͪ͑̑̅ͪ̃̚ͅ is typing...";
                var unreadMsgs = this.getUnreadMessagesString();
                // no conn bar trumps unread count since you can't get unread messages
                // without a connection! (technically may already have some but meh)
                // It also trumps the "some not sent" msg since you can't resend without
                // a connection!
                if (this.state.syncState === "ERROR") {
                    statusBar = (
                        <div className="mx_RoomView_connectionLostBar">
                            <img src="img/warning.svg" width="24" height="23" alt="/!\ "/>
                            <div className="mx_RoomView_connectionLostBar_textArea">
                                <div className="mx_RoomView_connectionLostBar_title">
                                    Connectivity to the server has been lost.
                                </div>
                                <div className="mx_RoomView_connectionLostBar_desc">
                                    Sent messages will be stored until your connection has returned.
                                </div>
                            </div>
                        </div>
                    );
                }
                else if (this.state.hasUnsentMessages) {
                    statusBar = (
                        <div className="mx_RoomView_connectionLostBar">
                            <img src="img/warning.svg" width="24" height="23" alt="/!\ "/>
                            <div className="mx_RoomView_connectionLostBar_textArea">
                                <div className="mx_RoomView_connectionLostBar_title">
                                    Some of your messages have not been sent.
                                </div>
                                <div className="mx_RoomView_connectionLostBar_desc">
                                    <a className="mx_RoomView_resend_link"
                                        onClick={ this.onResendAllClick }>
                                    Resend all now
                                    </a> or select individual messages to re-send.
                                </div>
                            </div>
                        </div>
                    );
                }
                // unread count trumps who is typing since the unread count is only
                // set when you've scrolled up
                else if (unreadMsgs) {
                    statusBar = (
                        <div className="mx_RoomView_unreadMessagesBar" onClick={ this.scrollToBottom }>
                            <img src="img/newmessages.png" width="24" height="24" alt=""/>
                            {unreadMsgs}
                        </div>
                    );
                }
                else if (typingString) {
                    statusBar = (
                        <div className="mx_RoomView_typingBar">
                            <div className="mx_RoomView_typingImage">...</div>
                            <span className="mx_RoomView_typingText">{typingString}</span>
                        </div>
                    );
                }
            }

            var aux = null;
            if (this.state.editingRoomSettings) {
                aux = <RoomSettings ref="room_settings" onSaveClick={this.onSaveClick} room={this.state.room} />;
            }
            else if (this.state.uploadingRoomSettings) {
                var Loader = sdk.getComponent("elements.Spinner");                
                aux = <Loader/>;
            }
            else if (this.state.searching) {
                aux = <SearchBar ref="search_bar" searchInProgress={this.state.searchInProgress } onCancelClick={this.onCancelClick} onSearch={this.onSearch}/>;
            }

            var conferenceCallNotification = null;
            if (this.state.displayConfCallNotification) {
                var supportedText;
                if (!MatrixClientPeg.get().supportsVoip()) {
                    supportedText = " (unsupported)";
                }
                conferenceCallNotification = (
                    <div className="mx_RoomView_ongoingConfCallNotification" onClick={this.onConferenceNotificationClick}>
                        Ongoing conference call {supportedText}
                    </div>
                );
            }

            var fileDropTarget = null;
            if (this.state.draggingFile) {
                fileDropTarget = <div className="mx_RoomView_fileDropTarget">
                                    <div className="mx_RoomView_fileDropTargetLabel">
                                        <img src="img/upload-big.svg" width="45" height="59" alt="Drop File Here"/><br/>
                                        Drop File Here
                                    </div>
                                 </div>;
            }

            var messageComposer, searchInfo;
            if (!this.state.searchResults) {
                messageComposer =
                    <MessageComposer room={this.state.room} roomView={this} uploadFile={this.uploadFile} callState={this.state.callState} />
            }
            else {
                searchInfo = {
                    searchTerm : this.state.searchTerm,
                    searchScope : this.state.searchScope,
                    searchCount : this.state.searchCount,
                }
            }

            var call = CallHandler.getCallForRoom(this.props.roomId);
            var inCall = false;
            if (call && this.state.callState != 'ended') {
                inCall = true;
                var zoomButton, voiceMuteButton, videoMuteButton;

                if (call.type === "video") {
                    zoomButton = (
                        <div className="mx_RoomView_voipButton" onClick={this.onFullscreenClick}>
                            <img src="img/fullscreen.svg" title="Fill screen" alt="Fill screen" width="29" height="22" style={{ marginTop: 1, marginRight: 4 }}/>
                        </div>
                    );

                    videoMuteButton =
                        <div className="mx_RoomView_voipButton" onClick={this.onMuteVideoClick}>
                            <img src={call.isLocalVideoMuted() ? "img/video-unmute.svg" : "img/video-mute.svg"} width="31" height="27"/>
                        </div>
                }
                voiceMuteButton =
                    <div className="mx_RoomView_voipButton" onClick={this.onMuteAudioClick}>
                        <img src={call.isMicrophoneMuted() ? "img/voice-unmute.svg" : "img/voice-mute.svg"} width="21" height="26"/>
                    </div>

                if (!statusBar) {
                    statusBar =
                        <div className="mx_RoomView_callBar">
                            <img src="img/sound-indicator.svg" width="23" height="20" alt=""/>
                            <b>Active call</b>
                        </div>;
                }

                statusBar =
                    <div className="mx_RoomView_callStatusBar">
                        { voiceMuteButton }
                        { videoMuteButton }
                        { zoomButton }
                        { statusBar }
                        <img className="mx_RoomView_voipChevron" src="img/voip-chevron.svg" width="22" height="17"/>
                    </div>
            }

            return (
                <div className={ "mx_RoomView" + (inCall ? " mx_RoomView_inCall" : "") }>
                    <RoomHeader ref="header" room={this.state.room} searchInfo={searchInfo} editing={this.state.editingRoomSettings} onSearchClick={this.onSearchClick}
                        onSettingsClick={this.onSettingsClick} onSaveClick={this.onSaveClick} onCancelClick={this.onCancelClick} onLeaveClick={this.onLeaveClick} />
                    { fileDropTarget }    
                    <div className="mx_RoomView_auxPanel">
                        <CallView ref="callView" room={this.state.room} ConferenceHandler={this.props.ConferenceHandler}/>
                        { conferenceCallNotification }
                        { aux }
                    </div>
                    <GeminiScrollbar autoshow={true} ref="messagePanel" className="mx_RoomView_messagePanel" onScroll={ this.onMessageListScroll }>
                        <div className="mx_RoomView_messageListWrapper">
                            <ol className="mx_RoomView_MessageList" aria-live="polite">
                                <li className={scrollheader_classes}>
                                </li>
                                {this.getEventTiles()}
                            </ol>
                        </div>
                    </GeminiScrollbar>
                    <div className="mx_RoomView_statusArea">
                        <div className="mx_RoomView_statusAreaBox">
                            <div className="mx_RoomView_statusAreaBox_line"></div>
                            { statusBar }
                        </div>
                    </div>
                    { messageComposer }
                </div>
            );
        }
    },
});
