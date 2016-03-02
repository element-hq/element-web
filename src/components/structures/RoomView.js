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
//  - Search results component
//  - Drag and drop
//  - File uploading - uploadFile()

var React = require("react");
var ReactDOM = require("react-dom");
var q = require("q");
var classNames = require("classnames");
var Matrix = require("matrix-js-sdk");

var MatrixClientPeg = require("../../MatrixClientPeg");
var ContentMessages = require("../../ContentMessages");
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
var rate_limited_func = require('../../ratelimitedfunc');

var DEBUG = false;

if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    var debuglog = console.log.bind(console);
} else {
    var debuglog = function () {};
}

module.exports = React.createClass({
    displayName: 'RoomView',
    propTypes: {
        ConferenceHandler: React.PropTypes.any,

        roomId: React.PropTypes.string.isRequired,

        // The URL used to join this room from an email invite
        // (given as part of the link in the invite email)
        inviteSignUrl: React.PropTypes.string,

        // Any data about the room that would normally come from the Home Server
        // but has been passed out-of-band, eg. the room name and avatar URL
        // from an email invite (a workaround for the fact that we can't
        // get this information from the HS using an email invite).
        // Fields:
        //  * name (string) The room's name
        //  * avatarUrl (string) The mxc:// avatar URL for the room
        //  * inviterName (string) The display name of the person who
        //  *                      invited us tovthe room
        oobData: React.PropTypes.object,

        // id of an event to jump to. If not given, will go to the end of the
        // live timeline.
        eventId: React.PropTypes.string,

        // where to position the event given by eventId, in pixels from the
        // bottom of the viewport. If not given, will try to put the event
        // 1/3 of the way down the viewport.
        eventPixelOffset: React.PropTypes.number,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        // Typically this will either be the same as 'eventId', or undefined.
        highlightedEventId: React.PropTypes.string,
    },

    getInitialState: function() {
        var room = this.props.roomId ? MatrixClientPeg.get().getRoom(this.props.roomId) : null;
        return {
            room: room,
            roomLoading: !room,
            editingRoomSettings: false,
            uploadingRoomSettings: false,
            numUnreadMessages: 0,
            draggingFile: false,
            searching: false,
            searchResults: null,
            hasUnsentMessages: this._hasUnsentMessages(room),
            callState: null,
            guestsCanJoin: false,
            canPeek: false,

            // this is true if we are fully scrolled-down, and are looking at
            // the end of the live timeline. It has the effect of hiding the
            // 'scroll to bottom' knob, among a couple of other things.
            atEndOfLiveTimeline: true,

            showTopUnreadMessagesBar: false,

            auxPanelMaxHeight: undefined,
        }
    },

    componentWillMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on("Room", this.onRoom);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        MatrixClientPeg.get().on("Room.name", this.onRoomName);
        MatrixClientPeg.get().on("Room.accountData", this.onRoomAccountData);
        MatrixClientPeg.get().on("RoomState.members", this.onRoomStateMember);
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
            console.log("Attempting to peek into room %s", this.props.roomId);

            MatrixClientPeg.get().peekInRoom(this.props.roomId).then((room) => {
                this.setState({
                    room: room,
                    roomLoading: false,
                });
                this._onRoomLoaded(room);
            }, (err) => {
                // This won't necessarily be a MatrixError, but we duck-type
                // here and say if it's got an 'errcode' key with the right value,
                // it means we can't peek.
                if (err.errcode == "M_GUEST_ACCESS_FORBIDDEN") {
                    // This is fine: the room just isn't peekable (we assume).
                    this.setState({
                        roomLoading: false,
                    });
                } else {
                    throw err;
                }
            }).done();
        } else {
            this._onRoomLoaded(this.state.room);
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
            MatrixClientPeg.get().removeListener("Room", this.onRoom);
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
            MatrixClientPeg.get().removeListener("Room.name", this.onRoomName);
            MatrixClientPeg.get().removeListener("Room.accountData", this.onRoomAccountData);
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
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
        }
    },

    componentWillReceiveProps: function(newProps) {
        if (newProps.roomId != this.props.roomId) {
            throw new Error("changing room on a RoomView is not supported");
        }

        if (newProps.eventId != this.props.eventId) {
            // when we change focussed event id, hide the search results.
            this.setState({searchResults: null});
        }
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline, removed, data) {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (room.roomId != this.props.roomId) return;

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        // no point handling anything while we're waiting for the join to finish:
        // we'll only be showing a spinner.
        if (this.state.joining) return;

        if (ev.getSender() !== MatrixClientPeg.get().credentials.userId) {
            // update unread count when scrolled up
            if (!this.state.searchResults && this.state.atEndOfLiveTimeline) {
                // no change
            }
            else {
                this.setState((state, props) => { 
                    return {numUnreadMessages: state.numUnreadMessages + 1};
                });
            }
        }
    },

    // called when state.room is first initialised (either at initial load,
    // after a successful peek, or after we join the room).
    _onRoomLoaded: function(room) {
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

    onRoom: function(room) {
        // This event is fired when the room is 'stored' by the JS SDK, which
        // means it's now a fully-fledged room object ready to be used, so
        // set it in our state and start using it (ie. init the timeline)
        // This will happen if we start off viewing a room we're not joined,
        // then join it whilst RoomView is looking at that room.
        if (room.roomId == this.props.roomId && !this.state.room) {
            this.setState({
                room: room
            });
            this._onRoomLoaded(room);
        }
    },

    onRoomName: function(room) {
        // NB don't set state.room here.
        //
        // When peeking, this event lands *before* the timeline is correctly
        // synced; if we set state.room here, the TimelinePanel will be
        // instantiated, and it will initialise its scroll state, with *no
        // events*. In short, the scroll state will be all messed up.
        //
        // There's no need to set state.room here anyway.
        if (room.roomId == this.props.roomId) { 
            this.forceUpdate();
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

    onRoomStateMember: function(ev, state, member) {
        if (member.roomId === this.props.roomId) {
            // a member state changed in this room, refresh the tab complete list
            this._updateTabCompleteList();

            var room = MatrixClientPeg.get().getRoom(this.props.roomId);
            if (!room) return;
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
        var call = CallHandler.getCallForRoom(this.props.roomId);
        var callState = call ? call.call_state : "ended";
        this.setState({
            callState: callState
        });

        this._updateConfCallNotification();

        window.addEventListener('resize', this.onResize);
        this.onResize();

        this._updateTabCompleteList();

        // XXX: EVIL HACK to autofocus inviting on empty rooms.
        // We use the setTimeout to avoid racing with focus_composer.
        if (this.state.room && this.state.room.getJoinedMembers().length == 1) {
            var inviteBox = document.getElementById("mx_SearchableEntityList_query");
            setTimeout(function() {
                if (inviteBox) {
                    inviteBox.focus();
                }
            }, 50);
        }
    },

    _updateTabCompleteList: new rate_limited_func(function() {
        if (!this.state.room || !this.tabComplete) {
            return;
        }
        this.tabComplete.setCompletionList(
            MemberEntry.fromMemberList(this.state.room.getJoinedMembers()).concat(
                CommandEntry.fromCommands(SlashCommands.getCommandList())
            )
        );
    }, 500),

    componentDidUpdate: function() {
        if (this.refs.roomView) {
            var roomView = ReactDOM.findDOMNode(this.refs.roomView);
            if (!roomView.ondrop) {
                roomView.addEventListener('drop', this.onDrop);
                roomView.addEventListener('dragover', this.onDragOver);
                roomView.addEventListener('dragleave', this.onDragLeaveOrEnd);
                roomView.addEventListener('dragend', this.onDragLeaveOrEnd);
            }
        }
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

    onResendAllClick: function() {
        var eventsToResend = this._getUnsentMessages(this.state.room);
        eventsToResend.forEach(function(event) {
            Resend.resend(event);
        });
    },

    onJoinButtonClicked: function(ev) {
        var self = this;

        var cli = MatrixClientPeg.get();
        var display_name_promise = q();
        // if this is the first room we're joining, check the user has a display name
        // and if they don't, prompt them to set one.
        // NB. This unfortunately does not re-use the ChangeDisplayName component because
        // it doesn't behave quite as desired here (we want an input field here rather than
        // content-editable, and we want a default).
        if (cli.getRooms().filter((r) => {
            return r.hasMembershipState(cli.credentials.userId, "join");
        })) {
            display_name_promise = cli.getProfileInfo(cli.credentials.userId).then((result) => {
                if (!result.displayname) {
                    var SetDisplayNameDialog = sdk.getComponent('views.dialogs.SetDisplayNameDialog');
                    var dialog_defer = q.defer();
                    var dialog_ref;
                    var modal;
                    var dialog_instance = <SetDisplayNameDialog currentDisplayName={result.displayname} ref={(r) => {
                            dialog_ref = r;
                    }} onFinished={() => {
                        cli.setDisplayName(dialog_ref.getValue()).done(() => {
                            dialog_defer.resolve();
                        });
                        modal.close();
                    }} />
                    modal = Modal.createDialogWithElement(dialog_instance);
                    return dialog_defer.promise;
                }
            });
        }

        display_name_promise.then(() => {
            return MatrixClientPeg.get().joinRoom(this.props.roomId, { inviteSignUrl: this.props.inviteSignUrl } )
        }).done(function() {
            // It is possible that there is no Room yet if state hasn't come down
            // from /sync - joinRoom will resolve when the HTTP request to join succeeds,
            // NOT when it comes down /sync. If there is no room, we'll keep the
            // joining flag set until we see it. Likewise, if our state is not
            // "join" we'll keep this flag set until it comes down /sync.

            // We'll need to initialise the timeline when joining, but due to
            // the above, we can't do it here: we do it in onRoom instead,
            // once we have a useable room object.
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
        if (this.refs.messagePanel.isAtEndOfLiveTimeline()) {
            this.setState({
                numUnreadMessages: 0,
                atEndOfLiveTimeline: true,
            });
        }
        else {
            this.setState({
                atEndOfLiveTimeline: false,
            });
        }
        this._updateTopUnreadMessagesBar();
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

        // once images in the search results load, make the scrollPanel check
        // the scroll offsets.
        var onImageLoad = () => {
            var scrollPanel = this.refs.searchResultsPanel;
            if (scrollPanel) {
                scrollPanel.checkScroll();
            }
        }

        var lastRoomId;

        for (var i = this.state.searchResults.results.length - 1; i >= 0; i--) {
            var result = this.state.searchResults.results[i];

            var mxEv = result.context.getEvent();
            var roomId = mxEv.getRoomId();

            if (!EventTile.haveTileForEvent(mxEv)) {
                // XXX: can this ever happen? It will make the result count
                // not match the displayed count.
                continue;
            }

            if (this.state.searchScope === 'All') {
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

            var resultLink = "#/room/"+roomId+"/"+mxEv.getId();

            ret.push(<SearchResultTile key={mxEv.getId()}
                     searchResult={result}
                     searchHighlights={this.state.searchHighlights}
                     resultLink={resultLink}
                     onImageLoad={onImageLoad}/>);
        }
        return ret;
    },

    onSettingsClick: function() {
        this.showSettings(true);
    },

    onSettingsSaveClick: function() {
        this.setState({
            uploadingRoomSettings: true,
        });
        
        this.refs.room_settings.setName(this.refs.header.getRoomName());
        this.refs.room_settings.setTopic(this.refs.header.getTopic());
        
        this.refs.room_settings.save().then((results) => {
            var fails = results.filter(function(result) { return result.state !== "fulfilled" });
            console.log("Settings saved with %s errors", fails.length);
            if (fails.length) {
                fails.forEach(function(result) {
                    console.error(result.reason);
                });
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Failed to save settings",
                    description: fails.map(function(result) { return result.reason }).join("\n"),
                });
                // still editing room settings
            }
            else {
                this.setState({
                    editingRoomSettings: false
                });
            }
        }).finally(() => {
            this.setState({
                uploadingRoomSettings: false,
                editingRoomSettings: false
            });
        }).done();
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
        }, function(error) {
            console.error("Failed to reject invite: %s", error);

            var msg = error.message ? error.message : JSON.stringify(error);
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Failed to reject invite",
                description: msg
            });

            self.setState({
                rejecting: false,
                rejectError: error
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

    // jump down to the bottom of this room, where new events are arriving
    jumpToLiveTimeline: function() {
        this.refs.messagePanel.jumpToLiveTimeline();
    },

    // jump up to wherever our read marker is
    jumpToReadMarker: function() {
        this.refs.messagePanel.jumpToReadMarker();
    },

    // update the read marker to match the read-receipt
    forgetReadMarker: function() {
        this.refs.messagePanel.forgetReadMarker();
    },

    // decide whether or not the top 'unread messages' bar should be shown
    _updateTopUnreadMessagesBar: function() {
        if (!this.refs.messagePanel)
            return;

        var pos = this.refs.messagePanel.getReadMarkerPosition();

        // we want to show the bar if the read-marker is off the top of the
        // screen.
        var showBar = (pos < 0);

        this.setState({showTopUnreadMessagesBar: showBar});
    },

    // get the current scroll position of the room, so that it can be
    // restored when we switch back to it.
    //
    // If there is no special scroll state (ie, we are following the live
    // timeline), returns null. Otherwise, returns an object with the following
    // properties:
    //
    //    focussedEvent: the ID of the 'focussed' event. Typically this is the
    //        last event fully visible in the viewport, though if we have done
    //        an explicit scroll to an explicit event, it will be that event.
    //
    //    pixelOffset: the number of pixels the window is scrolled down from
    //        the focussedEvent.
    //
    //
    getScrollState: function() {
        var messagePanel = this.refs.messagePanel;
        if (!messagePanel) return null;

        // if we're following the live timeline, we want to return null; that
        // means that, if we switch back, we will jump to the read-up-to mark.
        //
        // That should be more intuitive than slavishly preserving the current
        // scroll state, in the case where the room advances in the meantime
        // (particularly in the case that the user reads some stuff on another
        // device).
        //
        if (this.state.atEndOfLiveTimeline) {
            return null;
        }

        var scrollState = messagePanel.getScrollState();

        if (scrollState.stuckAtBottom) {
            // we don't really expect to be in this state, but it will
            // occasionally happen when no scroll state has been set on the
            // messagePanel (ie, we didn't have an initial event (so it's
            // probably a new room), there has been no user-initiated scroll, and
            // no read-receipts have arrived to update the scroll position).
            //
            // Return null, which will cause us to scroll to last unread on
            // reload.
            return null;
        }

        return {
            focussedEvent: scrollState.trackedScrollToken,
            pixelOffset: scrollState.pixelOffset,
        };
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

        // we may need to resize the gemini panel after changing the aux panel
        // size, so add a callback to onChildResize.
        this.setState({auxPanelMaxHeight: auxPanelMaxHeight},
                      this.onChildResize);
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
        // When the video, status bar, or the message composer resizes, the
        // scroll panel also changes size.  Work around GeminiScrollBar fail by
        // telling it about it. This also ensures that the scroll offset is
        // updated.
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
        var RoomSettings = sdk.getComponent("rooms.RoomSettings");
        var AuxPanel = sdk.getComponent("rooms.AuxPanel");
        var SearchBar = sdk.getComponent("rooms.SearchBar");
        var ScrollPanel = sdk.getComponent("structures.ScrollPanel");
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        var RoomPreviewBar = sdk.getComponent("rooms.RoomPreviewBar");
        var Loader = sdk.getComponent("elements.Spinner");
        var TimelinePanel = sdk.getComponent("structures.TimelinePanel");

        if (!this.state.room) {
            if (this.props.roomId) {
                if (this.state.roomLoading) {
                    return (
                        <div className="mx_RoomView">
                            <Loader />
                        </div>
                    );                
                }
                else {
                    var inviterName = undefined;
                    if (this.props.oobData) {
                        inviterName = this.props.oobData.inviterName;
                    }

                    return (
                        <div className="mx_RoomView">
                            <RoomHeader ref="header" room={this.state.room} oobData={this.props.oobData} />
                            <div className="mx_RoomView_auxPanel">
                                <RoomPreviewBar onJoinClick={ this.onJoinButtonClicked } 
                                                canJoin={ true } canPreview={ false }
                                                spinner={this.state.joining}
                                                inviterName={inviterName}
                                />
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
                return (
                    <div className="mx_RoomView">
                        <Loader />
                    </div>
                );
            } else {
                var inviteEvent = myMember.events.member;
                var inviterName = inviteEvent.sender ? inviteEvent.sender.name : inviteEvent.getSender();

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
                                            canJoin={ true } canPreview={ false }
                                            spinner={this.state.joining}
                            />
                        </div>
                        <div className="mx_RoomView_messagePanel"></div>
                    </div>
                );
            }
        }

        // We have successfully loaded this room, and are not previewing.
        // Display the "normal" room view.

        var call = CallHandler.getCallForRoom(this.props.roomId);
        var inCall = false;
        if (call && (this.state.callState !== 'ended' && this.state.callState !== 'ringing')) {
            inCall = true;
        }

        var scrollheader_classes = classNames({
            mx_RoomView_scrollheader: true,
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
            var RoomStatusBar = sdk.getComponent('structures.RoomStatusBar');
            var tabEntries = this.tabComplete.isTabCompleting() ?
                this.tabComplete.peek(6) : null;

            statusBar = <RoomStatusBar
                room={this.state.room}
                tabCompleteEntries={tabEntries}
                numUnreadMessages={this.state.numUnreadMessages}
                hasUnsentMessages={this.state.hasUnsentMessages}
                atEndOfLiveTimeline={this.state.atEndOfLiveTimeline}
                hasActiveCall={inCall}
                onResendAllClick={this.onResendAllClick}
                onScrollToBottomClick={this.jumpToLiveTimeline}
                onResize={this.onChildResize}
                />
        }

        var aux = null;
        if (this.state.editingRoomSettings) {
            aux = <RoomSettings ref="room_settings" onSaveClick={this.onSettingsSaveClick} onCancelClick={this.onCancelClick} room={this.state.room} />;
        }
        else if (this.state.uploadingRoomSettings) {
            aux = <Loader/>;
        }
        else if (this.state.searching) {
            aux = <SearchBar ref="search_bar" searchInProgress={this.state.searchInProgress } onCancelClick={this.onCancelSearchClick} onSearch={this.onSearch}/>;
        }
        else if (this.state.guestsCanJoin && MatrixClientPeg.get().isGuest() &&
                (!myMember || myMember.membership !== "join")) {
            aux = (
                <RoomPreviewBar onJoinClick={this.onJoinButtonClicked} canJoin={true}
                                spinner={this.state.joining}
                />
            );
        }
        else if (this.state.canPeek &&
                (!myMember || myMember.membership !== "join")) {
            aux = (
                <RoomPreviewBar onJoinClick={this.onJoinButtonClicked} canJoin={true}
                                spinner={this.state.joining}
                />
            );
        }

        var auxPanel = (
            <AuxPanel ref="auxPanel" room={this.state.room}
              conferenceHandler={this.props.ConferenceHandler}
              draggingFile={this.state.draggingFile}
              displayConfCallNotification={this.state.displayConfCallNotification}
              maxHeight={this.state.auxPanelMaxHeight}
              onCallViewVideoRezize={this.onChildResize} >
                { aux }
            </AuxPanel>
        );

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

        if (inCall) {
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

            // wrap the existing status bar into a 'callStatusBar' which adds more knobs.
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
            <TimelinePanel ref={(r) => {
                    this.refs.messagePanel = r;
                    if(r) {
                        this.updateTint();
                    }
                }}
                room={this.state.room}
                hidden={hideMessagePanel}
                highlightedEventId={this.props.highlightedEventId}
                eventId={this.props.eventId}
                eventPixelOffset={this.props.eventPixelOffset}
                onScroll={ this.onMessageListScroll }
                onReadMarkerUpdated={ this._updateTopUnreadMessagesBar }
            />);

        var topUnreadMessagesBar = null;
        if (this.state.showTopUnreadMessagesBar) {
            var TopUnreadMessagesBar = sdk.getComponent('rooms.TopUnreadMessagesBar');
            topUnreadMessagesBar = (
                <div className="mx_RoomView_topUnreadMessagesBar">
                    <TopUnreadMessagesBar
                       onScrollUpClick={this.jumpToReadMarker}
                       onCloseClick={this.forgetReadMarker}
                    />
                </div>
            );
        }

        return (
            <div className={ "mx_RoomView" + (inCall ? " mx_RoomView_inCall" : "") } ref="roomView">
                <RoomHeader ref="header" room={this.state.room} searchInfo={searchInfo}
                    oobData={this.props.oobData}
                    editing={this.state.editingRoomSettings}
                    onSearchClick={this.onSearchClick}
                    onSettingsClick={this.onSettingsClick}
                    onSaveClick={this.onSettingsSaveClick}
                    onCancelClick={this.onCancelClick}
                    onForgetClick={
                        (myMember && myMember.membership === "leave") ? this.onForgetClick : null
                    }
                    onLeaveClick={
                        (myMember && myMember.membership === "join") ? this.onLeaveClick : null
                    } />
                { auxPanel }
                { topUnreadMessagesBar }
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
    },
});
