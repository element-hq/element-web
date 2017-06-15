/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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
import { _t } from '../../languageHandler';

var UserSettingsStore = require('../../UserSettingsStore');
var MatrixClientPeg = require("../../MatrixClientPeg");
var ContentMessages = require("../../ContentMessages");
var Modal = require("../../Modal");
var sdk = require('../../index');
var CallHandler = require('../../CallHandler');
var TabComplete = require("../../TabComplete");
var Resend = require("../../Resend");
var dis = require("../../dispatcher");
var Tinter = require("../../Tinter");
var rate_limited_func = require('../../ratelimitedfunc');
var ObjectUtils = require('../../ObjectUtils');
var Rooms = require('../../Rooms');

import KeyCode from '../../KeyCode';

import UserProvider from '../../autocomplete/UserProvider';

import RoomViewStore from '../../stores/RoomViewStore';

var DEBUG = false;

if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    var debuglog = console.log.bind(console);
} else {
    var debuglog = function() {};
}

module.exports = React.createClass({
    displayName: 'RoomView',
    propTypes: {
        ConferenceHandler: React.PropTypes.any,

        // Called with the credentials of a registered user (if they were a ROU that
        // transitioned to PWLU)
        onRegistered: React.PropTypes.func,

        // An object representing a third party invite to join this room
        // Fields:
        // * inviteSignUrl (string) The URL used to join this room from an email invite
        //                          (given as part of the link in the invite email)
        // * invitedEmail (string) The email address that was invited to this room
        thirdPartyInvite: React.PropTypes.object,

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

        // is the RightPanel collapsed?
        collapsedRhs: React.PropTypes.bool,
    },

    getInitialState: function() {
        return {
            room: null,
            roomId: null,
            roomLoading: true,
            peekLoading: false,

            // The event to be scrolled to initially
            initialEventId: null,
            // The offset in pixels from the event with which to scroll vertically
            initialEventPixelOffset: null,
            // Whether to highlight the event scrolled to
            isInitialEventHighlighted: null,

            forwardingEvent: null,
            editingRoomSettings: false,
            uploadingRoomSettings: false,
            numUnreadMessages: 0,
            draggingFile: false,
            searching: false,
            searchResults: null,
            unsentMessageError: '',
            callState: null,
            guestsCanJoin: false,
            canPeek: false,

            // error object, as from the matrix client/server API
            // If we failed to load information about the room,
            // store the error here.
            roomLoadError: null,

            // this is true if we are fully scrolled-down, and are looking at
            // the end of the live timeline. It has the effect of hiding the
            // 'scroll to bottom' knob, among a couple of other things.
            atEndOfLiveTimeline: true,

            showTopUnreadMessagesBar: false,

            auxPanelMaxHeight: undefined,

            statusBarVisible: false,
        };
    },

    componentWillMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on("Room", this.onRoom);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        MatrixClientPeg.get().on("Room.name", this.onRoomName);
        MatrixClientPeg.get().on("Room.accountData", this.onRoomAccountData);
        MatrixClientPeg.get().on("RoomState.members", this.onRoomStateMember);
        MatrixClientPeg.get().on("RoomMember.membership", this.onRoomMemberMembership);
        MatrixClientPeg.get().on("accountData", this.onAccountData);

        this.tabComplete = new TabComplete({
            allowLooping: false,
            autoEnterTabComplete: true,
            onClickCompletes: true,
            onStateChange: (isCompleting) => {
                this.forceUpdate();
            },
        });

        // Start listening for RoomViewStore updates
        this._roomStoreToken = RoomViewStore.addListener(this._onRoomViewStoreUpdate);
        this._onRoomViewStoreUpdate(true);
    },

    _onRoomViewStoreUpdate: function(initial) {
        if (this.unmounted) {
            return;
        }
        const newState = {
            roomId: RoomViewStore.getRoomId(),
            roomAlias: RoomViewStore.getRoomAlias(),
            roomLoading: RoomViewStore.isRoomLoading(),
            roomLoadError: RoomViewStore.getRoomLoadError(),
            joining: RoomViewStore.isJoining(),
            initialEventId: RoomViewStore.getInitialEventId(),
            initialEventPixelOffset: RoomViewStore.getInitialEventPixelOffset(),
            isInitialEventHighlighted: RoomViewStore.isInitialEventHighlighted(),
        };

        // Temporary logging to diagnose https://github.com/vector-im/riot-web/issues/4307
        console.log(
            'RVS update:',
            newState.roomId,
            newState.roomAlias,
            'loading?', newState.roomLoading,
            'joining?', newState.joining,
        );

        // finished joining, start waiting for a room and show a spinner. See onRoom.
        newState.waitingForRoom = this.state.joining && !newState.joining &&
                        !RoomViewStore.getJoinError();

        // NB: This does assume that the roomID will not change for the lifetime of
        // the RoomView instance
        if (initial) {
            newState.room = MatrixClientPeg.get().getRoom(newState.roomId);
        }

        // Clear the search results when clicking a search result (which changes the
        // currently scrolled to event, this.state.initialEventId).
        if (this.state.initialEventId !== newState.initialEventId) {
            newState.searchResults = null;
        }

        // Store the scroll state for the previous room so that we can return to this
        // position when viewing this room in future.
        if (this.state.roomId !== newState.roomId) {
            this._updateScrollMap(this.state.roomId);
        }

        this.setState(newState, () => {
            // At this point, this.state.roomId could be null (e.g. the alias might not
            // have been resolved yet) so anything called here must handle this case.
            if (initial) {
                this._onHaveRoom();
            }
        });
    },

    _onHaveRoom: function() {
        // if this is an unknown room then we're in one of three states:
        // - This is a room we can peek into (search engine) (we can /peek)
        // - This is a room we can publicly join or were invited to. (we can /join)
        // - This is a room we cannot join at all. (no action can help us)
        // We can't try to /join because this may implicitly accept invites (!)
        // We can /peek though. If it fails then we present the join UI. If it
        // succeeds then great, show the preview (but we still may be able to /join!).
        // Note that peeking works by room ID and room ID only, as opposed to joining
        // which must be by alias or invite wherever possible (peeking currently does
        // not work over federation).

        // NB. We peek if we have never seen the room before (i.e. js-sdk does not know
        // about it). We don't peek in the historical case where we were joined but are
        // now not joined because the js-sdk peeking API will clobber our historical room,
        // making it impossible to indicate a newly joined room.
        const room = this.state.room;
        if (room) {
            this._updateAutoComplete(room);
            this.tabComplete.loadEntries(room);
        } else if (!this.state.joining && this.state.roomId) {
            if (this.props.autoJoin) {
                this.onJoinButtonClicked();
            } else {
                console.log("Attempting to peek into room %s", this.state.roomId);
                this.setState({
                    peekLoading: true,
                });
                MatrixClientPeg.get().peekInRoom(this.state.roomId).then((room) => {
                    this.setState({
                        room: room,
                        peekLoading: false,
                    });
                    this._onRoomLoaded(room);
                }, (err) => {
                    // This won't necessarily be a MatrixError, but we duck-type
                    // here and say if it's got an 'errcode' key with the right value,
                    // it means we can't peek.
                    if (err.errcode == "M_GUEST_ACCESS_FORBIDDEN") {
                        // This is fine: the room just isn't peekable (we assume).
                        this.setState({
                            peekLoading: false,
                        });
                    } else {
                        throw err;
                    }
                }).done();
            }
        } else {
            MatrixClientPeg.get().stopPeeking();
            this.setState({
                unsentMessageError: this._getUnsentMessageError(room),
            });
            this._onRoomLoaded(room);
        }
    },

    componentDidMount: function() {
        var call = this._getCallForRoom();
        var callState = call ? call.call_state : "ended";
        this.setState({
            callState: callState
        });

        this._updateConfCallNotification();

        window.addEventListener('beforeunload', this.onPageUnload);
        window.addEventListener('resize', this.onResize);
        this.onResize();

        document.addEventListener("keydown", this.onKeyDown);

        // XXX: EVIL HACK to autofocus inviting on empty rooms.
        // We use the setTimeout to avoid racing with focus_composer.
        if (this.state.room &&
            this.state.room.getJoinedMembers().length == 1 &&
            this.state.room.getLiveTimeline() &&
            this.state.room.getLiveTimeline().getEvents() &&
            this.state.room.getLiveTimeline().getEvents().length <= 6)
        {
            var inviteBox = document.getElementById("mx_SearchableEntityList_query");
            setTimeout(function() {
                if (inviteBox) {
                    inviteBox.focus();
                }
            }, 50);
        }
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        return (!ObjectUtils.shallowEqual(this.props, nextProps) ||
                !ObjectUtils.shallowEqual(this.state, nextState));
    },

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

    componentWillUnmount: function() {
        // set a boolean to say we've been unmounted, which any pending
        // promises can use to throw away their results.
        //
        // (We could use isMounted, but facebook have deprecated that.)
        this.unmounted = true;

        // update the scroll map before we get unmounted
        this._updateScrollMap(this.state.roomId);

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
            MatrixClientPeg.get().removeListener("RoomMember.membership", this.onRoomMemberMembership);
            MatrixClientPeg.get().removeListener("accountData", this.onAccountData);
        }

        window.removeEventListener('beforeunload', this.onPageUnload);
        window.removeEventListener('resize', this.onResize);

        document.removeEventListener("keydown", this.onKeyDown);

        // Remove RoomStore listener
        if (this._roomStoreToken) {
            this._roomStoreToken.remove();
        }

        // cancel any pending calls to the rate_limited_funcs
        this._updateRoomMembers.cancelPendingCall();

        // no need to do this as Dir & Settings are now overlays. It just burnt CPU.
        // console.log("Tinter.tint from RoomView.unmount");
        // Tinter.tint(); // reset colourscheme
    },

    onPageUnload(event) {
        if (ContentMessages.getCurrentUploads().length > 0) {
            return event.returnValue =
                _t("You seem to be uploading files, are you sure you want to quit?");
        } else if (this._getCallForRoom() && this.state.callState !== 'ended') {
            return event.returnValue =
                _t("You seem to be in a call, are you sure you want to quit?");
        }
    },


    onKeyDown: function(ev) {
        let handled = false;
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        let ctrlCmdOnly;
        if (isMac) {
            ctrlCmdOnly = ev.metaKey && !ev.altKey && !ev.ctrlKey && !ev.shiftKey;
        } else {
            ctrlCmdOnly = ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey;
        }

        switch (ev.keyCode) {
            case KeyCode.KEY_D:
                if (ctrlCmdOnly) {
                    this.onMuteAudioClick();
                    handled = true;
                }
                break;

            case KeyCode.KEY_E:
                if (ctrlCmdOnly) {
                    this.onMuteVideoClick();
                    handled = true;
                }
                break;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'message_send_failed':
            case 'message_sent':
            case 'message_send_cancelled':
                this.setState({
                    unsentMessageError: this._getUnsentMessageError(this.state.room),
                });
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

                var call = this._getCallForRoom();
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
            case 'forward_event':
                this.setState({
                    forwardingEvent: payload.content,
                });
                break;
        }
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline, removed, data) {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (!room) return;
        if (!this.state.room || room.roomId != this.state.room.roomId) return;

        // ignore events from filtered timelines
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) return;

        if (ev.getType() === "org.matrix.room.preview_urls") {
            this._updatePreviewUrlVisibility(room);
        }

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

        // update the tab complete list as it depends on who most recently spoke,
        // and that has probably just changed
        if (ev.sender) {
            this.tabComplete.onMemberSpoke(ev.sender);
            // nb. we don't need to update the new autocomplete here since
            // its results are currently ordered purely by search score.
        }
    },

    onRoomName: function(room) {
        if (this.state.room && room.roomId == this.state.room.roomId) {
            this.forceUpdate();
        }
    },

    canResetTimeline: function() {
        if (!this.refs.messagePanel) {
            return true;
        }
        return this.refs.messagePanel.canResetTimeline();
    },

    // called when state.room is first initialised (either at initial load,
    // after a successful peek, or after we join the room).
    _onRoomLoaded: function(room) {
        this._warnAboutEncryption(room);
        this._calculatePeekRules(room);
        this._updatePreviewUrlVisibility(room);
    },

    _warnAboutEncryption: function(room) {
        if (!MatrixClientPeg.get().isRoomEncrypted(room.roomId)) {
            return;
        }
        let userHasUsedEncryption = false;
        if (localStorage) {
            userHasUsedEncryption = localStorage.getItem('mx_user_has_used_encryption');
        }
        if (!userHasUsedEncryption) {
            const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
            Modal.createDialog(QuestionDialog, {
                title: _t("Warning!"),
                hasCancelButton: false,
                description: (
                    <div>
                        <p>{ _t("End-to-end encryption is in beta and may not be reliable") }.</p>
                        <p>{ _t("You should not yet trust it to secure data") }.</p>
                        <p>{ _t("Devices will not yet be able to decrypt history from before they joined the room") }.</p>
                        <p>{ _t("Encrypted messages will not be visible on clients that do not yet implement encryption") }.</p>
                    </div>
                ),
            });
        }
        if (localStorage) {
            localStorage.setItem('mx_user_has_used_encryption', true);
        }
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

    _updatePreviewUrlVisibility: function(room) {
        // console.log("_updatePreviewUrlVisibility");

        // check our per-room overrides
        var roomPreviewUrls = room.getAccountData("org.matrix.room.preview_urls");
        if (roomPreviewUrls && roomPreviewUrls.getContent().disable !== undefined) {
            this.setState({
                showUrlPreview: !roomPreviewUrls.getContent().disable
            });
            return;
        }

        // check our global disable override
        var userRoomPreviewUrls = MatrixClientPeg.get().getAccountData("org.matrix.preview_urls");
        if (userRoomPreviewUrls && userRoomPreviewUrls.getContent().disable) {
            this.setState({
                showUrlPreview: false
            });
            return;
        }

        // check the room state event
        var roomStatePreviewUrls = room.currentState.getStateEvents('org.matrix.room.preview_urls', '');
        if (roomStatePreviewUrls && roomStatePreviewUrls.getContent().disable) {
            this.setState({
                showUrlPreview: false
            });
            return;
        }

        // otherwise, we assume they're on.
        this.setState({
            showUrlPreview: true
        });
    },

    _updateScrollMap(roomId) {
        // No point updating scroll state if the room ID hasn't been resolved yet
        if (!roomId) {
            return;
        }
        dis.dispatch({
            action: 'update_scroll_state',
            room_id: roomId,
            scroll_state: this._getScrollState(),
        });
    },

    onRoom: function(room) {
        if (!room || room.roomId !== this.state.roomId) {
            return;
        }
        this.setState({
            room: room,
            waitingForRoom: false,
        }, () => {
            this._onRoomLoaded(room);
        });
    },

    updateTint: function() {
        var room = this.state.room;
        if (!room) return;

        var color_scheme_event = room.getAccountData("org.matrix.room.color_scheme");
        var color_scheme = {};
        if (color_scheme_event) {
            color_scheme = color_scheme_event.getContent();
            // XXX: we should validate the event
        }
        console.log("Tinter.tint from updateTint");
        Tinter.tint(color_scheme.primary_color, color_scheme.secondary_color);
    },

    onAccountData: function(event) {
        if (event.getType() === "org.matrix.preview_urls" && this.state.room) {
            this._updatePreviewUrlVisibility(this.state.room);
        }
    },

    onRoomAccountData: function(event, room) {
        if (room.roomId == this.state.roomId) {
            if (event.getType() === "org.matrix.room.color_scheme") {
                var color_scheme = event.getContent();
                // XXX: we should validate the event
                console.log("Tinter.tint from onRoomAccountData");
                Tinter.tint(color_scheme.primary_color, color_scheme.secondary_color);
            }
            else if (event.getType() === "org.matrix.room.preview_urls") {
                this._updatePreviewUrlVisibility(room);
            }
        }
    },

    onRoomStateMember: function(ev, state, member) {
        // ignore if we don't have a room yet
        if (!this.state.room) {
            return;
        }

        // ignore members in other rooms
        if (member.roomId !== this.state.room.roomId) {
            return;
        }

        this._updateRoomMembers();
    },

    onRoomMemberMembership: function(ev, member, oldMembership) {
        if (member.userId == MatrixClientPeg.get().credentials.userId) {

            if (member.membership === 'join') {
                this.setState({
                    waitingForRoom: false,
                });
            }
        }
    },

    // rate limited because a power level change will emit an event for every
    // member in the room.
    _updateRoomMembers: new rate_limited_func(function() {
        // a member state changed in this room
        // refresh the conf call notification state
        this._updateConfCallNotification();

        // refresh the tab complete list
        this.tabComplete.loadEntries(this.state.room);
        this._updateAutoComplete(this.state.room);

        // if we are now a member of the room, where we were not before, that
        // means we have finished joining a room we were previously peeking
        // into.
        var me = MatrixClientPeg.get().credentials.userId;
        if (this.state.joining && this.state.room.hasMembershipState(me, "join")) {
            // Having just joined a room, check to see if it looks like a DM room, and if so,
            // mark it as one. This is to work around the fact that some clients don't support
            // is_direct. We should remove this once they do.
            const me = this.state.room.getMember(MatrixClientPeg.get().credentials.userId);
            if (Rooms.looksLikeDirectMessageRoom(this.state.room, me)) {
                // XXX: There's not a whole lot we can really do if this fails: at best
                // perhaps we could try a couple more times, but since it's a temporary
                // compatability workaround, let's not bother.
                Rooms.setDMRoom(this.state.room.roomId, me.events.member.getSender()).done();
            }
        }
    }, 500),

    _getUnsentMessageError: function(room) {
        const unsentMessages = this._getUnsentMessages(room);
        if (!unsentMessages.length) return "";
        for (const event of unsentMessages) {
            if (!event.error || event.error.name !== "UnknownDeviceError") {
                return _t("Some of your messages have not been sent.");
            }
        }
        return _t("Message not sent due to unknown devices being present");
    },

    _getUnsentMessages: function(room) {
        if (!room) { return []; }
        return room.getPendingEvents().filter(function(ev) {
            return ev.status === Matrix.EventStatus.NOT_SENT;
        });
    },

    _updateConfCallNotification: function() {
        var room = this.state.room;
        if (!room || !this.props.ConferenceHandler) {
            return;
        }
        var confMember = room.getMember(
            this.props.ConferenceHandler.getConferenceUserIdForRoom(room.roomId)
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

    onSearchResultsResize: function() {
        dis.dispatch({ action: 'timeline_resize' }, true);
    },

    onSearchResultsFillRequest: function(backwards) {
        if (!backwards) {
            return q(false);
        }

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
        Resend.resendUnsentEvents(this.state.room);
    },

    onCancelAllClick: function() {
        Resend.cancelUnsentEvents(this.state.room);
    },

    onJoinButtonClicked: function(ev) {
        const cli = MatrixClientPeg.get();

        // If the user is a ROU, allow them to transition to a PWLU
        if (cli && cli.isGuest()) {
            // Join this room once the user has registered and logged in
            const signUrl = this.props.thirdPartyInvite ?
                this.props.thirdPartyInvite.inviteSignUrl : undefined;
            dis.dispatch({
                action: 'do_after_sync_prepared',
                deferred_action: {
                    action: 'join_room',
                    opts: { inviteSignUrl: signUrl },
                },
            });

            // Don't peek whilst registering otherwise getPendingEventList complains
            // Do this by indicating our intention to join
            dis.dispatch({
                action: 'will_join',
            });

            const SetMxIdDialog = sdk.getComponent('views.dialogs.SetMxIdDialog');
            const close = Modal.createDialog(SetMxIdDialog, {
                homeserverUrl: cli.getHomeserverUrl(),
                onFinished: (submitted, credentials) => {
                    if (submitted) {
                        this.props.onRegistered(credentials);
                    } else {
                        dis.dispatch({
                            action: 'cancel_after_sync_prepared',
                        });
                        dis.dispatch({
                            action: 'cancel_join',
                        });
                    }
                },
                onDifferentServerClicked: (ev) => {
                    dis.dispatch({action: 'start_registration'});
                    close();
                },
                onLoginClick: (ev) => {
                    dis.dispatch({action: 'start_login'});
                    close();
                },
            }).close;
            return;
        }

        q().then(() => {
            const signUrl = this.props.thirdPartyInvite ?
                this.props.thirdPartyInvite.inviteSignUrl : undefined;
            dis.dispatch({
                action: 'join_room',
                opts: { inviteSignUrl: signUrl },
            });

            // if this is an invite and has the 'direct' hint set, mark it as a DM room now.
            if (this.state.room) {
                const me = this.state.room.getMember(MatrixClientPeg.get().credentials.userId);
                if (me && me.membership == 'invite') {
                    if (me.events.member.getContent().is_direct) {
                        // The 'direct' hint is there, so declare that this is a DM room for
                        // whoever invited us.
                        return Rooms.setDMRoom(this.state.room.roomId, me.events.member.getSender());
                    }
                }
            }
            return q();
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
        if (MatrixClientPeg.get().isGuest()) {
            dis.dispatch({action: 'view_set_mxid'});
            return;
        }

        ContentMessages.sendContentToRoom(
            file, this.state.room.roomId, MatrixClientPeg.get()
        ).done(undefined, (error) => {
            if (error.name === "UnknownDeviceError") {
                dis.dispatch({
                    action: 'unknown_device_error',
                    err: error,
                    room: this.state.room,
                });
                return;
            }
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Failed to upload file " + file + " " + error);
            Modal.createDialog(ErrorDialog, {
                title: _t('Failed to upload file'),
                description: ((error && error.message) ? error.message : _t("Server may be unavailable, overloaded, or the file too big")),
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
                    this.state.room.roomId
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
                return b.length - a.length; });

            self.setState({
                searchHighlights: highlights,
                searchResults: results,
            });
        }, function(error) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Search failed: " + error);
            Modal.createDialog(ErrorDialog, {
                title: _t("Search failed"),
                description: ((error && error.message) ? error.message : _t("Server may be unavailable, overloaded, or search timed out :(")),
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
        var Spinner = sdk.getComponent("elements.Spinner");

        var cli = MatrixClientPeg.get();

        // XXX: todo: merge overlapping results somehow?
        // XXX: why doesn't searching on name work?

        if (this.state.searchResults.results === undefined) {
            // awaiting results
            return [];
        }

        var ret = [];

        if (this.state.searchInProgress) {
            ret.push(<li key="search-spinner">
                         <Spinner />
                     </li>);
        }

        if (!this.state.searchResults.next_batch) {
            if (this.state.searchResults.results.length == 0) {
                ret.push(<li key="search-top-marker">
                         <h2 className="mx_RoomView_topMarker">{ _t("No results") }</h2>
                         </li>
                        );
            } else {
                ret.push(<li key="search-top-marker">
                         <h2 className="mx_RoomView_topMarker">{ _t("No more results") }</h2>
                         </li>
                        );
            }
        }

        // once dynamic content in the search results load, make the scrollPanel check
        // the scroll offsets.
        var onWidgetLoad = () => {
            var scrollPanel = this.refs.searchResultsPanel;
            if (scrollPanel) {
                scrollPanel.checkScroll();
            }
        };

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
                    var roomName = room ? room.name : _t("Unknown room %(roomId)s", { roomId: roomId });

                    ret.push(<li key={mxEv.getId() + "-room"}>
                                 <h1>{ _t("Room") }: { roomName }</h1>
                             </li>);
                    lastRoomId = roomId;
                }
            }

            var resultLink = "#/room/"+roomId+"/"+mxEv.getId();

            ret.push(<SearchResultTile key={mxEv.getId()}
                     searchResult={result}
                     searchHighlights={this.state.searchHighlights}
                     resultLink={resultLink}
                     onWidgetLoad={onWidgetLoad}/>);
        }
        return ret;
    },

    onSettingsClick: function() {
        this.showSettings(true);
    },

    onSettingsSaveClick: function() {
        if (!this.refs.room_settings) return;

        this.setState({
            uploadingRoomSettings: true,
        });

        var newName = this.refs.header.getEditedName();
        if (newName !== undefined) {
            this.refs.room_settings.setName(newName);
        }
        var newTopic = this.refs.header.getEditedTopic();
        if (newTopic !== undefined) {
            this.refs.room_settings.setTopic(newTopic);
        }

        this.refs.room_settings.save().then((results) => {
            var fails = results.filter(function(result) { return result.state !== "fulfilled"; });
            console.log("Settings saved with %s errors", fails.length);
            if (fails.length) {
                fails.forEach(function(result) {
                    console.error(result.reason);
                });
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: _t("Failed to save settings"),
                    description: fails.map(function(result) { return result.reason; }).join("\n"),
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
        console.log("updateTint from onCancelClick");
        this.updateTint();
        this.setState({
            editingRoomSettings: false,
            forwardingEvent: null,
        });
        dis.dispatch({action: 'focus_composer'});
    },

    onLeaveClick: function() {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.state.room.roomId,
        });
    },

    onForgetClick: function() {
        MatrixClientPeg.get().forget(this.state.room.roomId).done(function() {
            dis.dispatch({ action: 'view_next_room' });
        }, function(err) {
            var errCode = err.errcode || _t("unknown error code");
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: _t("Error"),
                description: _t("Failed to forget room %(errCode)s", { errCode: errCode }),
            });
        });
    },

    onRejectButtonClicked: function(ev) {
        var self = this;
        this.setState({
            rejecting: true
        });
        MatrixClientPeg.get().leave(this.state.roomId).done(function() {
            dis.dispatch({ action: 'view_next_room' });
            self.setState({
                rejecting: false
            });
        }, function(error) {
            console.error("Failed to reject invite: %s", error);

            var msg = error.message ? error.message : JSON.stringify(error);
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: _t("Failed to reject invite"),
                description: msg,
            });

            self.setState({
                rejecting: false,
                rejectError: error
            });
        });
    },

    onRejectThreepidInviteButtonClicked: function(ev) {
        // We can reject 3pid invites in the same way that we accept them,
        // using /leave rather than /join. In the short term though, we
        // just ignore them.
        // https://github.com/vector-im/vector-web/issues/1134
        dis.dispatch({
            action: 'view_room_directory',
        });
    },

    onSearchClick: function() {
        this.setState({ searching: true });
    },

    onCancelSearchClick: function() {
        this.setState({
            searching: false,
            searchResults: null,
        });
    },

    // jump down to the bottom of this room, where new events are arriving
    jumpToLiveTimeline: function() {
        this.refs.messagePanel.jumpToLiveTimeline();
        dis.dispatch({action: 'focus_composer'});
    },

    // jump up to wherever our read marker is
    jumpToReadMarker: function() {
        this.refs.messagePanel.jumpToReadMarker();
    },

    // update the read marker to match the read-receipt
    forgetReadMarker: function(ev) {
        ev.stopPropagation();
        this.refs.messagePanel.forgetReadMarker();
    },

    // decide whether or not the top 'unread messages' bar should be shown
    _updateTopUnreadMessagesBar: function() {
        if (!this.refs.messagePanel) {
            return;
        }

        const showBar = this.refs.messagePanel.canJumpToReadMarker();
        if (this.state.showTopUnreadMessagesBar != showBar) {
            this.setState({showTopUnreadMessagesBar: showBar},
                          this.onChildResize);
        }
    },

    // get the current scroll position of the room, so that it can be
    // restored when we switch back to it.
    //
    _getScrollState: function() {
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

        this.setState({auxPanelMaxHeight: auxPanelMaxHeight});

        // changing the maxHeight on the auxpanel will trigger a callback go
        // onChildResize, so no need to worry about that here.
    },

    onFullscreenClick: function() {
        dis.dispatch({
            action: 'video_fullscreen',
            fullscreen: true
        }, true);
    },

    onMuteAudioClick: function() {
        var call = this._getCallForRoom();
        if (!call) {
            return;
        }
        var newState = !call.isMicrophoneMuted();
        call.setMicrophoneMuted(newState);
        this.forceUpdate(); // TODO: just update the voip buttons
    },

    onMuteVideoClick: function() {
        var call = this._getCallForRoom();
        if (!call) {
            return;
        }
        var newState = !call.isLocalVideoMuted();
        call.setLocalVideoMuted(newState);
        this.forceUpdate(); // TODO: just update the voip buttons
    },

    onChildResize: function() {
        // no longer anything to do here
    },

    onStatusBarVisible: function() {
        if (this.unmounted) return;
        this.setState({
            statusBarVisible: true,
        });
    },

    onStatusBarHidden: function() {
        if (this.unmounted) return;
        this.setState({
            statusBarVisible: false,
        });
    },

    showSettings: function(show) {
        // XXX: this is a bit naughty; we should be doing this via props
        if (show) {
            this.setState({editingRoomSettings: true});
        }
    },

    /**
     * called by the parent component when PageUp/Down/etc is pressed.
     *
     * We pass it down to the scroll panel.
     */
    handleScrollKey: function(ev) {
        var panel;
        if(this.refs.searchResultsPanel) {
            panel = this.refs.searchResultsPanel;
        } else if(this.refs.messagePanel) {
            panel = this.refs.messagePanel;
        }

        if(panel) {
            panel.handleScrollKey(ev);
        }
    },

    /**
     * get any current call for this room
     */
    _getCallForRoom: function() {
        if (!this.state.room) {
            return null;
        }
        return CallHandler.getCallForRoom(this.state.room.roomId);
    },

    // this has to be a proper method rather than an unnamed function,
    // otherwise react calls it with null on each update.
    _gatherTimelinePanelRef: function(r) {
        this.refs.messagePanel = r;
        if(r) {
            console.log("updateTint from RoomView._gatherTimelinePanelRef");
            this.updateTint();
        }
    },

    _updateAutoComplete: function(room) {
        const myUserId = MatrixClientPeg.get().credentials.userId;
        const members = room.getJoinedMembers().filter(function(member) {
            if (member.userId !== myUserId) return true;
        });
        UserProvider.getInstance().setUserList(members);
    },

    render: function() {
        const RoomHeader = sdk.getComponent('rooms.RoomHeader');
        const MessageComposer = sdk.getComponent('rooms.MessageComposer');
        const ForwardMessage = sdk.getComponent("rooms.ForwardMessage");
        const RoomSettings = sdk.getComponent("rooms.RoomSettings");
        const AuxPanel = sdk.getComponent("rooms.AuxPanel");
        const SearchBar = sdk.getComponent("rooms.SearchBar");
        const ScrollPanel = sdk.getComponent("structures.ScrollPanel");
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        const RoomPreviewBar = sdk.getComponent("rooms.RoomPreviewBar");
        const Loader = sdk.getComponent("elements.Spinner");
        const TimelinePanel = sdk.getComponent("structures.TimelinePanel");

        if (!this.state.room) {
            if (this.state.roomLoading || this.state.peekLoading) {
                return (
                    <div className="mx_RoomView">
                        <Loader />
                    </div>
                );
            } else {
                var inviterName = undefined;
                if (this.props.oobData) {
                    inviterName = this.props.oobData.inviterName;
                }
                var invitedEmail = undefined;
                if (this.props.thirdPartyInvite) {
                    invitedEmail = this.props.thirdPartyInvite.invitedEmail;
                }

                // We have no room object for this room, only the ID.
                // We've got to this room by following a link, possibly a third party invite.
                var room_alias = this.state.room_alias;
                return (
                    <div className="mx_RoomView">
                        <RoomHeader ref="header"
                            room={this.state.room}
                            oobData={this.props.oobData}
                            collapsedRhs={ this.props.collapsedRhs }
                        />
                        <div className="mx_RoomView_auxPanel">
                            <RoomPreviewBar onJoinClick={ this.onJoinButtonClicked }
                                            onForgetClick={ this.onForgetClick }
                                            onRejectClick={ this.onRejectThreepidInviteButtonClicked }
                                            canPreview={ false } error={ this.state.roomLoadError }
                                            roomAlias={room_alias}
                                            spinner={this.state.joining || this.state.waitingForRoom}
                                            inviterName={inviterName}
                                            invitedEmail={invitedEmail}
                                            room={this.state.room}
                            />
                        </div>
                        <div className="mx_RoomView_messagePanel"></div>
                    </div>
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

                // We have a regular invite for this room.
                return (
                    <div className="mx_RoomView">
                        <RoomHeader
                            ref="header"
                            room={this.state.room}
                            collapsedRhs={ this.props.collapsedRhs }
                        />
                        <div className="mx_RoomView_auxPanel">
                            <RoomPreviewBar onJoinClick={ this.onJoinButtonClicked }
                                            onForgetClick={ this.onForgetClick }
                                            onRejectClick={ this.onRejectButtonClicked }
                                            inviterName={ inviterName }
                                            canPreview={ false }
                                            spinner={this.state.joining}
                                            room={this.state.room}
                            />
                        </div>
                        <div className="mx_RoomView_messagePanel"></div>
                    </div>
                );
            }
        }

        // We have successfully loaded this room, and are not previewing.
        // Display the "normal" room view.

        var call = this._getCallForRoom();
        var inCall = false;
        if (call && (this.state.callState !== 'ended' && this.state.callState !== 'ringing')) {
            inCall = true;
        }

        var scrollheader_classes = classNames({
            mx_RoomView_scrollheader: true,
        });

        var statusBar;
        let isStatusAreaExpanded = true;

        if (ContentMessages.getCurrentUploads().length > 0) {
            var UploadBar = sdk.getComponent('structures.UploadBar');
            statusBar = <UploadBar room={this.state.room} />;
        } else if (!this.state.searchResults) {
            var RoomStatusBar = sdk.getComponent('structures.RoomStatusBar');
            isStatusAreaExpanded = this.state.statusBarVisible;
            statusBar = <RoomStatusBar
                room={this.state.room}
                tabComplete={this.tabComplete}
                numUnreadMessages={this.state.numUnreadMessages}
                unsentMessageError={this.state.unsentMessageError}
                atEndOfLiveTimeline={this.state.atEndOfLiveTimeline}
                hasActiveCall={inCall}
                onResendAllClick={this.onResendAllClick}
                onCancelAllClick={this.onCancelAllClick}
                onScrollToBottomClick={this.jumpToLiveTimeline}
                onResize={this.onChildResize}
                onVisible={this.onStatusBarVisible}
                onHidden={this.onStatusBarHidden}
                whoIsTypingLimit={3}
            />;
        }

        let aux = null;
        let hideCancel = false;
        if (this.state.editingRoomSettings) {
            aux = <RoomSettings ref="room_settings" onSaveClick={this.onSettingsSaveClick} onCancelClick={this.onCancelClick} room={this.state.room} />;
        } else if (this.state.uploadingRoomSettings) {
            aux = <Loader/>;
        } else if (this.state.forwardingEvent !== null) {
            aux = <ForwardMessage onCancelClick={this.onCancelClick} currentRoomId={this.state.room.roomId} mxEvent={this.state.forwardingEvent} />;
        } else if (this.state.searching) {
            hideCancel = true; // has own cancel
            aux = <SearchBar ref="search_bar" searchInProgress={this.state.searchInProgress } onCancelClick={this.onCancelSearchClick} onSearch={this.onSearch}/>;
        } else if (!myMember || myMember.membership !== "join") {
            // We do have a room object for this room, but we're not currently in it.
            // We may have a 3rd party invite to it.
            var inviterName = undefined;
            if (this.props.oobData) {
                inviterName = this.props.oobData.inviterName;
            }
            var invitedEmail = undefined;
            if (this.props.thirdPartyInvite) {
                invitedEmail = this.props.thirdPartyInvite.invitedEmail;
            }
            hideCancel = true;
            aux = (
                <RoomPreviewBar onJoinClick={this.onJoinButtonClicked}
                                onForgetClick={ this.onForgetClick }
                                onRejectClick={this.onRejectThreepidInviteButtonClicked}
                                spinner={this.state.joining || this.state.waitingForRoom}
                                inviterName={inviterName}
                                invitedEmail={invitedEmail}
                                canPreview={this.state.canPeek}
                                room={this.state.room}
                />
            );
        }

        var auxPanel = (
            <AuxPanel ref="auxPanel" room={this.state.room}
              conferenceHandler={this.props.ConferenceHandler}
              draggingFile={this.state.draggingFile}
              displayConfCallNotification={this.state.displayConfCallNotification}
              maxHeight={this.state.auxPanelMaxHeight}
              onResize={this.onChildResize} >
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
                    callState={this.state.callState} tabComplete={this.tabComplete} opacity={ this.props.opacity }/>;
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
                    <div className="mx_RoomView_voipButton" onClick={this.onFullscreenClick} title={ _t("Fill screen") }>
                        <TintableSvg src="img/fullscreen.svg" width="29" height="22" style={{ marginTop: 1, marginRight: 4 }}/>
                    </div>
                );

                videoMuteButton =
                    <div className="mx_RoomView_voipButton" onClick={this.onMuteVideoClick}>
                        <TintableSvg src={call.isLocalVideoMuted() ? "img/video-unmute.svg" : "img/video-mute.svg"}
                             alt={call.isLocalVideoMuted() ? _t("Click to unmute video") : _t("Click to mute video")}
                             width="31" height="27"/>
                    </div>;
            }
            voiceMuteButton =
                <div className="mx_RoomView_voipButton" onClick={this.onMuteAudioClick}>
                    <TintableSvg src={call.isMicrophoneMuted() ? "img/voice-unmute.svg" : "img/voice-mute.svg"}
                         alt={call.isMicrophoneMuted() ? _t("Click to unmute audio") : _t("Click to mute audio")}
                         width="21" height="26"/>
                </div>;

            // wrap the existing status bar into a 'callStatusBar' which adds more knobs.
            statusBar =
                <div className="mx_RoomView_callStatusBar">
                    { voiceMuteButton }
                    { videoMuteButton }
                    { zoomButton }
                    { statusBar }
                    <TintableSvg className="mx_RoomView_voipChevron" src="img/voip-chevron.svg" width="22" height="17"/>
                </div>;
        }

        // if we have search results, we keep the messagepanel (so that it preserves its
        // scroll state), but hide it.
        var searchResultsPanel;
        var hideMessagePanel = false;

        if (this.state.searchResults) {
            searchResultsPanel = (
                <ScrollPanel ref="searchResultsPanel"
                    className="mx_RoomView_messagePanel mx_RoomView_searchResultsPanel"
                    onFillRequest={ this.onSearchResultsFillRequest }
                    onResize={ this.onSearchResultsResize }
                    style={{ opacity: this.props.opacity }}
                >
                    <li className={scrollheader_classes}></li>
                    {this.getSearchResultTiles()}
                </ScrollPanel>
            );
            hideMessagePanel = true;
        }

        const shouldHighlight = this.state.isInitialEventHighlighted;
        let highlightedEventId = null;
        if (this.state.forwardingEvent) {
            highlightedEventId = this.state.forwardingEvent.getId();
        } else if (shouldHighlight) {
            highlightedEventId = this.state.initialEventId;
        }

        // console.log("ShowUrlPreview for %s is %s", this.state.room.roomId, this.state.showUrlPreview);
        var messagePanel = (
            <TimelinePanel ref={this._gatherTimelinePanelRef}
                timelineSet={this.state.room.getUnfilteredTimelineSet()}
                manageReadReceipts={!UserSettingsStore.getSyncedSetting('hideReadReceipts', false)}
                manageReadMarkers={true}
                hidden={hideMessagePanel}
                highlightedEventId={highlightedEventId}
                eventId={this.state.initialEventId}
                eventPixelOffset={this.state.initialEventPixelOffset}
                onScroll={ this.onMessageListScroll }
                onReadMarkerUpdated={ this._updateTopUnreadMessagesBar }
                showUrlPreview = { this.state.showUrlPreview }
                opacity={ this.props.opacity }
                className="mx_RoomView_messagePanel"
            />);

        var topUnreadMessagesBar = null;
        if (this.state.showTopUnreadMessagesBar) {
            var TopUnreadMessagesBar = sdk.getComponent('rooms.TopUnreadMessagesBar');
            topUnreadMessagesBar = (
                <div className="mx_RoomView_topUnreadMessagesBar mx_fadable" style={{ opacity: this.props.opacity }}>
                    <TopUnreadMessagesBar
                       onScrollUpClick={this.jumpToReadMarker}
                       onCloseClick={this.forgetReadMarker}
                    />
                </div>
            );
        }
        let statusBarAreaClass = "mx_RoomView_statusArea mx_fadable";
        if (isStatusAreaExpanded) {
            statusBarAreaClass += " mx_RoomView_statusArea_expanded";
        }

        return (
            <div className={ "mx_RoomView" + (inCall ? " mx_RoomView_inCall" : "") } ref="roomView">
                <RoomHeader ref="header" room={this.state.room} searchInfo={searchInfo}
                    oobData={this.props.oobData}
                    editing={this.state.editingRoomSettings}
                    saving={this.state.uploadingRoomSettings}
                    inRoom={myMember && myMember.membership === 'join'}
                    collapsedRhs={ this.props.collapsedRhs }
                    onSearchClick={this.onSearchClick}
                    onSettingsClick={this.onSettingsClick}
                    onSaveClick={this.onSettingsSaveClick}
                    onCancelClick={(aux && !hideCancel) ? this.onCancelClick : null}
                    onForgetClick={(myMember && myMember.membership === "leave") ? this.onForgetClick : null}
                    onLeaveClick={(myMember && myMember.membership === "join") ? this.onLeaveClick : null}
                />
                { auxPanel }
                { topUnreadMessagesBar }
                { messagePanel }
                { searchResultsPanel }
                <div className={statusBarAreaClass} style={{opacity: this.props.opacity}}>
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
