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

// TODO: This component is enormous! There's several things which could stand-alone:
//  - Aux component
//  - Search results component
//  - Drag and drop
//  - File uploading - uploadFile()
//  - Timeline component (alllll the logic in getEventTiles())

var React = require("react");
var ReactDOM = require("react-dom");
var q = require("q");
var classNames = require("classnames");
var Matrix = require("matrix-js-sdk");

var MatrixClientPeg = require("../../MatrixClientPeg");
var ContentMessages = require("../../ContentMessages");
var WhoIsTyping = require("../../WhoIsTyping");
var Modal = require("../../Modal");
var sdk = require('../../index');
var CallHandler = require('../../CallHandler');
var TabComplete = require("../../TabComplete");
var MemberEntry = require("../../TabCompleteEntries").MemberEntry;
var CommandEntry = require("../../TabCompleteEntries").CommandEntry;
var Resend = require("../../Resend");
var SlashCommands = require("../../SlashCommands");
var dis = require("../../dispatcher");
var Tinter = require("../../Tinter");

var PAGINATE_SIZE = 20;
var INITIAL_SIZE = 20;
var SEND_READ_RECEIPT_DELAY = 2000;

var DEBUG_SCROLL = false;

if (DEBUG_SCROLL) {
    // using bind means that we get to keep useful line numbers in the console
    var debuglog = console.log.bind(console);
} else {
    var debuglog = function () {};
}

