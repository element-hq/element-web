/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 New Vector Ltd
Copyright 2019-2020 The Matrix.org Foundation C.I.C.

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

import SettingsStore from "../../settings/SettingsStore";
import React, {createRef} from 'react';
import createReactClass from 'create-react-class';
import ReactDOM from "react-dom";
import PropTypes from 'prop-types';
import {EventTimeline} from "matrix-js-sdk";
import * as Matrix from "matrix-js-sdk";
import { _t } from '../../languageHandler';
import {MatrixClientPeg} from "../../MatrixClientPeg";
import * as ObjectUtils from "../../ObjectUtils";
import UserActivity from "../../UserActivity";
import Modal from "../../Modal";
import dis from "../../dispatcher/dispatcher";
import * as sdk from "../../index";
import { Key } from '../../Keyboard';
import Timer from '../../utils/Timer';
import shouldHideEvent from '../../shouldHideEvent';
import EditorStateTransfer from '../../utils/EditorStateTransfer';
import {haveTileForEvent} from "../views/rooms/EventTile";

const PAGINATE_SIZE = 20;
const INITIAL_SIZE = 20;
const READ_RECEIPT_INTERVAL_MS = 500;

const DEBUG = false;

let debuglog = function() {};
if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    debuglog = console.log.bind(console);
}

/*
 * Component which shows the event timeline in a room view.
 *
 * Also responsible for handling and sending read receipts.
 */
