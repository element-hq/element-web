/*
Copyright 2016 OpenMarket Ltd

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

var React = require('react');
var ReactDOM = require("react-dom");
var q = require("q");

var Matrix = require("matrix-js-sdk");
var EventTimeline = Matrix.EventTimeline;

var sdk = require('../../index');
var MatrixClientPeg = require("../../MatrixClientPeg");
var dis = require("../../dispatcher");
var ObjectUtils = require('../../ObjectUtils');
var Modal = require("../../Modal");
var UserActivity = require("../../UserActivity");
var KeyCode = require('../../KeyCode');

var PAGINATE_SIZE = 20;
var INITIAL_SIZE = 20;

var DEBUG = false;

if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    var debuglog = console.log.bind(console);
} else {
    var debuglog = function() {};
}

/*
 * Component which shows the event timeline in a room view.
 *
 * Also responsible for handling and sending read receipts.
 */
var TimelinePanel = React.createClass({
    displayName: 'TimelinePanel',

    propTypes: {
        // The js-sdk EventTimelineSet object for the timeline sequence we are
        // representing.  This may or may not have a room, depending on what it's
        // a timeline representing.  If it has a room, we maintain RRs etc for
        // that room.
        timelineSet: React.PropTypes.object.isRequired,

        // Enable managing RRs and RMs. These require the timelineSet to have a room.
        manageReadReceipts: React.PropTypes.bool,
        manageReadMarkers: React.PropTypes.bool,

        // true to give the component a 'display: none' style.
        hidden: React.PropTypes.bool,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        // typically this will be either 'eventId' or undefined.
        highlightedEventId: React.PropTypes.string,

        // id of an event to jump to. If not given, will go to the end of the
        // live timeline.
        eventId: React.PropTypes.string,

        // where to position the event given by eventId, in pixels from the
        // bottom of the viewport. If not given, will try to put the event
        // half way down the viewport.
        eventPixelOffset: React.PropTypes.number,

        // Should we show URL Previews
        showUrlPreview: React.PropTypes.bool,

        // callback which is called when the panel is scrolled.
        onScroll: React.PropTypes.func,

        // callback which is called when the read-up-to mark is updated.
        onReadMarkerUpdated: React.PropTypes.func,

        // opacity for dynamic UI fading effects
        opacity: React.PropTypes.number,

        // maximum number of events to show in a timeline
        timelineCap: React.PropTypes.number,

        // classname to use for the messagepanel
        className: React.PropTypes.string,

        // shape property to be passed to EventTiles
        tileShape: React.PropTypes.string,

        // placeholder text to use if the timeline is empty
        empty: React.PropTypes.string,
    },

    statics: {
        // a map from room id to read marker event ID
        roomReadMarkerMap: {},

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
        if (this.props.manageReadMarkers) {
            var initialReadMarker =
                TimelinePanel.roomReadMarkerMap[this.props.timelineSet.room.roomId]
                           || this._getCurrentReadReceipt();
        }

        return {
            events: [],
            timelineLoading: true, // track whether our room timeline is loading

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
        };
    },

    componentWillMount: function() {
        debuglog("TimelinePanel: mounting");

        this.last_rr_sent_event_id = undefined;

        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        MatrixClientPeg.get().on("Room.timelineReset", this.onRoomTimelineReset);
        MatrixClientPeg.get().on("Room.redaction", this.onRoomRedaction);
        MatrixClientPeg.get().on("Room.receipt", this.onRoomReceipt);
        MatrixClientPeg.get().on("Room.localEchoUpdated", this.onLocalEchoUpdated);

        this._initTimeline(this.props);
    },

    componentWillReceiveProps: function(newProps) {
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

        dis.unregister(this.dispatcherRef);

        var client = MatrixClientPeg.get();
        if (client) {
            client.removeListener("Room.timeline", this.onRoomTimeline);
            client.removeListener("Room.timelineReset", this.onRoomTimelineReset);
            client.removeListener("Room.redaction", this.onRoomRedaction);
            client.removeListener("Room.receipt", this.onRoomReceipt);
            client.removeListener("Room.localEchoUpdated", this.onLocalEchoUpdated);
        }
    },

    onMessageListUnfillRequest: function(backwards, scrollToken) {
        // If backwards, unpaginate from the back (i.e. the start of the timeline)
        let dir = backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS;
        debuglog("TimelinePanel: unpaginating events in direction", dir);

        // All tiles are inserted by MessagePanel to have a scrollToken === eventId, and
        // this particular event should be the first or last to be unpaginated.
        let eventId = scrollToken;

        let marker = this.state.events.findIndex(
            (ev) => {
                return ev.getId() === eventId;
            }
        );

        let count = backwards ? marker + 1 : this.state.events.length - marker;

        if (count > 0) {
            debuglog("TimelinePanel: Unpaginating", count, "in direction", dir);
            this._timelineWindow.unpaginate(count, backwards);

            // We can now paginate in the unpaginated direction
            const canPaginateKey = (backwards) ? 'canBackPaginate' : 'canForwardPaginate';
            this.setState({
                [canPaginateKey]: true,
                events: this._getEvents(),
            });
        }
    },

    // set off a pagination request.
    onMessageListFillRequest: function(backwards) {
        var dir = backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS;
        var canPaginateKey = backwards ? 'canBackPaginate' : 'canForwardPaginate';
        var paginatingKey = backwards ? 'backPaginating' : 'forwardPaginating';

        if (!this.state[canPaginateKey]) {
            debuglog("TimelinePanel: have given up", dir, "paginating this timeline");
            return q(false);
        }

        if(!this._timelineWindow.canPaginate(dir)) {
            debuglog("TimelinePanel: can't", dir, "paginate any further");
            this.setState({[canPaginateKey]: false});
            return q(false);
        }

        debuglog("TimelinePanel: Initiating paginate; backwards:"+backwards);
        this.setState({[paginatingKey]: true});

        return this._timelineWindow.paginate(dir, PAGINATE_SIZE).then((r) => {
            if (this.unmounted) { return; }

            debuglog("TimelinePanel: paginate complete backwards:"+backwards+"; success:"+r);

            var newState = {
                [paginatingKey]: false,
                [canPaginateKey]: r,
                events: this._getEvents(),
            };

            // moving the window in this direction may mean that we can now
            // paginate in the other where we previously could not.
            var otherDirection = backwards ? EventTimeline.FORWARDS : EventTimeline.BACKWARDS;
            var canPaginateOtherWayKey = backwards ? 'canForwardPaginate' : 'canBackPaginate';
            if (!this.state[canPaginateOtherWayKey] &&
                    this._timelineWindow.canPaginate(otherDirection)) {
                debuglog('TimelinePanel: can now', otherDirection, 'paginate again');
                newState[canPaginateOtherWayKey] = true;
            }

            this.setState(newState);

            return r;
        });
    },

    onMessageListScroll: function() {
        if (this.props.onScroll) {
            this.props.onScroll();
        }

        if (this.props.manageReadMarkers) {
            // we hide the read marker when it first comes onto the screen, but if
            // it goes back off the top of the screen (presumably because the user
            // clicks on the 'jump to bottom' button), we need to re-enable it.
            if (this.getReadMarkerPosition() < 0) {
                this.setState({readMarkerVisible: true});
            }
        }
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'user_activity':
            case 'user_activity_end':
                // we could treat user_activity_end differently and not
                // send receipts for messages that have arrived between
                // the actual user activity and the time they stopped
                // being active, but let's see if this is actually
                // necessary.
                this.sendReadReceipt();
                this.updateReadMarker();
                break;
        }
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline, removed, data) {
        // ignore events for other timeline sets
        if (data.timeline.getTimelineSet() !== this.props.timelineSet) return;

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        if (!this.refs.messagePanel) return;

        if (!this.refs.messagePanel.getScrollState().stuckAtBottom) {
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
        this._timelineWindow.paginate(EventTimeline.FORWARDS, 1, false).done(() => {
            if (this.unmounted) { return; }

            var events = this._timelineWindow.getEvents();
            var lastEv = events[events.length-1];

            // if we're at the end of the live timeline, append the pending events
            if (this.props.timelineSet.room && !this._timelineWindow.canPaginate(EventTimeline.FORWARDS)) {
                events.push(...this.props.timelineSet.room.getPendingEvents());
            }

            var updatedState = {events: events};

            if (this.props.manageReadMarkers) {
                // when a new event arrives when the user is not watching the
                // window, but the window is in its auto-scroll mode, make sure the
                // read marker is visible.
                //
                // We ignore events we have sent ourselves; we don't want to see the
                // read-marker when a remote echo of an event we have just sent takes
                // more than the timeout on userCurrentlyActive.
                //
                var myUserId = MatrixClientPeg.get().credentials.userId;
                var sender = ev.sender ? ev.sender.userId : null;
                var callback = null;
                if (sender != myUserId && !UserActivity.userCurrentlyActive()) {
                    updatedState.readMarkerVisible = true;
                } else if(lastEv && this.getReadMarkerPosition() === 0) {
                    // we know we're stuckAtBottom, so we can advance the RM
                    // immediately, to save a later render cycle
                    this._setReadMarker(lastEv.getId(), lastEv.getTs(), true);
                    updatedState.readMarkerVisible = false;
                    updatedState.readMarkerEventId = lastEv.getId();
                    callback = this.props.onReadMarkerUpdated;
                }
            }

            this.setState(updatedState, callback);
        });
    },

    onRoomTimelineReset: function(room, timelineSet) {
        if (timelineSet !== this.props.timelineSet) return;

        if (this.refs.messagePanel && this.refs.messagePanel.isAtBottom()) {
            this._loadTimeline();
        }
    },

    canResetTimeline: function() {
        return this.refs.messagePanel && this.refs.messagePanel.isAtBottom();
    },

    onRoomRedaction: function(ev, room) {
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


    sendReadReceipt: function() {
        if (!this.refs.messagePanel) return;
        if (!this.props.manageReadReceipts) return;
        // This happens on user_activity_end which is delayed, and it's
        // very possible have logged out within that timeframe, so check
        // we still have a client.
        if (!MatrixClientPeg.get()) return;

        var currentReadUpToEventId = this._getCurrentReadReceipt(true);
        var currentReadUpToEventIndex = this._indexForEventId(currentReadUpToEventId);

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
        if (currentReadUpToEventId && currentReadUpToEventIndex === null &&
                this._timelineWindow.canPaginate(EventTimeline.FORWARDS)) {
            return;
        }

        var lastReadEventIndex = this._getLastDisplayedEventIndex({
            ignoreOwn: true
        });
        if (lastReadEventIndex === null) return;

        var lastReadEvent = this.state.events[lastReadEventIndex];

        // we also remember the last read receipt we sent to avoid spamming the
        // same one at the server repeatedly
        if (lastReadEventIndex > currentReadUpToEventIndex
                && this.last_rr_sent_event_id != lastReadEvent.getId()) {
            this.last_rr_sent_event_id = lastReadEvent.getId();
            MatrixClientPeg.get().sendReadReceipt(lastReadEvent).catch(() => {
                // it failed, so allow retries next time the user is active
                this.last_rr_sent_event_id = undefined;
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
                });
            }
        }
    },

    // if the read marker is on the screen, we can now assume we've caught up to the end
    // of the screen, so move the marker down to the bottom of the screen.
    updateReadMarker: function() {
        if (!this.props.manageReadMarkers) return;
        if (this.getReadMarkerPosition() !== 0) {
            return;
        }

        // move the RM to *after* the message at the bottom of the screen. This
        // avoids a problem whereby we never advance the RM if there is a huge
        // message which doesn't fit on the screen.
        //
        // But ignore local echoes for this - they have a temporary event ID
        // and we'll get confused when their ID changes and we can't figure out
        // where the RM is pointing to. The read marker will be invisible for
        // now anyway, so this doesn't really matter.
        var lastDisplayedIndex = this._getLastDisplayedEventIndex({
            allowPartial: true,
            ignoreEchoes: true,
        });

        if (lastDisplayedIndex === null) {
            return;
        }

        var lastDisplayedEvent = this.state.events[lastDisplayedIndex];
        this._setReadMarker(lastDisplayedEvent.getId(),
                            lastDisplayedEvent.getTs());

        // the read-marker should become invisible, so that if the user scrolls
        // down, they don't see it.
        if(this.state.readMarkerVisible) {
            this.setState({
                readMarkerVisible: false,
            });
        }
    },


    // advance the read marker past any events we sent ourselves.
    _advanceReadMarkerPastMyEvents: function() {
        if (!this.props.manageReadMarkers) return;

        // we call _timelineWindow.getEvents() rather than using
        // this.state.events, because react batches the update to the latter, so it
        // may not have been updated yet.
        var events = this._timelineWindow.getEvents();

        // first find where the current RM is
        for (var i = 0; i < events.length; i++) {
            if (events[i].getId() == this.state.readMarkerEventId) {
                break;
            }
        }
        if (i >= events.length) {
            return;
        }

        // now think about advancing it
        var myUserId = MatrixClientPeg.get().credentials.userId;
        for (i++; i < events.length; i++) {
            var ev = events[i];
            if (!ev.sender || ev.sender.userId != myUserId) {
                break;
            }
        }
        // i is now the first unread message which we didn't send ourselves.
        i--;

        var ev = events[i];
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
            if (this.refs.messagePanel) {
                this.refs.messagePanel.scrollToBottom();
            }
        }
    },

    /* scroll to show the read-up-to marker. We put it 1/3 of the way down
     * the container.
     */
    jumpToReadMarker: function() {
        if (!this.props.manageReadMarkers) return;
        if (!this.refs.messagePanel) return;
        if (!this.state.readMarkerEventId) return;

        // we may not have loaded the event corresponding to the read-marker
        // into the _timelineWindow. In that case, attempts to scroll to it
        // will fail.
        //
        // a quick way to figure out if we've loaded the relevant event is
        // simply to check if the messagepanel knows where the read-marker is.
        var ret = this.refs.messagePanel.getReadMarkerPosition();
        if (ret !== null) {
            // The messagepanel knows where the RM is, so we must have loaded
            // the relevant event.
            this.refs.messagePanel.scrollToEvent(this.state.readMarkerEventId,
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

        var rmId = this._getCurrentReadReceipt();

        // see if we know the timestamp for the rr event
        var tl = this.props.timelineSet.getTimelineForEvent(rmId);
        var rmTs;
        if (tl) {
            var event = tl.getEvents().find((e) => { return e.getId() == rmId; });
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
        return this.refs.messagePanel
            && this.refs.messagePanel.isAtBottom()
            && this._timelineWindow
            && !this._timelineWindow.canPaginate(EventTimeline.FORWARDS);
    },


    /* get the current scroll state. See ScrollPanel.getScrollState for
     * details.
     *
     * returns null if we are not mounted.
     */
    getScrollState: function() {
        if (!this.refs.messagePanel) { return null; }
        return this.refs.messagePanel.getScrollState();
    },

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is visible
    //  +1: read marker is below the window
    getReadMarkerPosition: function() {
        if (!this.props.manageReadMarkers) return null;
        if (!this.refs.messagePanel) return null;

        var ret = this.refs.messagePanel.getReadMarkerPosition();
        if (ret !== null) {
            return ret;
        }

        // the messagePanel doesn't know where the read marker is.
        // if we know the timestamp of the read marker, make a guess based on that.
        var rmTs = TimelinePanel.roomReadMarkerTsMap[this.props.timelineSet.roomId];
        if (rmTs && this.state.events.length > 0) {
            if (rmTs < this.state.events[0].getTs()) {
                return -1;
            } else {
                return 1;
            }
        }

        return null;
    },

    /**
     * called by the parent component when PageUp/Down/etc is pressed.
     *
     * We pass it down to the scroll panel.
     */
    handleScrollKey: function(ev) {
        if (!this.refs.messagePanel) { return; }

        // jump to the live timeline on ctrl-end, rather than the end of the
        // timeline window.
        if (ev.ctrlKey && ev.keyCode == KeyCode.END) {
            this.jumpToLiveTimeline();
        } else {
            this.refs.messagePanel.handleScrollKey(ev);
        }
    },

    _initTimeline: function(props) {
        var initialEvent = props.eventId;
        var pixelOffset = props.eventPixelOffset;

        // if a pixelOffset is given, it is relative to the bottom of the
        // container. If not, put the event in the middle of the container.
        var offsetBase = 1;
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

        var onLoaded = () => {
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
                if (!this.refs.messagePanel) {
                    // this shouldn't happen - we know we're mounted because
                    // we're in a setState callback, and we know
                    // timelineLoading is now false, so render() should have
                    // mounted the message panel.
                    console.log("can't initialise scroll state because " +
                                "messagePanel didn't load");
                    return;
                }
                if (eventId) {
                    this.refs.messagePanel.scrollToEvent(eventId, pixelOffset,
                                                         offsetBase);
                } else {
                    this.refs.messagePanel.scrollToBottom();
                }

                this.sendReadReceipt();
                this.updateReadMarker();
            });
        };

        var onError = (error) => {
            this.setState({timelineLoading: false});
            var msg = error.message ? error.message : JSON.stringify(error);
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

            var onFinished;

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
            var message = "Tried to load a specific point in this room's timeline, but ";
            if (error.errcode == 'M_FORBIDDEN') {
                message += "you do not have permission to view the message in question.";
            } else {
                message += "was unable to find it.";
            }
            Modal.createDialog(ErrorDialog, {
                title: "Failed to load timeline position",
                description: message,
                onFinished: onFinished,
            });
        };

        var prom = this._timelineWindow.load(eventId, INITIAL_SIZE);

        // if we already have the event in question, TimelineWindow.load
        // returns a resolved promise.
        //
        // In this situation, we don't really want to defer the update of the
        // state to the next event loop, because it makes room-switching feel
        // quite slow. So we detect that situation and shortcut straight to
        // calling _reloadEvents and updating the state.

        if (prom.isFulfilled()) {
            onLoaded();
        } else {
            this.setState({
                events: [],
                canBackPaginate: false,
                canForwardPaginate: false,
                timelineLoading: true,
            });

            prom = prom.then(onLoaded, onError);
        }

        prom.done();
    },

    // handle the completion of a timeline load or localEchoUpdate, by
    // reloading the events from the timelinewindow and pending event list into
    // the state.
    _reloadEvents: function() {
        // we might have switched rooms since the load started - just bin
        // the results if so.
        if (this.unmounted) return;

        this.setState({
            events: this._getEvents(),
        });
    },

    // get the list of events from the timeline window and the pending event list
    _getEvents: function() {
        var events = this._timelineWindow.getEvents();

        // if we're at the end of the live timeline, append the pending events
        if (!this._timelineWindow.canPaginate(EventTimeline.FORWARDS)) {
            events.push(...this.props.timelineSet.getPendingEvents());
        }

        return events;
    },

    _indexForEventId: function(evId) {
        for (var i = 0; i < this.state.events.length; ++i) {
            if (evId == this.state.events[i].getId()) {
                return i;
            }
        }
        return null;
    },

    _getLastDisplayedEventIndex: function(opts) {
        opts = opts || {};
        var ignoreOwn = opts.ignoreOwn || false;
        var ignoreEchoes = opts.ignoreEchoes || false;
        var allowPartial = opts.allowPartial || false;

        var messagePanel = this.refs.messagePanel;
        if (messagePanel === undefined) return null;

        var wrapperRect = ReactDOM.findDOMNode(messagePanel).getBoundingClientRect();
        var myUserId = MatrixClientPeg.get().credentials.userId;

        for (var i = this.state.events.length-1; i >= 0; --i) {
            var ev = this.state.events[i];

            if (ignoreOwn && ev.sender && ev.sender.userId == myUserId) {
                continue;
            }

            // local echoes have a fake event ID
            if (ignoreEchoes && ev.status) {
                continue;
            }

            var node = messagePanel.getNodeForEventId(ev.getId());
            if (!node) continue;

            var boundingRect = node.getBoundingClientRect();
            if ((allowPartial && boundingRect.top < wrapperRect.bottom) ||
                (!allowPartial && boundingRect.bottom < wrapperRect.bottom)) {
                return i;
            }
        }
        return null;
    },

    /**
     * get the id of the event corresponding to our user's latest read-receipt.
     *
     * @param {Boolean} ignoreSynthesized If true, return only receipts that
     *                                    have been sent by the server, not
     *                                    implicit ones generated by the JS
     *                                    SDK.
     */
    _getCurrentReadReceipt: function(ignoreSynthesized) {
        var client = MatrixClientPeg.get();
        // the client can be null on logout
        if (client == null) {
            return null;
        }

        var myUserId = client.credentials.userId;
        return this.props.timelineSet.room.getEventReadUpTo(myUserId, ignoreSynthesized);
    },

    _setReadMarker: function(eventId, eventTs, inhibitSetState) {
        var roomId = this.props.timelineSet.room.roomId;

        if (TimelinePanel.roomReadMarkerMap[roomId] == eventId) {
            // don't update the state (and cause a re-render) if there is
            // no change to the RM.
            return;
        }

        // ideally we'd sync these via the server, but for now just stash them
        // in a map.
        TimelinePanel.roomReadMarkerMap[roomId] = eventId;

        // in order to later figure out if the read marker is
        // above or below the visible timeline, we stash the timestamp.
        TimelinePanel.roomReadMarkerTsMap[roomId] = eventTs;

        if (inhibitSetState) {
            return;
        }

        // run the render cycle before calling the callback, so that
        // getReadMarkerPosition() returns the right thing.
        this.setState({
            readMarkerEventId: eventId,
        }, this.props.onReadMarkerUpdated);
    },

    render: function() {
        var MessagePanel = sdk.getComponent("structures.MessagePanel");
        var Loader = sdk.getComponent("elements.Spinner");

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
                    <div className={ this.props.className + " mx_RoomView_messageListWrapper" }>
                        <Loader />
                    </div>
            );
        }

        if (this.state.events.length == 0 && !this.state.canBackPaginate && this.props.empty) {
            return (
                    <div className={ this.props.className + " mx_RoomView_messageListWrapper" }>
                        <div className="mx_RoomView_empty">{ this.props.empty }</div>
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
        var stickyBottom = !this._timelineWindow.canPaginate(EventTimeline.FORWARDS);

        return (
            <MessagePanel ref="messagePanel"
                    hidden={ this.props.hidden }
                    backPaginating={ this.state.backPaginating }
                    forwardPaginating={ this.state.forwardPaginating }
                    events={ this.state.events }
                    highlightedEventId={ this.props.highlightedEventId }
                    readMarkerEventId={ this.state.readMarkerEventId }
                    readMarkerVisible={ this.state.readMarkerVisible }
                    suppressFirstDateSeparator={ this.state.canBackPaginate }
                    showUrlPreview = { this.props.showUrlPreview }
                    manageReadReceipts = { this.props.manageReadReceipts }
                    ourUserId={ MatrixClientPeg.get().credentials.userId }
                    stickyBottom={ stickyBottom }
                    onScroll={ this.onMessageListScroll }
                    onFillRequest={ this.onMessageListFillRequest }
                    onUnfillRequest={ this.onMessageListUnfillRequest }
                    opacity={ this.props.opacity }
                    className={ this.props.className }
                    tileShape={ this.props.tileShape }
            />
        );
    },
});

module.exports = TimelinePanel;