module.exports = React.createClass({
    displayName: 'RoomView',
    propTypes: {
        ConferenceHandler: React.PropTypes.any,
        roomId: React.PropTypes.string,
        autoPeek: React.PropTypes.bool, // should we try to peek the room on mount, or has whoever invoked us already initiated a peek?
    },

    /* properties in RoomView objects include:
     *
     * eventNodes: a map from event id to DOM node representing that event
     */
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
            autoPeekDone: false, // track whether our autoPeek (if any) has completed)
            guestsCanJoin: false,
            canPeek: false,
            readMarkerEventId: room ? room.getEventReadUpTo(MatrixClientPeg.get().credentials.userId) : null,
            readMarkerGhostEventId: undefined,
            atBottom: true,
        }
    },

    componentWillMount: function() {
        this.last_rr_sent_event_id = undefined;
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on("Room", this.onNewRoom);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        MatrixClientPeg.get().on("Room.name", this.onRoomName);
        MatrixClientPeg.get().on("Room.accountData", this.onRoomAccountData);
        MatrixClientPeg.get().on("Room.receipt", this.onRoomReceipt);
        MatrixClientPeg.get().on("RoomMember.typing", this.onRoomMemberTyping);
        MatrixClientPeg.get().on("RoomState.members", this.onRoomStateMember);
        MatrixClientPeg.get().on("sync", this.onSyncStateChange);
        // xchat-style tab complete, add a colon if tab
        // completing at the start of the text
        this.tabComplete = new TabComplete({
            allowLooping: false,
            autoEnterTabComplete: true,
            onClickCompletes: true,
            onStateChange: (isCompleting) => {
                this.forceUpdate();
            }
        });
        // if this is an unknown room then we're in one of three states:
        // - This is a room we can peek into (search engine) (we can /peek)
        // - This is a room we can publicly join or were invited to. (we can /join)
        // - This is a room we cannot join at all. (no action can help us)
        // We can't try to /join because this may implicitly accept invites (!)
        // We can /peek though. If it fails then we present the join UI. If it
        // succeeds then great, show the preview (but we still may be able to /join!).
        if (!this.state.room) {
            if (this.props.autoPeek) {
                console.log("Attempting to peek into room %s", this.props.roomId);
                MatrixClientPeg.get().peekInRoom(this.props.roomId).catch((err) => {
                    console.error("Failed to peek into room: %s", err);
                }).finally(() => {
                    // we don't need to do anything - JS SDK will emit Room events
                    // which will update the UI.
                    this.setState({
                        autoPeekDone: true
                    });
                });
            }
        }
        else {
            this._calculatePeekRules(this.state.room);
        }
    },

    componentWillUnmount: function() {
        // set a boolean to say we've been unmounted, which any pending
        // promises can use to throw away their results.
        //
        // (We could use isMounted, but facebook have deprecated that.)
        this.unmounted = true;

        if (this.refs.roomView) {
            // disconnect the D&D event listeners from the room view. This
            // is really just for hygiene - we're going to be
            // deleted anyway, so it doesn't matter if the event listeners
            // don't get cleaned up.
            var roomView = ReactDOM.findDOMNode(this.refs.roomView);
            roomView.removeEventListener('drop', this.onDrop);
            roomView.removeEventListener('dragover', this.onDragOver);
            roomView.removeEventListener('dragleave', this.onDragLeaveOrEnd);
            roomView.removeEventListener('dragend', this.onDragLeaveOrEnd);
        }
        dis.unregister(this.dispatcherRef);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room", this.onNewRoom);
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
            MatrixClientPeg.get().removeListener("Room.name", this.onRoomName);
            MatrixClientPeg.get().removeListener("Room.accountData", this.onRoomAccountData);
            MatrixClientPeg.get().removeListener("Room.receipt", this.onRoomReceipt);
            MatrixClientPeg.get().removeListener("RoomMember.typing", this.onRoomMemberTyping);
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
            MatrixClientPeg.get().removeListener("sync", this.onSyncStateChange);
        }

        window.removeEventListener('resize', this.onResize);        

        Tinter.tint(); // reset colourscheme
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
            case 'user_activity_end':
                // we could treat user_activity_end differently and not
                // send receipts for messages that have arrived between
                // the actual user activity and the time they stopped
                // being active, but let's see if this is actually
                // necessary.
                this.sendReadReceipt();
                break;
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
        if (this.unmounted) return;

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
            if (!this.state.searchResults && this.refs.messagePanel && this.refs.messagePanel.isAtBottom()) {
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

    onNewRoom: function(room) {
        if (room.roomId == this.props.roomId) {
            this.setState({
                room: room
            });
        }

        this._calculatePeekRules(room);
    },

    _calculatePeekRules: function(room) {
        var guestAccessEvent = room.currentState.getStateEvents("m.room.guest_access", "");
        if (guestAccessEvent && guestAccessEvent.getContent().guest_access === "can_join") {
            this.setState({
                guestsCanJoin: true
            });
        }

        var historyVisibility = room.currentState.getStateEvents("m.room.history_visibility", "");
        if (historyVisibility && historyVisibility.getContent().history_visibility === "world_readable") {
            this.setState({
                canPeek: true
            });
        }
    },

    onRoomName: function(room) {
        if (room.roomId == this.props.roomId) {
            this.setState({
                room: room
            });
        }
    },

    updateTint: function() {
        var room = MatrixClientPeg.get().getRoom(this.props.roomId);
        if (!room) return;

        var color_scheme_event = room.getAccountData("org.matrix.room.color_scheme");
        var color_scheme = {};
        if (color_scheme_event) {
            color_scheme = color_scheme_event.getContent();
            // XXX: we should validate the event
        }                
        Tinter.tint(color_scheme.primary_color, color_scheme.secondary_color);
    },

    onRoomAccountData: function(room, event) {
        if (room.roomId == this.props.roomId) {
            if (event.getType === "org.matrix.room.color_scheme") {
                var color_scheme = event.getContent();
                // XXX: we should validate the event
                Tinter.tint(color_scheme.primary_color, color_scheme.secondary_color);
            }
        }
    },

    onRoomReceipt: function(receiptEvent, room) {
        if (room.roomId == this.props.roomId) {
            var readMarkerEventId = this.state.room.getEventReadUpTo(MatrixClientPeg.get().credentials.userId);
            var readMarkerGhostEventId = this.state.readMarkerGhostEventId;
            if (this.state.readMarkerEventId !== undefined && this.state.readMarkerEventId != readMarkerEventId) {
                readMarkerGhostEventId = this.state.readMarkerEventId;
            }


            // if the event after the one referenced in the read receipt if sent by us, do nothing since
            // this is a temporary period before the synthesized receipt for our own message arrives
            var readMarkerGhostEventIndex;
            for (var i = 0; i < room.timeline.length; ++i) {
                if (room.timeline[i].getId() == readMarkerGhostEventId) {
                    readMarkerGhostEventIndex = i;
                    break;
                }
            }
            if (readMarkerGhostEventIndex + 1 < room.timeline.length) {
                var nextEvent = room.timeline[readMarkerGhostEventIndex + 1];
                if (nextEvent.sender && nextEvent.sender.userId == MatrixClientPeg.get().credentials.userId) {
                    readMarkerGhostEventId = undefined;
                }
            }

            this.setState({
                readMarkerEventId: readMarkerEventId,
                readMarkerGhostEventId: readMarkerGhostEventId,
            });
        }
    },

    onRoomMemberTyping: function(ev, member) {
        this.forceUpdate();
    },

    onRoomStateMember: function(ev, state, member) {
        if (member.roomId === this.props.roomId) {
            // a member state changed in this room, refresh the tab complete list
            this._updateTabCompleteList(this.state.room);

            var room = MatrixClientPeg.get().getRoom(this.props.roomId);
            var me = MatrixClientPeg.get().credentials.userId;
            if (this.state.joining && room.hasMembershipState(me, "join")) {
                this.setState({
                    joining: false
                });
            }
        }

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
            this._initialiseMessagePanel();
        }

        var call = CallHandler.getCallForRoom(this.props.roomId);
        var callState = call ? call.call_state : "ended";
        this.setState({
            callState: callState
        });

        this._updateConfCallNotification();

        window.addEventListener('resize', this.onResize);
        this.onResize();

        if (this.refs.roomView) {
            var roomView = ReactDOM.findDOMNode(this.refs.roomView);
            roomView.addEventListener('drop', this.onDrop);
            roomView.addEventListener('dragover', this.onDragOver);
            roomView.addEventListener('dragleave', this.onDragLeaveOrEnd);
            roomView.addEventListener('dragend', this.onDragLeaveOrEnd);
        }

        this._updateTabCompleteList(this.state.room);

        // XXX: EVIL HACK to autofocus inviting on empty rooms.
        // We use the setTimeout to avoid racing with focus_composer.
        if (this.state.room && this.state.room.getJoinedMembers().length == 1) {
            var inviteBox = document.getElementById("mx_SearchableEntityList_query");
            setTimeout(function() {
                inviteBox.focus();
            }, 50);
        }
    },

    _updateTabCompleteList: function(room) {
        if (!room || !this.tabComplete) {
            return;
        }
        this.tabComplete.setCompletionList(
            MemberEntry.fromMemberList(room.getJoinedMembers()).concat(
                CommandEntry.fromCommands(SlashCommands.getCommandList())
            )
        );
    },

    _initialiseMessagePanel: function() {
        var messagePanel = ReactDOM.findDOMNode(this.refs.messagePanel);
        this.refs.messagePanel.initialised = true;

        this.scrollToBottom();
        this.sendReadReceipt();

        this.updateTint();
    },

    componentDidUpdate: function() {
        // we need to initialise the messagepanel if we've just joined the
        // room. TODO: we really really ought to factor out messagepanel to a
        // separate component to avoid this ridiculous dance.
        if (!this.refs.messagePanel) return;

        if (!this.refs.messagePanel.initialised) {
            this._initialiseMessagePanel();
        }
    },

    _paginateCompleted: function() {
        debuglog("paginate complete");

        // we might have switched rooms since the paginate started - just bin
        // the results if so.
        if (this.unmounted) return;

        this.setState({
            room: MatrixClientPeg.get().getRoom(this.props.roomId),
            paginating: false,
        });
    },

    onSearchResultsFillRequest: function(backwards) {
        if (!backwards)
            return q(false);

        if (this.state.searchResults.next_batch) {
            debuglog("requesting more search results");
            var searchPromise = MatrixClientPeg.get().backPaginateRoomEventsSearch(
                this.state.searchResults);
            return this._handleSearchResult(searchPromise);
        } else {
            debuglog("no more search results");
            return q(false);
        }
    },

    // set off a pagination request.
    onMessageListFillRequest: function(backwards) {
        if (!backwards)
            return q(false);

        // Either wind back the message cap (if there are enough events in the
        // timeline to do so), or fire off a pagination request.

        if (this.state.messageCap < this.state.room.timeline.length) {
            var cap = Math.min(this.state.messageCap + PAGINATE_SIZE, this.state.room.timeline.length);
            debuglog("winding back message cap to", cap);
            this.setState({messageCap: cap});
            return q(true);
        } else if(this.state.room.oldState.paginationToken) {
            var cap = this.state.messageCap + PAGINATE_SIZE;
            debuglog("starting paginate to cap", cap);
            this.setState({messageCap: cap, paginating: true});
            return MatrixClientPeg.get().scrollback(this.state.room, PAGINATE_SIZE).
                finally(this._paginateCompleted).then(true);
        }
    },

    // return true if there's more messages in the backlog which we aren't displaying
    _canPaginate: function() {
        return (this.state.messageCap < this.state.room.timeline.length) ||
            this.state.room.oldState.paginationToken;
    },

    onResendAllClick: function() {
        var eventsToResend = this._getUnsentMessages(this.state.room);
        eventsToResend.forEach(function(event) {
            Resend.resend(event);
        });
    },

    onJoinButtonClicked: function(ev) {
        var self = this;
        MatrixClientPeg.get().joinRoom(this.props.roomId).done(function() {
            // It is possible that there is no Room yet if state hasn't come down
            // from /sync - joinRoom will resolve when the HTTP request to join succeeds,
            // NOT when it comes down /sync. If there is no room, we'll keep the
            // joining flag set until we see it. Likewise, if our state is not
            // "join" we'll keep this flag set until it comes down /sync.
            var room = MatrixClientPeg.get().getRoom(self.props.roomId);
            var me = MatrixClientPeg.get().credentials.userId;
            self.setState({
                joining: room ? !room.hasMembershipState(me, "join") : true,
                room: room
            });
        }, function(error) {
            self.setState({
                joining: false,
                joinError: error
            });
            var msg = error.message ? error.message : JSON.stringify(error);
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Failed to join room",
                description: msg
            });
        });
        this.setState({
            joining: true
        });
    },

    onMessageListScroll: function(ev) {
        if (this.refs.messagePanel.isAtBottom()) {
            if (this.state.numUnreadMessages != 0) {
                this.setState({ numUnreadMessages: 0 });
            }
            if (!this.state.atBottom) {
                this.setState({ atBottom: true });                
            }
        }
        else {
            if (this.state.atBottom) {
                this.setState({ atBottom: false });
            }            
        }
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
        this.setState({
            searchTerm: term,
            searchScope: scope,
            searchResults: {},
            searchHighlights: [],
        });

        // if we already have a search panel, we need to tell it to forget
        // about its scroll state.
        if (this.refs.searchResultsPanel) {
            this.refs.searchResultsPanel.resetScrollState();
        }

        // make sure that we don't end up showing results from
        // an aborted search by keeping a unique id.
        //
        // todo: should cancel any previous search requests.
        this.searchId = new Date().getTime();

        var filter;
        if (scope === "Room") {
            filter = {
                // XXX: it's unintuitive that the filter for searching doesn't have the same shape as the v2 filter API :(
                rooms: [
                    this.props.roomId
                ]
            };
        }

        debuglog("sending search request");

        var searchPromise = MatrixClientPeg.get().searchRoomEvents({
            filter: filter,
            term: term,
        });
        this._handleSearchResult(searchPromise).done();
    },

    _handleSearchResult: function(searchPromise) {
        var self = this;

        // keep a record of the current search id, so that if the search terms
        // change before we get a response, we can ignore the results.
        var localSearchId = this.searchId;

        this.setState({
            searchInProgress: true,
        });

        return searchPromise.then(function(results) {
            debuglog("search complete");
            if (self.unmounted || !self.state.searching || self.searchId != localSearchId) {
                console.error("Discarding stale search results");
                return;
            }

            // postgres on synapse returns us precise details of the strings
            // which actually got matched for highlighting.
            //
            // In either case, we want to highlight the literal search term
            // whether it was used by the search engine or not.

            var highlights = results.highlights;
            if (highlights.indexOf(self.state.searchTerm) < 0) {
                highlights = highlights.concat(self.state.searchTerm);
            }

            // For overlapping highlights,
            // favour longer (more specific) terms first
            highlights = highlights.sort(function(a, b) {
                return b.length - a.length });

            self.setState({
                searchHighlights: highlights,
                searchResults: results,
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


    getSearchResultTiles: function() {
        var EventTile = sdk.getComponent('rooms.EventTile');
        var SearchResultTile = sdk.getComponent('rooms.SearchResultTile');
        var cli = MatrixClientPeg.get();

        // XXX: todo: merge overlapping results somehow?
        // XXX: why doesn't searching on name work?

        if (this.state.searchResults.results === undefined) {
            // awaiting results
            return [];
        }

        var ret = [];

        if (!this.state.searchResults.next_batch) {
            if (this.state.searchResults.results.length == 0) {
                ret.push(<li key="search-top-marker">
                         <h2 className="mx_RoomView_topMarker">No results</h2>
                         </li>
                        );
            } else {
                ret.push(<li key="search-top-marker">
                         <h2 className="mx_RoomView_topMarker">No more results</h2>
                         </li>
                        );
            }
        }

        var lastRoomId;

        for (var i = this.state.searchResults.results.length - 1; i >= 0; i--) {
            var result = this.state.searchResults.results[i];

            var mxEv = result.context.getEvent();

            if (!EventTile.haveTileForEvent(mxEv)) {
                // XXX: can this ever happen? It will make the result count
                // not match the displayed count.
                continue;
            }

            if (this.state.searchScope === 'All') {
                var roomId = mxEv.getRoomId();
                if(roomId != lastRoomId) {
                    var room = cli.getRoom(roomId);

                    // XXX: if we've left the room, we might not know about
                    // it. We should tell the js sdk to go and find out about
                    // it. But that's not an issue currently, as synapse only
                    // returns results for rooms we're joined to.
                    var roomName = room ? room.name : "Unknown room "+roomId;

                    ret.push(<li key={mxEv.getId() + "-room"}>
                                 <h1>Room: { roomName }</h1>
                             </li>);
                    lastRoomId = roomId;
                }
            }

            ret.push(<SearchResultTile key={mxEv.getId()}
                     searchResult={result}
                     searchHighlights={this.state.searchHighlights}/>);
        }
        return ret;
    },

    getEventTiles: function() {
        var DateSeparator = sdk.getComponent('messages.DateSeparator');

        var ret = [];
        var count = 0;

        var EventTile = sdk.getComponent('rooms.EventTile');

        var prevEvent = null; // the last event we showed
        var startIdx = Math.max(0, this.state.room.timeline.length - this.state.messageCap);
        var readMarkerIndex;
        var ghostIndex;
        for (var i = startIdx; i < this.state.room.timeline.length; i++) {
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

            // now we've decided whether or not to show this message,
            // add the read up to marker if appropriate
            // doing this here means we implicitly do not show the marker
            // if it's at the bottom
            // NB. it would be better to decide where the read marker was going
            // when the state changed rather than here in the render method, but
            // this is where we decide what messages we show so it's the only
            // place we know whether we're at the bottom or not.
            var self = this;
            var mxEvSender = mxEv.sender ? mxEv.sender.userId : null;
            if (prevEvent && prevEvent.getId() == this.state.readMarkerEventId && mxEvSender != MatrixClientPeg.get().credentials.userId) {
                var hr;
                hr = (<hr className="mx_RoomView_myReadMarker" style={{opacity: 1, width: '99%'}} ref={function(n) {
                    self.readMarkerNode = n;
                }} />);
                readMarkerIndex = ret.length;
                ret.push(<li key="_readupto" className="mx_RoomView_myReadMarker_container">{hr}</li>);
            }

            // is this a continuation of the previous message?
            var continuation = false;
            if (prevEvent !== null) {
                if (mxEv.sender &&
                    prevEvent.sender &&
                    (mxEv.sender.userId === prevEvent.sender.userId) &&
                    (mxEv.getType() == prevEvent.getType())
                    )
                {
                    continuation = true;
                }
            }

            // do we need a date separator since the last event?
            var ts1 = mxEv.getTs();
            if ((prevEvent == null && !this._canPaginate()) ||
                (prevEvent != null &&
                 new Date(prevEvent.getTs()).toDateString() !== new Date(ts1).toDateString())) {
                var dateSeparator = <li key={ts1}><DateSeparator key={ts1} ts={ts1}/></li>;
                ret.push(dateSeparator);
                continuation = false;
            }

            var last = false;
            if (i == this.state.room.timeline.length - 1) {
                // XXX: we might not show a tile for the last event.
                last = true;
            }

            var eventId = mxEv.getId();
            ret.push(
                <li key={eventId} ref={this._collectEventNode.bind(this, eventId)} data-scroll-token={eventId}>
                    <EventTile mxEvent={mxEv} continuation={continuation} last={last}/>
                </li>
            );

            // A read up to marker has died and returned as a ghost!
            // Lives in the dom as the ghost of the previous one while it fades away
            if (eventId == this.state.readMarkerGhostEventId) {
                ghostIndex = ret.length;
            }

            prevEvent = mxEv;
        }

        // splice the read marker ghost in now that we know whether the read receipt
        // is the last element or not, because we only decide as we're going along.
        if (readMarkerIndex === undefined && ghostIndex && ghostIndex <= ret.length) {
            var hr;
            hr = (<hr className="mx_RoomView_myReadMarker" style={{opacity: 1, width: '99%'}} ref={function(n) {
                Velocity(n, {opacity: '0', width: '10%'}, {duration: 400, easing: 'easeInSine', delay: 1000, complete: function() {
                    self.setState({readMarkerGhostEventId: undefined});
                }});
            }} />);
            ret.splice(ghostIndex, 0, (
                <li key="_readuptoghost" className="mx_RoomView_myReadMarker_container">{hr}</li>
            ));
        }

        return ret;
    },

    uploadNewState: function(newVals) {
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

        var old_guest_read = (old_history_visibility === "world_readable");

        var old_guest_join = this.state.room.currentState.getStateEvents('m.room.guest_access', '');
        if (old_guest_join) {
            old_guest_join = (old_guest_join.getContent().guest_access === "can_join");
        }
        else {
            old_guest_join = false;
        }

        var old_canonical_alias = this.state.room.currentState.getStateEvents('m.room.canonical_alias', '');
        if (old_canonical_alias) {
            old_canonical_alias = old_canonical_alias.getContent().alias;
        }
        else {
            old_canonical_alias = "";   
        }

        var deferreds = [];

        if (old_name != newVals.name && newVals.name != undefined) {
            deferreds.push(
                MatrixClientPeg.get().setRoomName(this.state.room.roomId, newVals.name)
            );
        }

        if (old_topic != newVals.topic && newVals.topic != undefined) {
            deferreds.push(
                MatrixClientPeg.get().setRoomTopic(this.state.room.roomId, newVals.topic)
            );
        }

        if (old_join_rule != newVals.join_rule && newVals.join_rule != undefined) {
            deferreds.push(
                MatrixClientPeg.get().sendStateEvent(
                    this.state.room.roomId, "m.room.join_rules", {
                        join_rule: newVals.join_rule,
                    }, ""
                )
            );
        }

        // XXX: EVIL HACK: for now, don't let Vector clobber 'joined' visibility to 'invited'
        // just because it doesn't know about 'joined' yet.  In future we should fix it
        // properly - https://github.com/vector-im/vector-web/issues/731
        if (old_history_visibility === "joined") {
            old_history_visibility = "invited";
        }

        var visibilityDeferred;
        if (old_history_visibility != newVals.history_visibility &&
                newVals.history_visibility != undefined) {
            visibilityDeferred = 
                MatrixClientPeg.get().sendStateEvent(
                    this.state.room.roomId, "m.room.history_visibility", {
                        history_visibility: newVals.history_visibility,
                    }, ""
                );
        }

        if (old_guest_read != newVals.guest_read ||
            old_guest_join != newVals.guest_join)
        {
            var guestDeferred = 
                MatrixClientPeg.get().setGuestAccess(this.state.room.roomId, {
                    allowRead: newVals.guest_read,
                    allowJoin: newVals.guest_join
                });

            if (visibilityDeferred) {
                visibilityDeferred = visibilityDeferred.then(guestDeferred);
            }
            else {
                visibilityDeferred = guestDeferred;
            }
        }

        if (visibilityDeferred) {
            deferreds.push(visibilityDeferred);
        }

        // setRoomMutePushRule will do nothing if there is no change
        deferreds.push(
            MatrixClientPeg.get().setRoomMutePushRule(
                "global", this.state.room.roomId, newVals.are_notifications_muted
            )
        );

        if (newVals.power_levels) {
            deferreds.push(
                MatrixClientPeg.get().sendStateEvent(
                    this.state.room.roomId, "m.room.power_levels", newVals.power_levels, ""
                )
            );
        }

        if (newVals.alias_operations) {
            var oplist = [];
            for (var i = 0; i < newVals.alias_operations.length; i++) {
                var alias_operation = newVals.alias_operations[i];
                switch (alias_operation.type) {
                    case 'put':
                        oplist.push(
                            MatrixClientPeg.get().createAlias(
                                alias_operation.alias, this.state.room.roomId
                            )
                        );
                        break;
                    case 'delete':
                        oplist.push(
                            MatrixClientPeg.get().deleteAlias(
                                alias_operation.alias
                            )
                        );
                        break;
                    default:
                        console.log("Unknown alias operation, ignoring: " + alias_operation.type);
                }
            }

            if (oplist.length) {
                var deferred = oplist[0];
                oplist.splice(1).forEach(function (f) {
                    deferred = deferred.then(f);
                });
                deferreds.push(deferred);
            }
        }

        if (newVals.tag_operations) {
            // FIXME: should probably be factored out with alias_operations above
            var oplist = [];
            for (var i = 0; i < newVals.tag_operations.length; i++) {
                var tag_operation = newVals.tag_operations[i];
                switch (tag_operation.type) {
                    case 'put':
                        oplist.push(
                            MatrixClientPeg.get().setRoomTag(
                                this.props.roomId, tag_operation.tag, {}
                            )
                        );
                        break;
                    case 'delete':
                        oplist.push(
                            MatrixClientPeg.get().deleteRoomTag(
                                this.props.roomId, tag_operation.tag
                            )
                        );
                        break;
                    default:
                        console.log("Unknown tag operation, ignoring: " + tag_operation.type);
                }
            }

            if (oplist.length) {
                var deferred = oplist[0];
                oplist.splice(1).forEach(function (f) {
                    deferred = deferred.then(f);
                });
                deferreds.push(deferred);
            }            
        }

        if (old_canonical_alias !== newVals.canonical_alias) {
            deferreds.push(
                MatrixClientPeg.get().sendStateEvent(
                    this.state.room.roomId, "m.room.canonical_alias", {
                        alias: newVals.canonical_alias
                    }, ""
                )
            );            
        }

        if (newVals.color_scheme) {
            deferreds.push(
                MatrixClientPeg.get().setRoomAccountData(
                    this.state.room.roomId, "org.matrix.room.color_scheme", newVals.color_scheme
                )
            );
        }

        if (deferreds.length) {
            var self = this;
            q.allSettled(deferreds).then(
                function(results) {
                    var fails = results.filter(function(result) { return result.state !== "fulfilled" });
                    if (fails.length) {
                        fails.forEach(function(result) {
                            console.error(result.reason);
                        });
                        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                        Modal.createDialog(ErrorDialog, {
                            title: "Failed to set state",
                            description: fails.map(function(result) { return result.reason }).join("\n"),
                        });
                        self.refs.room_settings.resetState();
                    }
                    else {
                        self.setState({
                            editingRoomSettings: false
                        });
                    }
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

        var lastReadEvent = this.state.room.timeline[lastReadEventIndex];

        // we also remember the last read receipt we sent to avoid spamming the same one at the server repeatedly
        if (lastReadEventIndex > currentReadUpToEventIndex && this.last_rr_sent_event_id != lastReadEvent.getId()) {
            this.last_rr_sent_event_id = lastReadEvent.getId();
            MatrixClientPeg.get().sendReadReceipt(lastReadEvent).catch(() => {
                // it failed, so allow retries next time the user is active
                this.last_rr_sent_event_id = undefined;
            });
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
        this.showSettings(true);
    },

    onSaveClick: function() {
        this.setState({
            uploadingRoomSettings: true,
        });

        this.uploadNewState({
            name: this.refs.header.getRoomName(),
            topic: this.refs.header.getTopic(),
            join_rule: this.refs.room_settings.getJoinRules(),
            history_visibility: this.refs.room_settings.getHistoryVisibility(),
            are_notifications_muted: this.refs.room_settings.areNotificationsMuted(),
            power_levels: this.refs.room_settings.getPowerLevels(),
            alias_operations: this.refs.room_settings.getAliasOperations(),
            tag_operations: this.refs.room_settings.getTagOperations(),
            canonical_alias: this.refs.room_settings.getCanonicalAlias(),
            guest_join: this.refs.room_settings.canGuestsJoin(),
            guest_read: this.refs.room_settings.canGuestsRead(),
            color_scheme: this.refs.room_settings.getColorScheme(),
        });
    },

    onCancelClick: function() {
        this.updateTint();
        this.setState({editingRoomSettings: false});
    },

    onLeaveClick: function() {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.roomId,
        });
    },

    onForgetClick: function() {
        MatrixClientPeg.get().forget(this.props.roomId).done(function() {
            dis.dispatch({ action: 'view_next_room' });
        }, function(err) {
            var errCode = err.errcode || "unknown error code";
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: `Failed to forget room (${errCode})`
            });
        });
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

    onCancelSearchClick: function () {
        this.setState({
            searching: false,
            searchResults: null,
        });
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
        var messagePanel = this.refs.messagePanel;
        if (!messagePanel) return;
        messagePanel.scrollToBottom();
    },

    // scroll the event view to put the given event at the bottom.
    //
    // pixel_offset gives the number of pixels between the bottom of the event
    // and the bottom of the container.
    scrollToEvent: function(eventId, pixelOffset) {
        var messagePanel = this.refs.messagePanel;
        if (!messagePanel) return;

        var idx = this._indexForEventId(eventId);
        if (idx === null) {
            // we don't seem to have this event in our timeline. Presumably
            // it's fallen out of scrollback. We ought to backfill until we
            // find it, but we'd have to be careful we didn't backfill forever
            // looking for a non-existent event.
            //
            // for now, just scroll to the top of the buffer.
            console.log("Refusing to scroll to unknown event "+eventId);
            messagePanel.scrollToTop();
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

        // the scrollTokens on our DOM nodes are the event IDs, so we can pass
        // eventId directly into _scrollToToken.
        messagePanel.scrollToToken(eventId, pixelOffset);
    },

    // get the current scroll position of the room, so that it can be
    // restored when we switch back to it
    getScrollState: function() {
        var messagePanel = this.refs.messagePanel;
        if (!messagePanel) return null;

        return messagePanel.getScrollState();
    },

    restoreScrollState: function(scrollState) {
        var messagePanel = this.refs.messagePanel;
        if (!messagePanel) return null;

        if(scrollState.atBottom) {
            // we were at the bottom before. Ideally we'd scroll to the
            // 'read-up-to' mark here.
            messagePanel.scrollToBottom();

        } else if (scrollState.lastDisplayedScrollToken) {
            // we might need to backfill, so we call scrollToEvent rather than
            // scrollToToken here. The scrollTokens on our DOM nodes are the
            // event IDs, so lastDisplayedScrollToken will be the event ID we need,
            // and we can pass it directly into scrollToEvent.
            this.scrollToEvent(scrollState.lastDisplayedScrollToken,
                               scrollState.pixelOffset);
        }
    },

    onResize: function(e) {
        // It seems flexbox doesn't give us a way to constrain the auxPanel height to have
        // a minimum of the height of the video element, whilst also capping it from pushing out the page
        // so we have to do it via JS instead.  In this implementation we cap the height by putting
        // a maxHeight on the underlying remote video tag.

        // header + footer + status + give us at least 120px of scrollback at all times.
        var auxPanelMaxHeight = window.innerHeight -
                (83 + // height of RoomHeader
                 36 + // height of the status area
                 72 + // minimum height of the message compmoser
                 (this.state.editingRoomSettings ? (window.innerHeight * 0.3) : 120)); // amount of desired scrollback

        // XXX: this is a bit of a hack and might possibly cause the video to push out the page anyway
        // but it's better than the video going missing entirely
        if (auxPanelMaxHeight < 50) auxPanelMaxHeight = 50;

        if (this.refs.callView) {
            var video = this.refs.callView.getVideoView().getRemoteVideoElement();

            video.style.maxHeight = auxPanelMaxHeight + "px";
        }

        // we need to do this for general auxPanels too
        if (this.refs.auxPanel) {
            this.refs.auxPanel.style.maxHeight = auxPanelMaxHeight + "px";
        }

        // the above might have made the aux panel resize itself, so now
        // we need to tell the gemini panel to adapt.
        this.onChildResize();
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

    onChildResize: function() {
        // When the video or the message composer resizes, the scroll panel
        // also changes size.  Work around GeminiScrollBar fail by telling it
        // about it. This also ensures that the scroll offset is updated.
        if (this.refs.messagePanel) {
            this.refs.messagePanel.forceUpdate();
        }
    },

    showSettings: function(show) {
        // XXX: this is a bit naughty; we should be doing this via props
        if (show) {
            this.setState({editingRoomSettings: true});
            var self = this;
            setTimeout(function() { self.onResize() }, 0);
        }
    },

    render: function() {
        var RoomHeader = sdk.getComponent('rooms.RoomHeader');
        var MessageComposer = sdk.getComponent('rooms.MessageComposer');
        var CallView = sdk.getComponent("voip.CallView");
        var RoomSettings = sdk.getComponent("rooms.RoomSettings");
        var SearchBar = sdk.getComponent("rooms.SearchBar");
        var ScrollPanel = sdk.getComponent("structures.ScrollPanel");
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        var RoomPreviewBar = sdk.getComponent("rooms.RoomPreviewBar");

        if (!this.state.room) {
            if (this.props.roomId) {
                if (this.props.autoPeek && !this.state.autoPeekDone) {
                    var Loader = sdk.getComponent("elements.Spinner");
                    return (
                        <div className="mx_RoomView">
                            <Loader />
                        </div>
                    );                
                }
                else {
                    var joinErrorText = this.state.joinError ? "Failed to join room!" : "";
                    return (
                        <div className="mx_RoomView">
                            <RoomHeader ref="header" room={this.state.room} simpleHeader="Join room"/>
                            <div className="mx_RoomView_auxPanel">
                                <RoomPreviewBar onJoinClick={ this.onJoinButtonClicked } 
                                                canJoin={ true } canPreview={ false }/>
                                <div className="error">{joinErrorText}</div>
                            </div>
                            <div className="mx_RoomView_messagePanel"></div>
                        </div>
                    );                    
                }
            }
            else {
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
                // FIXME: This comment is now outdated - what do we need to fix? ^
                var joinErrorText = this.state.joinError ? "Failed to join room!" : "";
                var rejectErrorText = this.state.rejectError ? "Failed to reject invite!" : "";

                // We deliberately don't try to peek into invites, even if we have permission to peek
                // as they could be a spam vector.
                // XXX: in future we could give the option of a 'Preview' button which lets them view anyway.

                return (
                    <div className="mx_RoomView">
                        <RoomHeader ref="header" room={this.state.room}/>
                        <div className="mx_RoomView_auxPanel">
                            <RoomPreviewBar onJoinClick={ this.onJoinButtonClicked } 
                                            onRejectClick={ this.onRejectButtonClicked }
                                            inviterName={ inviterName }
                                            canJoin={ true } canPreview={ false }/>
                            <div className="error">{joinErrorText}</div>
                            <div className="error">{rejectErrorText}</div>
                        </div>
                        <div className="mx_RoomView_messagePanel"></div>
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
                            <img src="img/warning.svg" width="24" height="23" title="/!\ " alt="/!\ "/>
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
                else if (this.tabComplete.isTabCompleting()) {
                    var TabCompleteBar = sdk.getComponent('rooms.TabCompleteBar');
                    statusBar = (
                        <div className="mx_RoomView_tabCompleteBar">
                            <div className="mx_RoomView_tabCompleteImage">...</div>
                            <div className="mx_RoomView_tabCompleteWrapper">
                                <TabCompleteBar entries={this.tabComplete.peek(6)} />
                                <div className="mx_RoomView_tabCompleteEol" title="->|">
                                    <TintableSvg src="img/eol.svg" width="22" height="16"/>
                                    Auto-complete
                                </div>
                            </div>
                        </div>
                    );
                }
                else if (this.state.hasUnsentMessages) {
                    statusBar = (
                        <div className="mx_RoomView_connectionLostBar">
                            <img src="img/warning.svg" width="24" height="23" title="/!\ " alt="/!\ "/>
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
                            <img src="img/newmessages.svg" width="24" height="24" alt=""/>
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
                else if (!this.state.atBottom) {
                    statusBar = (
                        <div className="mx_RoomView_scrollToBottomBar" onClick={ this.scrollToBottom }>
                            <img src="img/scrolldown.svg" width="24" height="24" alt="Scroll to bottom of page" title="Scroll to bottom of page"/>
                        </div>                        
                    );
                }
            }

            var aux = null;
            if (this.state.editingRoomSettings) {
                aux = <RoomSettings ref="room_settings" onSaveClick={this.onSaveClick} onCancelClick={this.onCancelClick} room={this.state.room} />;
            }
            else if (this.state.uploadingRoomSettings) {
                var Loader = sdk.getComponent("elements.Spinner");                
                aux = <Loader/>;
            }
            else if (this.state.searching) {
                aux = <SearchBar ref="search_bar" searchInProgress={this.state.searchInProgress } onCancelClick={this.onCancelSearchClick} onSearch={this.onSearch}/>;
            }
            else if (this.state.guestsCanJoin && MatrixClientPeg.get().isGuest() &&
                    (!myMember || myMember.membership !== "join")) {
                aux = (
                    <RoomPreviewBar onJoinClick={this.onJoinButtonClicked} canJoin={true} />
                );
            }
            else if (this.state.canPeek &&
                    (!myMember || myMember.membership !== "join")) {
                aux = (
                    <RoomPreviewBar onJoinClick={this.onJoinButtonClicked} canJoin={true} />
                );
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
                                    <div className="mx_RoomView_fileDropTargetLabel" title="Drop File Here">
                                        <TintableSvg src="img/upload-big.svg" width="45" height="59"/><br/>
                                        Drop file here to upload
                                    </div>
                                 </div>;
            }

            var messageComposer, searchInfo;
            var canSpeak = (
                // joined and not showing search results
                myMember && (myMember.membership == 'join') && !this.state.searchResults
            );
            if (canSpeak) {
                messageComposer =
                    <MessageComposer
                        room={this.state.room} onResize={this.onChildResize} uploadFile={this.uploadFile}
                        callState={this.state.callState} tabComplete={this.tabComplete} />
            }

            // TODO: Why aren't we storing the term/scope/count in this format
            // in this.state if this is what RoomHeader desires?
            if (this.state.searchResults) {
                searchInfo = {
                    searchTerm : this.state.searchTerm,
                    searchScope : this.state.searchScope,
                    searchCount : this.state.searchResults.count,
                };
            }

            var call = CallHandler.getCallForRoom(this.props.roomId);
            //var call = CallHandler.getAnyActiveCall();
            var inCall = false;
            if (call && (this.state.callState !== 'ended' && this.state.callState !== 'ringing')) {
                inCall = true;
                var zoomButton, voiceMuteButton, videoMuteButton;

                if (call.type === "video") {
                    zoomButton = (
                        <div className="mx_RoomView_voipButton" onClick={this.onFullscreenClick} title="Fill screen">
                            <TintableSvg src="img/fullscreen.svg" width="29" height="22" style={{ marginTop: 1, marginRight: 4 }}/>
                        </div>
                    );

                    videoMuteButton =
                        <div className="mx_RoomView_voipButton" onClick={this.onMuteVideoClick}>
                            <img src={call.isLocalVideoMuted() ? "img/video-unmute.svg" : "img/video-mute.svg"}
                                 alt={call.isLocalVideoMuted() ? "Click to unmute video" : "Click to mute video"}
                                 width="31" height="27"/>
                        </div>
                }
                voiceMuteButton =
                    <div className="mx_RoomView_voipButton" onClick={this.onMuteAudioClick}>
                        <img src={call.isMicrophoneMuted() ? "img/voice-unmute.svg" : "img/voice-mute.svg"} 
                             alt={call.isMicrophoneMuted() ? "Click to unmute audio" : "Click to mute audio"} 
                             width="21" height="26"/>
                    </div>

                if (!statusBar) {
                    statusBar =
                        <div className="mx_RoomView_callBar">
                            <img src="img/sound-indicator.svg" width="23" height="20"/>
                            <b>Active call</b>
                        </div>;
                }

                statusBar =
                    <div className="mx_RoomView_callStatusBar">
                        { voiceMuteButton }
                        { videoMuteButton }
                        { zoomButton }
                        { statusBar }
                        <TintableSvg className="mx_RoomView_voipChevron" src="img/voip-chevron.svg" width="22" height="17"/>
                    </div>
            }

            // if we have search results, we keep the messagepanel (so that it preserves its
            // scroll state), but hide it.
            var searchResultsPanel;
            var hideMessagePanel = false;

            if (this.state.searchResults) {
                searchResultsPanel = (
                    <ScrollPanel ref="searchResultsPanel" className="mx_RoomView_messagePanel"
                            onFillRequest={ this.onSearchResultsFillRequest }>
                        <li className={scrollheader_classes}></li>
                        {this.getSearchResultTiles()}
                    </ScrollPanel>
                );
                hideMessagePanel = true;
            }

            var messagePanel = (
                    <ScrollPanel ref="messagePanel" className="mx_RoomView_messagePanel"
                            onScroll={ this.onMessageListScroll } 
                            onFillRequest={ this.onMessageListFillRequest }
                            style={ hideMessagePanel ? { display: 'none' } : {} } >
                        <li className={scrollheader_classes}></li>
                        {this.getEventTiles()}
                    </ScrollPanel>
            );

            return (
                <div className={ "mx_RoomView" + (inCall ? " mx_RoomView_inCall" : "") } ref="roomView">
                    <RoomHeader ref="header" room={this.state.room} searchInfo={searchInfo}
                        editing={this.state.editingRoomSettings}
                        onSearchClick={this.onSearchClick}
                        onSettingsClick={this.onSettingsClick}
                        onSaveClick={this.onSaveClick}
                        onCancelClick={this.onCancelClick}
                        onForgetClick={
                            (myMember && myMember.membership === "leave") ? this.onForgetClick : null
                        }
                        onLeaveClick={
                            (myMember && myMember.membership === "join") ? this.onLeaveClick : null
                        } />
                    <div className="mx_RoomView_auxPanel" ref="auxPanel">
                        { fileDropTarget }    
                        <CallView ref="callView" room={this.state.room} ConferenceHandler={this.props.ConferenceHandler}
                            onResize={this.onChildResize} />
                        { conferenceCallNotification }
                        { aux }
                    </div>
                    { messagePanel }
                    { searchResultsPanel }
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