const TimelinePanel = createReactClass({
    displayName: 'TimelinePanel',

    propTypes: {
        // The js-sdk EventTimelineSet object for the timeline sequence we are
        // representing.  This may or may not have a room, depending on what it's
        // a timeline representing.  If it has a room, we maintain RRs etc for
        // that room.
        timelineSet: PropTypes.object.isRequired,

        showReadReceipts: PropTypes.bool,
        // Enable managing RRs and RMs. These require the timelineSet to have a room.
        manageReadReceipts: PropTypes.bool,
        manageReadMarkers: PropTypes.bool,

        // true to give the component a 'display: none' style.
        hidden: PropTypes.bool,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        // typically this will be either 'eventId' or undefined.
        highlightedEventId: PropTypes.string,

        // id of an event to jump to. If not given, will go to the end of the
        // live timeline.
        eventId: PropTypes.string,

        // where to position the event given by eventId, in pixels from the
        // bottom of the viewport. If not given, will try to put the event
        // half way down the viewport.
        eventPixelOffset: PropTypes.number,

        // Should we show URL Previews
        showUrlPreview: PropTypes.bool,

        // callback which is called when the panel is scrolled.
        onScroll: PropTypes.func,

        // callback which is called when the read-up-to mark is updated.
        onReadMarkerUpdated: PropTypes.func,

        // callback which is called when we wish to paginate the timeline
        // window.
        onPaginationRequest: PropTypes.func,

        // maximum number of events to show in a timeline
        timelineCap: PropTypes.number,

        // classname to use for the messagepanel
        className: PropTypes.string,

        // shape property to be passed to EventTiles
        tileShape: PropTypes.string,

        // placeholder text to use if the timeline is empty
        empty: PropTypes.string,

        // whether to show reactions for an event
        showReactions: PropTypes.bool,

        // whether to use the irc layout
        useIRCLayout: PropTypes.bool,
    },

    statics: {
        // a map from room id to read marker event timestamp
        roomReadMarkerTsMap: {},
    },

    getDefaultProps: function() {
        return {
            // By default, disable the timelineCap in favour of unpaginating based on
            // event tile heights. (See _unpaginateEvents)
            timelineCap: Number.MAX_VALUE,
            className: 'mx_RoomView_messagePanel',
        };
    },

    getInitialState: function() {
        // XXX: we could track RM per TimelineSet rather than per Room.
        // but for now we just do it per room for simplicity.
        let initialReadMarker = null;
        if (this.props.manageReadMarkers) {
            const readmarker = this.props.timelineSet.room.getAccountData('m.fully_read');
            if (readmarker) {
                initialReadMarker = readmarker.getContent().event_id;
            } else {
                initialReadMarker = this._getCurrentReadReceipt();
            }
        }

        return {
            events: [],
            liveEvents: [],
            timelineLoading: true, // track whether our room timeline is loading

            // the index of the first event that is to be shown
            firstVisibleEventIndex: 0,

            // canBackPaginate == false may mean:
            //
            // * we haven't (successfully) loaded the timeline yet, or:
            //
            // * we have got to the point where the room was created, or:
            //
            // * the server indicated that there were no more visible events
            //  (normally implying we got to the start of the room), or:
            //
            // * we gave up asking the server for more events
            canBackPaginate: false,

            // canForwardPaginate == false may mean:
            //
            // * we haven't (successfully) loaded the timeline yet
            //
            // * we have got to the end of time and are now tracking the live
            //   timeline, or:
            //
            // * the server indicated that there were no more visible events
            //   (not sure if this ever happens when we're not at the live
            //   timeline), or:
            //
            // * we are looking at some historical point, but gave up asking
            //   the server for more events
            canForwardPaginate: false,

            // start with the read-marker visible, so that we see its animated
            // disappearance when switching into the room.
            readMarkerVisible: true,

            readMarkerEventId: initialReadMarker,

            backPaginating: false,
            forwardPaginating: false,

            // cache of matrixClient.getSyncState() (but from the 'sync' event)
            clientSyncState: MatrixClientPeg.get().getSyncState(),

            // should the event tiles have twelve hour times
            isTwelveHour: SettingsStore.getValue("showTwelveHourTimestamps"),

            // always show timestamps on event tiles?
            alwaysShowTimestamps: SettingsStore.getValue("alwaysShowTimestamps"),

            // how long to show the RM for when it's visible in the window
            readMarkerInViewThresholdMs: SettingsStore.getValue("readMarkerInViewThresholdMs"),

            // how long to show the RM for when it's scrolled off-screen
            readMarkerOutOfViewThresholdMs: SettingsStore.getValue("readMarkerOutOfViewThresholdMs"),
        };
    },

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount: function() {
        debuglog("TimelinePanel: mounting");

        this.lastRRSentEventId = undefined;
        this.lastRMSentEventId = undefined;

        this._messagePanel = createRef();

        if (this.props.manageReadReceipts) {
            this.updateReadReceiptOnUserActivity();
        }
        if (this.props.manageReadMarkers) {
            this.updateReadMarkerOnUserActivity();
        }


        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        MatrixClientPeg.get().on("Room.timelineReset", this.onRoomTimelineReset);
        MatrixClientPeg.get().on("Room.redaction", this.onRoomRedaction);
        // same event handler as Room.redaction as for both we just do forceUpdate
        MatrixClientPeg.get().on("Room.redactionCancelled", this.onRoomRedaction);
        MatrixClientPeg.get().on("Room.receipt", this.onRoomReceipt);
        MatrixClientPeg.get().on("Room.localEchoUpdated", this.onLocalEchoUpdated);
        MatrixClientPeg.get().on("Room.accountData", this.onAccountData);
        MatrixClientPeg.get().on("Event.decrypted", this.onEventDecrypted);
        MatrixClientPeg.get().on("Event.replaced", this.onEventReplaced);
        MatrixClientPeg.get().on("sync", this.onSync);

        this._initTimeline(this.props);
    },

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps: function(newProps) {
        if (newProps.timelineSet !== this.props.timelineSet) {
            // throw new Error("changing timelineSet on a TimelinePanel is not supported");

            // regrettably, this does happen; in particular, when joining a
            // room with /join. In that case, there are two Rooms in
            // circulation - one which is created by the MatrixClient.joinRoom
            // call and used to create the RoomView, and a second which is
            // created by the sync loop once the room comes back down the /sync
            // pipe. Once the latter happens, our room is replaced with the new one.
            //
            // for now, just warn about this. But we're going to end up paginating
            // both rooms separately, and it's all bad.
            console.warn("Replacing timelineSet on a TimelinePanel - confusion may ensue");
        }

        if (newProps.eventId != this.props.eventId) {
            console.log("TimelinePanel switching to eventId " + newProps.eventId +
                        " (was " + this.props.eventId + ")");
            return this._initTimeline(newProps);
        }
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        if (!ObjectUtils.shallowEqual(this.props, nextProps)) {
            if (DEBUG) {
                console.group("Timeline.shouldComponentUpdate: props change");
                console.log("props before:", this.props);
                console.log("props after:", nextProps);
                console.groupEnd();
            }
            return true;
        }

        if (!ObjectUtils.shallowEqual(this.state, nextState)) {
            if (DEBUG) {
                console.group("Timeline.shouldComponentUpdate: state change");
                console.log("state before:", this.state);
                console.log("state after:", nextState);
                console.groupEnd();
            }
            return true;
        }

        return false;
    },

    componentWillUnmount: function() {
        // set a boolean to say we've been unmounted, which any pending
        // promises can use to throw away their results.
        //
        // (We could use isMounted, but facebook have deprecated that.)
        this.unmounted = true;
        if (this._readReceiptActivityTimer) {
            this._readReceiptActivityTimer.abort();
            this._readReceiptActivityTimer = null;
        }
        if (this._readMarkerActivityTimer) {
            this._readMarkerActivityTimer.abort();
            this._readMarkerActivityTimer = null;
        }

        dis.unregister(this.dispatcherRef);

        const client = MatrixClientPeg.get();
        if (client) {
            client.removeListener("Room.timeline", this.onRoomTimeline);
            client.removeListener("Room.timelineReset", this.onRoomTimelineReset);
            client.removeListener("Room.redaction", this.onRoomRedaction);
            client.removeListener("Room.redactionCancelled", this.onRoomRedaction);
            client.removeListener("Room.receipt", this.onRoomReceipt);
            client.removeListener("Room.localEchoUpdated", this.onLocalEchoUpdated);
            client.removeListener("Room.accountData", this.onAccountData);
            client.removeListener("Event.decrypted", this.onEventDecrypted);
            client.removeListener("Event.replaced", this.onEventReplaced);
            client.removeListener("sync", this.onSync);
        }
    },

    onMessageListUnfillRequest: function(backwards, scrollToken) {
        // If backwards, unpaginate from the back (i.e. the start of the timeline)
        const dir = backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS;
        debuglog("TimelinePanel: unpaginating events in direction", dir);

        // All tiles are inserted by MessagePanel to have a scrollToken === eventId, and
        // this particular event should be the first or last to be unpaginated.
        const eventId = scrollToken;

        const marker = this.state.events.findIndex(
            (ev) => {
                return ev.getId() === eventId;
            },
        );

        const count = backwards ? marker + 1 : this.state.events.length - marker;

        if (count > 0) {
            debuglog("TimelinePanel: Unpaginating", count, "in direction", dir);
            this._timelineWindow.unpaginate(count, backwards);

            // We can now paginate in the unpaginated direction
            const canPaginateKey = (backwards) ? 'canBackPaginate' : 'canForwardPaginate';
            const { events, liveEvents, firstVisibleEventIndex } = this._getEvents();
            this.setState({
                [canPaginateKey]: true,
                events,
                liveEvents,
                firstVisibleEventIndex,
            });
        }
    },

    onPaginationRequest(timelineWindow, direction, size) {
        if (this.props.onPaginationRequest) {
            return this.props.onPaginationRequest(timelineWindow, direction, size);
        } else {
            return timelineWindow.paginate(direction, size);
        }
    },

    // set off a pagination request.
    onMessageListFillRequest: function(backwards) {
        if (!this._shouldPaginate()) return Promise.resolve(false);

        const dir = backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS;
        const canPaginateKey = backwards ? 'canBackPaginate' : 'canForwardPaginate';
        const paginatingKey = backwards ? 'backPaginating' : 'forwardPaginating';

        if (!this.state[canPaginateKey]) {
            debuglog("TimelinePanel: have given up", dir, "paginating this timeline");
            return Promise.resolve(false);
        }

        if (!this._timelineWindow.canPaginate(dir)) {
            debuglog("TimelinePanel: can't", dir, "paginate any further");
            this.setState({[canPaginateKey]: false});
            return Promise.resolve(false);
        }

        if (backwards && this.state.firstVisibleEventIndex !== 0) {
            debuglog("TimelinePanel: won't", dir, "paginate past first visible event");
            return Promise.resolve(false);
        }

        debuglog("TimelinePanel: Initiating paginate; backwards:"+backwards);
        this.setState({[paginatingKey]: true});

        return this.onPaginationRequest(this._timelineWindow, dir, PAGINATE_SIZE).then((r) => {
            if (this.unmounted) { return; }

            debuglog("TimelinePanel: paginate complete backwards:"+backwards+"; success:"+r);

            const { events, liveEvents, firstVisibleEventIndex } = this._getEvents();
            const newState = {
                [paginatingKey]: false,
                [canPaginateKey]: r,
                events,
                liveEvents,
                firstVisibleEventIndex,
            };

            // moving the window in this direction may mean that we can now
            // paginate in the other where we previously could not.
            const otherDirection = backwards ? EventTimeline.FORWARDS : EventTimeline.BACKWARDS;
            const canPaginateOtherWayKey = backwards ? 'canForwardPaginate' : 'canBackPaginate';
            if (!this.state[canPaginateOtherWayKey] &&
                    this._timelineWindow.canPaginate(otherDirection)) {
                debuglog('TimelinePanel: can now', otherDirection, 'paginate again');
                newState[canPaginateOtherWayKey] = true;
            }

            // Don't resolve until the setState has completed: we need to let
            // the component update before we consider the pagination completed,
            // otherwise we'll end up paginating in all the history the js-sdk
            // has in memory because we never gave the component a chance to scroll
            // itself into the right place
            return new Promise((resolve) => {
                this.setState(newState, () => {
                    // we can continue paginating in the given direction if:
                    // - _timelineWindow.paginate says we can
                    // - we're paginating forwards, or we won't be trying to
                    //   paginate backwards past the first visible event
                    resolve(r && (!backwards || firstVisibleEventIndex === 0));
                });
            });
        });
    },

    onMessageListScroll: function(e) {
        if (this.props.onScroll) {
            this.props.onScroll(e);
        }

        if (this.props.manageReadMarkers) {
            const rmPosition = this.getReadMarkerPosition();
            // we hide the read marker when it first comes onto the screen, but if
            // it goes back off the top of the screen (presumably because the user
            // clicks on the 'jump to bottom' button), we need to re-enable it.
            if (rmPosition < 0) {
                this.setState({readMarkerVisible: true});
            }

            // if read marker position goes between 0 and -1/1,
            // (and user is active), switch timeout
            const timeout = this._readMarkerTimeout(rmPosition);
            // NO-OP when timeout already has set to the given value
            this._readMarkerActivityTimer.changeTimeout(timeout);
        }
    },

    onAction: function(payload) {
        if (payload.action === 'ignore_state_changed') {
            this.forceUpdate();
        }
        if (payload.action === "edit_event") {
            const editState = payload.event ? new EditorStateTransfer(payload.event) : null;
            this.setState({editState}, () => {
                if (payload.event && this._messagePanel.current) {
                    this._messagePanel.current.scrollToEventIfNeeded(
                        payload.event.getId(),
                    );
                }
            });
        }
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline, removed, data) {
        // ignore events for other timeline sets
        if (data.timeline.getTimelineSet() !== this.props.timelineSet) return;

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        if (!this._messagePanel.current) return;

        if (!this._messagePanel.current.getScrollState().stuckAtBottom) {
            // we won't load this event now, because we don't want to push any
            // events off the other end of the timeline. But we need to note
            // that we can now paginate.
            this.setState({canForwardPaginate: true});
            return;
        }

        // tell the timeline window to try to advance itself, but not to make
        // an http request to do so.
        //
        // we deliberately avoid going via the ScrollPanel for this call - the
        // ScrollPanel might already have an active pagination promise, which
        // will fail, but would stop us passing the pagination request to the
        // timeline window.
        //
        // see https://github.com/vector-im/vector-web/issues/1035
        this._timelineWindow.paginate(EventTimeline.FORWARDS, 1, false).then(() => {
            if (this.unmounted) { return; }

            const { events, liveEvents, firstVisibleEventIndex } = this._getEvents();
            const lastLiveEvent = liveEvents[liveEvents.length - 1];

            const updatedState = {
                events,
                liveEvents,
                firstVisibleEventIndex,
            };

            let callRMUpdated;
            if (this.props.manageReadMarkers) {
                // when a new event arrives when the user is not watching the
                // window, but the window is in its auto-scroll mode, make sure the
                // read marker is visible.
                //
                // We ignore events we have sent ourselves; we don't want to see the
                // read-marker when a remote echo of an event we have just sent takes
                // more than the timeout on userActiveRecently.
                //
                const myUserId = MatrixClientPeg.get().credentials.userId;
                const sender = ev.sender ? ev.sender.userId : null;
                callRMUpdated = false;
                if (sender != myUserId && !UserActivity.sharedInstance().userActiveRecently()) {
                    updatedState.readMarkerVisible = true;
                } else if (lastLiveEvent && this.getReadMarkerPosition() === 0) {
                    // we know we're stuckAtBottom, so we can advance the RM
                    // immediately, to save a later render cycle

                    this._setReadMarker(lastLiveEvent.getId(), lastLiveEvent.getTs(), true);
                    updatedState.readMarkerVisible = false;
                    updatedState.readMarkerEventId = lastLiveEvent.getId();
                    callRMUpdated = true;
                }
            }

            this.setState(updatedState, () => {
                this._messagePanel.current.updateTimelineMinHeight();
                if (callRMUpdated) {
                    this.props.onReadMarkerUpdated();
                }
            });
        });
    },

    onRoomTimelineReset: function(room, timelineSet) {
        if (timelineSet !== this.props.timelineSet) return;

        if (this._messagePanel.current && this._messagePanel.current.isAtBottom()) {
            this._loadTimeline();
        }
    },

    canResetTimeline: function() {
        return this._messagePanel.current && this._messagePanel.current.isAtBottom();
    },

    onRoomRedaction: function(ev, room) {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (room !== this.props.timelineSet.room) return;

        // we could skip an update if the event isn't in our timeline,
        // but that's probably an early optimisation.
        this.forceUpdate();
    },

    onEventReplaced: function(replacedEvent, room) {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (room !== this.props.timelineSet.room) return;

        // we could skip an update if the event isn't in our timeline,
        // but that's probably an early optimisation.
        this.forceUpdate();
    },

    onRoomReceipt: function(ev, room) {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (room !== this.props.timelineSet.room) return;

        this.forceUpdate();
    },

    onLocalEchoUpdated: function(ev, room, oldEventId) {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (room !== this.props.timelineSet.room) return;

        this._reloadEvents();
    },

    onAccountData: function(ev, room) {
        if (this.unmounted) return;

        // ignore events for other rooms
        if (room !== this.props.timelineSet.room) return;

        if (ev.getType() !== "m.fully_read") return;

        // XXX: roomReadMarkerTsMap not updated here so it is now inconsistent. Replace
        // this mechanism of determining where the RM is relative to the view-port with
        // one supported by the server (the client needs more than an event ID).
        this.setState({
            readMarkerEventId: ev.getContent().event_id,
        }, this.props.onReadMarkerUpdated);
    },

    onEventDecrypted: function(ev) {
        // Can be null for the notification timeline, etc.
        if (!this.props.timelineSet.room) return;

        // Need to update as we don't display event tiles for events that
        // haven't yet been decrypted. The event will have just been updated
        // in place so we just need to re-render.
        // TODO: We should restrict this to only events in our timeline,
        // but possibly the event tile itself should just update when this
        // happens to save us re-rendering the whole timeline.
        if (ev.getRoomId() === this.props.timelineSet.room.roomId) {
            this.forceUpdate();
        }
    },

    onSync: function(state, prevState, data) {
        this.setState({clientSyncState: state});
    },

    _readMarkerTimeout(readMarkerPosition) {
        return readMarkerPosition === 0 ?
            this.state.readMarkerInViewThresholdMs :
            this.state.readMarkerOutOfViewThresholdMs;
    },

    updateReadMarkerOnUserActivity: async function() {
        const initialTimeout = this._readMarkerTimeout(this.getReadMarkerPosition());
        this._readMarkerActivityTimer = new Timer(initialTimeout);

        while (this._readMarkerActivityTimer) { //unset on unmount
            UserActivity.sharedInstance().timeWhileActiveRecently(this._readMarkerActivityTimer);
            try {
                await this._readMarkerActivityTimer.finished();
            } catch (e) { continue; /* aborted */ }
            // outside of try/catch to not swallow errors
            this.updateReadMarker();
        }
    },

    updateReadReceiptOnUserActivity: async function() {
        this._readReceiptActivityTimer = new Timer(READ_RECEIPT_INTERVAL_MS);
        while (this._readReceiptActivityTimer) { //unset on unmount
            UserActivity.sharedInstance().timeWhileActiveNow(this._readReceiptActivityTimer);
            try {
                await this._readReceiptActivityTimer.finished();
            } catch (e) { continue; /* aborted */ }
            // outside of try/catch to not swallow errors
            this.sendReadReceipt();
        }
    },

    sendReadReceipt: function() {
        if (SettingsStore.getValue("lowBandwidth")) return;

        if (!this._messagePanel.current) return;
        if (!this.props.manageReadReceipts) return;
        // This happens on user_activity_end which is delayed, and it's
        // very possible have logged out within that timeframe, so check
        // we still have a client.
        const cli = MatrixClientPeg.get();
        // if no client or client is guest don't send RR or RM
        if (!cli || cli.isGuest()) return;

        let shouldSendRR = true;

        const currentRREventId = this._getCurrentReadReceipt(true);
        const currentRREventIndex = this._indexForEventId(currentRREventId);
        // We want to avoid sending out read receipts when we are looking at
        // events in the past which are before the latest RR.
        //
        // For now, let's apply a heuristic: if (a) the event corresponding to
        // the latest RR (either from the server, or sent by ourselves) doesn't
        // appear in our timeline, and (b) we could forward-paginate the event
        // timeline, then don't send any more RRs.
        //
        // This isn't watertight, as we could be looking at a section of
        // timeline which is *after* the latest RR (so we should actually send
        // RRs) - but that is a bit of a niche case. It will sort itself out when
        // the user eventually hits the live timeline.
        //
        if (currentRREventId && currentRREventIndex === null &&
                this._timelineWindow.canPaginate(EventTimeline.FORWARDS)) {
            shouldSendRR = false;
        }

        const lastReadEventIndex = this._getLastDisplayedEventIndex({
            ignoreOwn: true,
        });
        if (lastReadEventIndex === null) {
            shouldSendRR = false;
        }
        let lastReadEvent = this.state.events[lastReadEventIndex];
        shouldSendRR = shouldSendRR &&
            // Only send a RR if the last read event is ahead in the timeline relative to
            // the current RR event.
            lastReadEventIndex > currentRREventIndex &&
            // Only send a RR if the last RR set != the one we would send
            this.lastRRSentEventId != lastReadEvent.getId();

        // Only send a RM if the last RM sent != the one we would send
        const shouldSendRM =
            this.lastRMSentEventId != this.state.readMarkerEventId;

        // we also remember the last read receipt we sent to avoid spamming the
        // same one at the server repeatedly
        if (shouldSendRR || shouldSendRM) {
            if (shouldSendRR) {
                this.lastRRSentEventId = lastReadEvent.getId();
            } else {
                lastReadEvent = null;
            }
            this.lastRMSentEventId = this.state.readMarkerEventId;

            const roomId = this.props.timelineSet.room.roomId;
            const hiddenRR = !SettingsStore.getValue("sendReadReceipts", roomId);

            debuglog('TimelinePanel: Sending Read Markers for ',
                this.props.timelineSet.room.roomId,
                'rm', this.state.readMarkerEventId,
                lastReadEvent ? 'rr ' + lastReadEvent.getId() : '',
                ' hidden:' + hiddenRR,
            );
            MatrixClientPeg.get().setRoomReadMarkers(
                this.props.timelineSet.room.roomId,
                this.state.readMarkerEventId,
                lastReadEvent, // Could be null, in which case no RR is sent
                {hidden: hiddenRR},
            ).catch((e) => {
                // /read_markers API is not implemented on this HS, fallback to just RR
                if (e.errcode === 'M_UNRECOGNIZED' && lastReadEvent) {
                    return MatrixClientPeg.get().sendReadReceipt(
                        lastReadEvent,
                        {hidden: hiddenRR},
                    ).catch((e) => {
                        console.error(e);
                        this.lastRRSentEventId = undefined;
                    });
                } else {
                    console.error(e);
                }
                // it failed, so allow retries next time the user is active
                this.lastRRSentEventId = undefined;
                this.lastRMSentEventId = undefined;
            });

            // do a quick-reset of our unreadNotificationCount to avoid having
            // to wait from the remote echo from the homeserver.
            // we only do this if we're right at the end, because we're just assuming
            // that sending an RR for the latest message will set our notif counter
            // to zero: it may not do this if we send an RR for somewhere before the end.
            if (this.isAtEndOfLiveTimeline()) {
                this.props.timelineSet.room.setUnreadNotificationCount('total', 0);
                this.props.timelineSet.room.setUnreadNotificationCount('highlight', 0);
                dis.dispatch({
                    action: 'on_room_read',
                    roomId: this.props.timelineSet.room.roomId,
                });
            }
        }
    },

    // if the read marker is on the screen, we can now assume we've caught up to the end
    // of the screen, so move the marker down to the bottom of the screen.
    updateReadMarker: function() {
        if (!this.props.manageReadMarkers) return;
        if (this.getReadMarkerPosition() === 1) {
            // the read marker is at an event below the viewport,
            // we don't want to rewind it.
            return;
        }
        // move the RM to *after* the message at the bottom of the screen. This
        // avoids a problem whereby we never advance the RM if there is a huge
        // message which doesn't fit on the screen.
        const lastDisplayedIndex = this._getLastDisplayedEventIndex({
            allowPartial: true,
        });

        if (lastDisplayedIndex === null) {
            return;
        }
        const lastDisplayedEvent = this.state.events[lastDisplayedIndex];
        this._setReadMarker(lastDisplayedEvent.getId(),
                            lastDisplayedEvent.getTs());

        // the read-marker should become invisible, so that if the user scrolls
        // down, they don't see it.
        if (this.state.readMarkerVisible) {
            this.setState({
                readMarkerVisible: false,
            });
        }

        // Send the updated read marker (along with read receipt) to the server
        this.sendReadReceipt();
    },


    // advance the read marker past any events we sent ourselves.
    _advanceReadMarkerPastMyEvents: function() {
        if (!this.props.manageReadMarkers) return;

        // we call `_timelineWindow.getEvents()` rather than using
        // `this.state.liveEvents`, because React batches the update to the
        // latter, so it may not have been updated yet.
        const events = this._timelineWindow.getEvents();

        // first find where the current RM is
        let i;
        for (i = 0; i < events.length; i++) {
            if (events[i].getId() == this.state.readMarkerEventId) {
                break;
            }
        }
        if (i >= events.length) {
            return;
        }

        // now think about advancing it
        const myUserId = MatrixClientPeg.get().credentials.userId;
        for (i++; i < events.length; i++) {
            const ev = events[i];
            if (!ev.sender || ev.sender.userId != myUserId) {
                break;
            }
        }
        // i is now the first unread message which we didn't send ourselves.
        i--;

        const ev = events[i];
        this._setReadMarker(ev.getId(), ev.getTs());
    },

    /* jump down to the bottom of this room, where new events are arriving
     */
    jumpToLiveTimeline: function() {
        // if we can't forward-paginate the existing timeline, then there
        // is no point reloading it - just jump straight to the bottom.
        //
        // Otherwise, reload the timeline rather than trying to paginate
        // through all of space-time.
        if (this._timelineWindow.canPaginate(EventTimeline.FORWARDS)) {
            this._loadTimeline();
        } else {
            if (this._messagePanel.current) {
                this._messagePanel.current.scrollToBottom();
            }
        }
    },

    /* scroll to show the read-up-to marker. We put it 1/3 of the way down
     * the container.
     */
    jumpToReadMarker: function() {
        if (!this.props.manageReadMarkers) return;
        if (!this._messagePanel.current) return;
        if (!this.state.readMarkerEventId) return;

        // we may not have loaded the event corresponding to the read-marker
        // into the _timelineWindow. In that case, attempts to scroll to it
        // will fail.
        //
        // a quick way to figure out if we've loaded the relevant event is
        // simply to check if the messagepanel knows where the read-marker is.
        const ret = this._messagePanel.current.getReadMarkerPosition();
        if (ret !== null) {
            // The messagepanel knows where the RM is, so we must have loaded
            // the relevant event.
            this._messagePanel.current.scrollToEvent(this.state.readMarkerEventId,
                                                 0, 1/3);
            return;
        }

        // Looks like we haven't loaded the event corresponding to the read-marker.
        // As with jumpToLiveTimeline, we want to reload the timeline around the
        // read-marker.
        this._loadTimeline(this.state.readMarkerEventId, 0, 1/3);
    },

    /* update the read-up-to marker to match the read receipt
     */
    forgetReadMarker: function() {
        if (!this.props.manageReadMarkers) return;

        const rmId = this._getCurrentReadReceipt();

        // see if we know the timestamp for the rr event
        const tl = this.props.timelineSet.getTimelineForEvent(rmId);
        let rmTs;
        if (tl) {
            const event = tl.getEvents().find((e) => { return e.getId() == rmId; });
            if (event) {
                rmTs = event.getTs();
            }
        }

        this._setReadMarker(rmId, rmTs);
    },

    /* return true if the content is fully scrolled down and we are
     * at the end of the live timeline.
     */
    isAtEndOfLiveTimeline: function() {
        return this._messagePanel.current
            && this._messagePanel.current.isAtBottom()
            && this._timelineWindow
            && !this._timelineWindow.canPaginate(EventTimeline.FORWARDS);
    },


    /* get the current scroll state. See ScrollPanel.getScrollState for
     * details.
     *
     * returns null if we are not mounted.
     */
    getScrollState: function() {
        if (!this._messagePanel.current) { return null; }
        return this._messagePanel.current.getScrollState();
    },

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is visible
    //  +1: read marker is below the window
    getReadMarkerPosition: function() {
        if (!this.props.manageReadMarkers) return null;
        if (!this._messagePanel.current) return null;

        const ret = this._messagePanel.current.getReadMarkerPosition();
        if (ret !== null) {
            return ret;
        }

        // the messagePanel doesn't know where the read marker is.
        // if we know the timestamp of the read marker, make a guess based on that.
        const rmTs = TimelinePanel.roomReadMarkerTsMap[this.props.timelineSet.room.roomId];
        if (rmTs && this.state.events.length > 0) {
            if (rmTs < this.state.events[0].getTs()) {
                return -1;
            } else {
                return 1;
            }
        }

        return null;
    },

    canJumpToReadMarker: function() {
        // 1. Do not show jump bar if neither the RM nor the RR are set.
        // 3. We want to show the bar if the read-marker is off the top of the screen.
        // 4. Also, if pos === null, the event might not be paginated - show the unread bar
        const pos = this.getReadMarkerPosition();
        const ret = this.state.readMarkerEventId !== null && // 1.
            (pos < 0 || pos === null); // 3., 4.
        return ret;
    },

    /*
     * called by the parent component when PageUp/Down/etc is pressed.
     *
     * We pass it down to the scroll panel.
     */
    handleScrollKey: function(ev) {
        if (!this._messagePanel.current) { return; }

        // jump to the live timeline on ctrl-end, rather than the end of the
        // timeline window.
        if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey && ev.key === Key.END) {
            this.jumpToLiveTimeline();
        } else {
            this._messagePanel.current.handleScrollKey(ev);
        }
    },

    _initTimeline: function(props) {
        const initialEvent = props.eventId;
        const pixelOffset = props.eventPixelOffset;

        // if a pixelOffset is given, it is relative to the bottom of the
        // container. If not, put the event in the middle of the container.
        let offsetBase = 1;
        if (pixelOffset == null) {
            offsetBase = 0.5;
        }

        return this._loadTimeline(initialEvent, pixelOffset, offsetBase);
    },

    /**
     * (re)-load the event timeline, and initialise the scroll state, centered
     * around the given event.
     *
     * @param {string?}  eventId the event to focus on. If undefined, will
     *    scroll to the bottom of the room.
     *
     * @param {number?} pixelOffset   offset to position the given event at
     *    (pixels from the offsetBase). If omitted, defaults to 0.
     *
     * @param {number?} offsetBase the reference point for the pixelOffset. 0
     *     means the top of the container, 1 means the bottom, and fractional
     *     values mean somewhere in the middle. If omitted, it defaults to 0.
     *
     * returns a promise which will resolve when the load completes.
     */
    _loadTimeline: function(eventId, pixelOffset, offsetBase) {
        this._timelineWindow = new Matrix.TimelineWindow(
            MatrixClientPeg.get(), this.props.timelineSet,
            {windowLimit: this.props.timelineCap});

        const onLoaded = () => {
            // clear the timeline min-height when
            // (re)loading the timeline
            if (this._messagePanel.current) {
                this._messagePanel.current.onTimelineReset();
            }
            this._reloadEvents();

            // If we switched away from the room while there were pending
            // outgoing events, the read-marker will be before those events.
            // We need to skip over any which have subsequently been sent.
            this._advanceReadMarkerPastMyEvents();

            this.setState({
                canBackPaginate: this._timelineWindow.canPaginate(EventTimeline.BACKWARDS),
                canForwardPaginate: this._timelineWindow.canPaginate(EventTimeline.FORWARDS),
                timelineLoading: false,
            }, () => {
                // initialise the scroll state of the message panel
                if (!this._messagePanel.current) {
                    // this shouldn't happen - we know we're mounted because
                    // we're in a setState callback, and we know
                    // timelineLoading is now false, so render() should have
                    // mounted the message panel.
                    console.log("can't initialise scroll state because " +
                                "messagePanel didn't load");
                    return;
                }
                if (eventId) {
                    this._messagePanel.current.scrollToEvent(eventId, pixelOffset,
                                                         offsetBase);
                } else {
                    this._messagePanel.current.scrollToBottom();
                }

                this.sendReadReceipt();
            });
        };

        const onError = (error) => {
            this.setState({ timelineLoading: false });
            console.error(
                `Error loading timeline panel at ${eventId}: ${error}`,
            );
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

            let onFinished;

            // if we were given an event ID, then when the user closes the
            // dialog, let's jump to the end of the timeline. If we weren't,
            // something has gone badly wrong and rather than causing a loop of
            // undismissable dialogs, let's just give up.
            if (eventId) {
                onFinished = () => {
                    // go via the dispatcher so that the URL is updated
                    dis.dispatch({
                        action: 'view_room',
                        room_id: this.props.timelineSet.room.roomId,
                    });
                };
            }
            let message;
            if (error.errcode == 'M_FORBIDDEN') {
                message = _t(
                    "Tried to load a specific point in this room's timeline, but you " +
                    "do not have permission to view the message in question.",
                );
            } else {
                message = _t(
                    "Tried to load a specific point in this room's timeline, but was " +
                    "unable to find it.",
                );
            }
            Modal.createTrackedDialog('Failed to load timeline position', '', ErrorDialog, {
                title: _t("Failed to load timeline position"),
                description: message,
                onFinished: onFinished,
            });
        };

        // if we already have the event in question, TimelineWindow.load
        // returns a resolved promise.
        //
        // In this situation, we don't really want to defer the update of the
        // state to the next event loop, because it makes room-switching feel
        // quite slow. So we detect that situation and shortcut straight to
        // calling _reloadEvents and updating the state.

        const timeline = this.props.timelineSet.getTimelineForEvent(eventId);
        if (timeline) {
            // This is a hot-path optimization by skipping a promise tick
            // by repeating a no-op sync branch in TimelineSet.getTimelineForEvent & MatrixClient.getEventTimeline
            this._timelineWindow.load(eventId, INITIAL_SIZE); // in this branch this method will happen in sync time
            onLoaded();
        } else {
            const prom = this._timelineWindow.load(eventId, INITIAL_SIZE);
            this.setState({
                events: [],
                liveEvents: [],
                canBackPaginate: false,
                canForwardPaginate: false,
                timelineLoading: true,
            });
            prom.then(onLoaded, onError);
        }
    },

    // handle the completion of a timeline load or localEchoUpdate, by
    // reloading the events from the timelinewindow and pending event list into
    // the state.
    _reloadEvents: function() {
        // we might have switched rooms since the load started - just bin
        // the results if so.
        if (this.unmounted) return;

        this.setState(this._getEvents());
    },

    // get the list of events from the timeline window and the pending event list
    _getEvents: function() {
        const events = this._timelineWindow.getEvents();
        const firstVisibleEventIndex = this._checkForPreJoinUISI(events);

        // Hold onto the live events separately. The read receipt and read marker
        // should use this list, so that they don't advance into pending events.
        const liveEvents = [...events];

        // if we're at the end of the live timeline, append the pending events
        if (!this._timelineWindow.canPaginate(EventTimeline.FORWARDS)) {
            events.push(...this.props.timelineSet.getPendingEvents());
        }

        return {
            events,
            liveEvents,
            firstVisibleEventIndex,
        };
    },

    /**
     * Check for undecryptable messages that were sent while the user was not in
     * the room.
     *
     * @param {Array<MatrixEvent>} events The timeline events to check
     *
     * @return {Number} The index within `events` of the event after the most recent
     * undecryptable event that was sent while the user was not in the room.  If no
     * such events were found, then it returns 0.
     */
    _checkForPreJoinUISI: function(events) {
        const room = this.props.timelineSet.room;

        if (events.length === 0 || !room ||
            !MatrixClientPeg.get().isRoomEncrypted(room.roomId)) {
            return 0;
        }

        const userId = MatrixClientPeg.get().credentials.userId;

        // get the user's membership at the last event by getting the timeline
        // that the event belongs to, and traversing the timeline looking for
        // that event, while keeping track of the user's membership
        let i;
        let userMembership = "leave";
        for (i = events.length - 1; i >= 0; i--) {
            const timeline = room.getTimelineForEvent(events[i].getId());
            if (!timeline) {
                // Somehow, it seems to be possible for live events to not have
                // a timeline, even though that should not happen. :(
                // https://github.com/vector-im/element-web/issues/12120
                console.warn(
                    `Event ${events[i].getId()} in room ${room.roomId} is live, ` +
                    `but it does not have a timeline`,
                );
                continue;
            }
            const userMembershipEvent =
                    timeline.getState(EventTimeline.FORWARDS).getMember(userId);
            userMembership = userMembershipEvent ? userMembershipEvent.membership : "leave";
            const timelineEvents = timeline.getEvents();
            for (let j = timelineEvents.length - 1; j >= 0; j--) {
                const event = timelineEvents[j];
                if (event.getId() === events[i].getId()) {
                    break;
                } else if (event.getStateKey() === userId
                    && event.getType() === "m.room.member") {
                    const prevContent = event.getPrevContent();
                    userMembership = prevContent.membership || "leave";
                }
            }
            break;
        }

        // now go through the rest of the events and find the first undecryptable
        // one that was sent when the user wasn't in the room
        for (; i >= 0; i--) {
            const event = events[i];
            if (event.getStateKey() === userId
                && event.getType() === "m.room.member") {
                const prevContent = event.getPrevContent();
                userMembership = prevContent.membership || "leave";
            } else if (userMembership === "leave" &&
                       (event.isDecryptionFailure() || event.isBeingDecrypted())) {
                // reached an undecryptable message when the user wasn't in
                // the room -- don't try to load any more
                // Note: for now, we assume that events that are being decrypted are
                // not decryptable
                return i + 1;
            }
        }
        return 0;
    },

    _indexForEventId: function(evId) {
        for (let i = 0; i < this.state.events.length; ++i) {
            if (evId == this.state.events[i].getId()) {
                return i;
            }
        }
        return null;
    },

    _getLastDisplayedEventIndex: function(opts) {
        opts = opts || {};
        const ignoreOwn = opts.ignoreOwn || false;
        const allowPartial = opts.allowPartial || false;

        const messagePanel = this._messagePanel.current;
        if (!messagePanel) return null;

        const messagePanelNode = ReactDOM.findDOMNode(messagePanel);
        if (!messagePanelNode) return null; // sometimes this happens for fresh rooms/post-sync
        const wrapperRect = messagePanelNode.getBoundingClientRect();
        const myUserId = MatrixClientPeg.get().credentials.userId;

        const isNodeInView = (node) => {
            if (node) {
                const boundingRect = node.getBoundingClientRect();
                if ((allowPartial && boundingRect.top < wrapperRect.bottom) ||
                    (!allowPartial && boundingRect.bottom < wrapperRect.bottom)) {
                    return true;
                }
            }
            return false;
        };

        // We keep track of how many of the adjacent events didn't have a tile
        // but should have the read receipt moved past them, so
        // we can include those once we find the last displayed (visible) event.
        // The counter is not started for events we don't want
        // to send a read receipt for (our own events, local echos).
        let adjacentInvisibleEventCount = 0;
        // Use `liveEvents` here because we don't want the read marker or read
        // receipt to advance into pending events.
        for (let i = this.state.liveEvents.length - 1; i >= 0; --i) {
            const ev = this.state.liveEvents[i];

            const node = messagePanel.getNodeForEventId(ev.getId());
            const isInView = isNodeInView(node);

            // when we've reached the first visible event, and the previous
            // events were all invisible (with the first one not being ignored),
            // return the index of the first invisible event.
            if (isInView && adjacentInvisibleEventCount !== 0) {
                return i + adjacentInvisibleEventCount;
            }
            if (node && !isInView) {
                // has node but not in view, so reset adjacent invisible events
                adjacentInvisibleEventCount = 0;
            }

            const shouldIgnore = !!ev.status || // local echo
                (ignoreOwn && ev.sender && ev.sender.userId == myUserId);   // own message
            const isWithoutTile = !haveTileForEvent(ev) || shouldHideEvent(ev);

            if (isWithoutTile || !node) {
                // don't start counting if the event should be ignored,
                // but continue counting if we were already so the offset
                // to the previous invisble event that didn't need to be ignored
                // doesn't get messed up
                if (!shouldIgnore || (shouldIgnore && adjacentInvisibleEventCount !== 0)) {
                    ++adjacentInvisibleEventCount;
                }
                continue;
            }

            if (shouldIgnore) {
                continue;
            }

            if (isInView) {
                return i;
            }
        }

        return null;
    },

    /**
     * Get the id of the event corresponding to our user's latest read-receipt.
     *
     * @param {Boolean} ignoreSynthesized If true, return only receipts that
     *                                    have been sent by the server, not
     *                                    implicit ones generated by the JS
     *                                    SDK.
     * @return {String} the event ID
     */
    _getCurrentReadReceipt: function(ignoreSynthesized) {
        const client = MatrixClientPeg.get();
        // the client can be null on logout
        if (client == null) {
            return null;
        }

        const myUserId = client.credentials.userId;
        return this.props.timelineSet.room.getEventReadUpTo(myUserId, ignoreSynthesized);
    },

    _setReadMarker: function(eventId, eventTs, inhibitSetState) {
        const roomId = this.props.timelineSet.room.roomId;

        // don't update the state (and cause a re-render) if there is
        // no change to the RM.
        if (eventId === this.state.readMarkerEventId) {
            return;
        }

        // in order to later figure out if the read marker is
        // above or below the visible timeline, we stash the timestamp.
        TimelinePanel.roomReadMarkerTsMap[roomId] = eventTs;

        if (inhibitSetState) {
            return;
        }

        // Do the local echo of the RM
        // run the render cycle before calling the callback, so that
        // getReadMarkerPosition() returns the right thing.
        this.setState({
            readMarkerEventId: eventId,
        }, this.props.onReadMarkerUpdated);
    },

    _shouldPaginate: function() {
        // don't try to paginate while events in the timeline are
        // still being decrypted. We don't render events while they're
        // being decrypted, so they don't take up space in the timeline.
        // This means we can pull quite a lot of events into the timeline
        // and end up trying to render a lot of events.
        return !this.state.events.some((e) => {
            return e.isBeingDecrypted();
        });
    },

    getRelationsForEvent(...args) {
        return this.props.timelineSet.getRelationsForEvent(...args);
    },

    render: function() {
        const MessagePanel = sdk.getComponent("structures.MessagePanel");
        const Loader = sdk.getComponent("elements.Spinner");

        // just show a spinner while the timeline loads.
        //
        // put it in a div of the right class (mx_RoomView_messagePanel) so
        // that the order in the roomview flexbox is correct, and
        // mx_RoomView_messageListWrapper to position the inner div in the
        // right place.
        //
        // Note that the click-on-search-result functionality relies on the
        // fact that the messagePanel is hidden while the timeline reloads,
        // but that the RoomHeader (complete with search term) continues to
        // exist.
        if (this.state.timelineLoading) {
            return (
                <div className="mx_RoomView_messagePanelSpinner">
                    <Loader />
                </div>
            );
        }

        if (this.state.events.length == 0 && !this.state.canBackPaginate && this.props.empty) {
            return (
                <div className={this.props.className + " mx_RoomView_messageListWrapper"}>
                    <div className="mx_RoomView_empty">{this.props.empty}</div>
                </div>
            );
        }

        // give the messagepanel a stickybottom if we're at the end of the
        // live timeline, so that the arrival of new events triggers a
        // scroll.
        //
        // Make sure that stickyBottom is *false* if we can paginate
        // forwards, otherwise if somebody hits the bottom of the loaded
        // events when viewing historical messages, we get stuck in a loop
        // of paginating our way through the entire history of the room.
        const stickyBottom = !this._timelineWindow.canPaginate(EventTimeline.FORWARDS);

        // If the state is PREPARED or CATCHUP, we're still waiting for the js-sdk to sync with
        // the HS and fetch the latest events, so we are effectively forward paginating.
        const forwardPaginating = (
            this.state.forwardPaginating ||
            ['PREPARED', 'CATCHUP'].includes(this.state.clientSyncState)
        );
        const events = this.state.firstVisibleEventIndex
              ? this.state.events.slice(this.state.firstVisibleEventIndex)
              : this.state.events;
        return (
            <MessagePanel
                ref={this._messagePanel}
                room={this.props.timelineSet.room}
                permalinkCreator={this.props.permalinkCreator}
                hidden={this.props.hidden}
                backPaginating={this.state.backPaginating}
                forwardPaginating={forwardPaginating}
                events={events}
                highlightedEventId={this.props.highlightedEventId}
                readMarkerEventId={this.state.readMarkerEventId}
                readMarkerVisible={this.state.readMarkerVisible}
                suppressFirstDateSeparator={this.state.canBackPaginate}
                showUrlPreview={this.props.showUrlPreview}
                showReadReceipts={this.props.showReadReceipts}
                ourUserId={MatrixClientPeg.get().credentials.userId}
                stickyBottom={stickyBottom}
                onScroll={this.onMessageListScroll}
                onFillRequest={this.onMessageListFillRequest}
                onUnfillRequest={this.onMessageListUnfillRequest}
                isTwelveHour={this.state.isTwelveHour}
                alwaysShowTimestamps={this.state.alwaysShowTimestamps}
                className={this.props.className}
                tileShape={this.props.tileShape}
                resizeNotifier={this.props.resizeNotifier}
                getRelationsForEvent={this.getRelationsForEvent}
                editState={this.state.editState}
                showReactions={this.props.showReactions}
                useIRCLayout={this.props.useIRCLayout}
            />
        );
    },
});

export default TimelinePanel;
