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

var PAGINATE_SIZE = 20;
var INITIAL_SIZE = 20;
var TIMELINE_CAP = 1000; // the most events to show in a timeline

var DEBUG = false;

if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    var debuglog = console.log.bind(console);
} else {
    var debuglog = function () {};
}

/*
 * Component which shows the event timeline in a room view.
 *
 * Also responsible for handling and sending read receipts.
 */
module.exports = React.createClass({
    displayName: 'TimelinePanel',

    propTypes: {
        // The js-sdk Room object for the room whose timeline we are
        // representing.
        room: React.PropTypes.object.isRequired,

        // true to give the component a 'display: none' style.
        hidden: React.PropTypes.bool,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        // typically this will be either 'eventId' or undefined.
        highlightedEventId: React.PropTypes.string,

        // id of an event to jump to. If not given, will go to the end of the
        // live timeline.
        eventId: React.PropTypes.string,

        // where to position the event given by eventId, in pixels from the
        // bottom of the viewport. If not given, will try to put the event in the
        // middle of the viewprt.
        eventPixelOffset: React.PropTypes.number,

        // callback to determine if a user is the magic freeswitch conference
        // user. Takes one parameter, which is a user id. Should return true if
        // the user is the conference user.
        isConferenceUser: React.PropTypes.func,

        // callback which is called when the panel is scrolled.
        onScroll: React.PropTypes.func,
    },

    getInitialState: function() {
        return {
            events: [],
            timelineLoading: true, // track whether our room timeline is loading
            canBackPaginate: true,
            readMarkerEventId: this._getCurrentReadReceipt(),
        };
    },

    componentWillMount: function() {
        debuglog("TimelinePanel: mounting");

        this.last_rr_sent_event_id = undefined;
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        MatrixClientPeg.get().on("Room.receipt", this.onRoomReceipt);

        this._initTimeline(this.props);
    },

    componentWillReceiveProps: function(newProps) {
        if (newProps.room !== this.props.room) {
            throw new Error("changing room on a TimelinePanel is not supported");
        }

        if (newProps.eventId != this.props.eventId) {
            console.log("TimelinePanel switching to eventId " + newProps.eventId +
                        " (was " + this.props.eventId + ")");
            return this._initTimeline(newProps);
        }
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
            client.removeListener("Room.receipt", this.onRoomReceipt);
        }
    },

    // set off a pagination request.
    onMessageListFillRequest: function(backwards) {
        var dir = backwards ? EventTimeline.BACKWARDS : EventTimeline.FORWARDS;
        if(!this._timelineWindow.canPaginate(dir)) {
            debuglog("TimelinePanel: can't paginate at this time; backwards:"+backwards);
            return q(false);
        }
        debuglog("TimelinePanel: Initiating paginate; backwards:"+backwards);
        return this._timelineWindow.paginate(dir, PAGINATE_SIZE).then((r) => {
            debuglog("TimelinePanel: paginate complete backwards:"+backwards+"; success:"+r);
            this._onTimelineUpdated(r);
            return r;
        });
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
                break;
        }
    },

    onRoomTimeline: function(ev, room, toStartOfTimeline, removed, data) {
        // ignore events for other rooms
        if (room !== this.props.room) return;

        // ignore anything but real-time updates at the end of the room:
        // updates from pagination will happen when the paginate completes.
        if (toStartOfTimeline || !data || !data.liveEvent) return;

        // tell the messagepanel to go paginate itself. This in turn will cause
        // onMessageListFillRequest to be called, which will call
        // _onTimelineUpdated, which will update the state with the new event -
        // so there is no need update the state here.
        //
        if (this.refs.messagePanel) {
            this.refs.messagePanel.checkFillState();
        }
    },

    onRoomReceipt: function(receiptEvent, room) {
        if (room !== this.props.room)
            return;

        // the received event may or may not be for our user; but it turns out
        // to be easier to do the processing anyway than to figure out if it
        // is.
        var oldReadMarker = this.state.readMarkerEventId;
        var newReadMarker = this._getCurrentReadReceipt();

        if (newReadMarker == oldReadMarker) {
            return;
        }

        // suppress the animation when moving forward over an event which was sent
        // by us; the original RM will have been suppressed so we don't want to show
        // the animation either.
        var oldReadMarkerIndex = this._indexForEventId(oldReadMarker);
        if (oldReadMarkerIndex + 1 < this.state.events.length) {
            var myUserId = MatrixClientPeg.get().credentials.userId;
            var nextEvent = this.state.events[oldReadMarkerIndex + 1];
            if (nextEvent.sender && nextEvent.sender.userId == myUserId) {
                oldReadMarker = undefined;
            }
        }

        this.setState({
            readMarkerEventId: newReadMarker,
        });
    },

    sendReadReceipt: function() {
        if (!this.refs.messagePanel) return;

        var currentReadUpToEventId = this._getCurrentReadReceipt();
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

        var lastReadEventIndex = this._getLastDisplayedEventIndexIgnoringOwn();
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
        }
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

    _initTimeline: function(props) {
        var initialEvent = props.eventId;
        var pixelOffset = props.eventPixelOffset;
        return this._loadTimeline(initialEvent, pixelOffset);
    },

    /**
     * (re)-load the event timeline, and initialise the scroll state, centered
     * around the given event.
     *
     * @param {string?}  eventId the event to focus on. If undefined, will
     *    scroll to the bottom of the room.
     *
     * @param {number?} pixelOffset   offset to position the given event at
     *    (pixels from the bottom of the view). If undefined, will put the
     *    event in the middle of the view.
     *
     * returns a promise which will resolve when the load completes.
     */
    _loadTimeline: function(eventId, pixelOffset) {
        // TODO: we could optimise this, by not resetting the window if the
        // event is in the current window (though it's not obvious how we can
        // tell if the current window is on the live event stream)

        this.setState({
            events: [],
            timelineLoading: true,
        });

        this._timelineWindow = new Matrix.TimelineWindow(
            MatrixClientPeg.get(), this.props.room,
            {windowLimit: TIMELINE_CAP});

        return this._timelineWindow.load(eventId, INITIAL_SIZE).then(() => {
            debuglog("TimelinePanel: timeline loaded");
            this._onTimelineUpdated(true);
        }).finally(() => {
            this.setState({
                timelineLoading: false,
            }, () => {
                // initialise the scroll state of the message panel
                if (!this.refs.messagePanel) {
                    // this shouldn't happen.
                    console.log("can't initialise scroll state because " +
                                "messagePanel didn't load");
                    return;
                }
                if (eventId) {
                    this.refs.messagePanel.scrollToEvent(eventId, pixelOffset);
                } else {
                    this.refs.messagePanel.scrollToBottom();
                }

                this.sendReadReceipt();
            });
        });
    },

    _onTimelineUpdated: function(gotResults) {
        // we might have switched rooms since the load started - just bin
        // the results if so.
        if (this.unmounted) return;

        if (gotResults) {
            this.setState({
                events: this._timelineWindow.getEvents(),
                canBackPaginate: this._timelineWindow.canPaginate(EventTimeline.BACKWARDS),
            });
        }
    },

    _indexForEventId: function(evId) {
        for (var i = 0; i < this.state.events.length; ++i) {
            if (evId == this.state.events[i].getId()) {
                return i;
            }
        }
        return null;
    },

    _getLastDisplayedEventIndexIgnoringOwn: function() {
        var messagePanel = this.refs.messagePanel;
        if (messagePanel === undefined) return null;

        var wrapperRect = ReactDOM.findDOMNode(messagePanel).getBoundingClientRect();

        for (var i = this.state.events.length-1; i >= 0; --i) {
            var ev = this.state.events[i];

            if (ev.sender && ev.sender.userId == MatrixClientPeg.get().credentials.userId) {
                continue;
            }

            var node = messagePanel.getNodeForEventId(ev.getId());
            if (!node) continue;

            var boundingRect = node.getBoundingClientRect();

            if (boundingRect.bottom < wrapperRect.bottom) {
                return i;
            }
        }
        return null;
    },

    /**
     * get the id of the event corresponding to our user's latest read-receipt.
     */
    _getCurrentReadReceipt: function() {
        var client = MatrixClientPeg.get();
        // the client can be null on logout
        if (client == null)
            return null;

        var myUserId = client.credentials.userId;
        return this.props.room.getEventReadUpTo(myUserId);
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
                    <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper">
                        <Loader />
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
                    events={ this.state.events }
                    highlightedEventId={ this.props.highlightedEventId }
                    readMarkerEventId={ this.state.readMarkerEventId }
                    suppressFirstDateSeparator={ this.state.canBackPaginate }
                    ourUserId={ MatrixClientPeg.get().credentials.userId }
                    stickyBottom={ stickyBottom }
                    isConferenceUser={ this.props.isConferenceUser }
                    onScroll={ this.props.onScroll }
                    onFillRequest={ this.onMessageListFillRequest }
            />
        );
    },
});
