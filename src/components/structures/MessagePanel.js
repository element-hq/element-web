/*
Copyright 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, {createRef} from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import shouldHideEvent from '../../shouldHideEvent';
import {wantsDateSeparator} from '../../DateUtils';
import * as sdk from '../../index';

import {MatrixClientPeg} from '../../MatrixClientPeg';
import SettingsStore from '../../settings/SettingsStore';
import {_t} from "../../languageHandler";
import {haveTileForEvent} from "../views/rooms/EventTile";
import {textForEvent} from "../../TextForEvent";
import IRCTimelineProfileResizer from "../views/elements/IRCTimelineProfileResizer";

const CONTINUATION_MAX_INTERVAL = 5 * 60 * 1000; // 5 minutes
const continuedTypes = ['m.sticker', 'm.room.message'];

const isMembershipChange = (e) => e.getType() === 'm.room.member' || e.getType() === 'm.room.third_party_invite';

/* (almost) stateless UI component which builds the event tiles in the room timeline.
 */
export default class MessagePanel extends React.Component {
    static propTypes = {
        // true to give the component a 'display: none' style.
        hidden: PropTypes.bool,

        // true to show a spinner at the top of the timeline to indicate
        // back-pagination in progress
        backPaginating: PropTypes.bool,

        // true to show a spinner at the end of the timeline to indicate
        // forward-pagination in progress
        forwardPaginating: PropTypes.bool,

        // the list of MatrixEvents to display
        events: PropTypes.array.isRequired,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        highlightedEventId: PropTypes.string,

        // The room these events are all in together, if any.
        // (The notification panel won't have a room here, for example.)
        room: PropTypes.object,

        // Should we show URL Previews
        showUrlPreview: PropTypes.bool,

        // event after which we should show a read marker
        readMarkerEventId: PropTypes.string,

        // whether the read marker should be visible
        readMarkerVisible: PropTypes.bool,

        // the userid of our user. This is used to suppress the read marker
        // for pending messages.
        ourUserId: PropTypes.string,

        // true to suppress the date at the start of the timeline
        suppressFirstDateSeparator: PropTypes.bool,

        // whether to show read receipts
        showReadReceipts: PropTypes.bool,

        // true if updates to the event list should cause the scroll panel to
        // scroll down when we are at the bottom of the window. See ScrollPanel
        // for more details.
        stickyBottom: PropTypes.bool,

        // callback which is called when the panel is scrolled.
        onScroll: PropTypes.func,

        // callback which is called when more content is needed.
        onFillRequest: PropTypes.func,

        // className for the panel
        className: PropTypes.string.isRequired,

        // shape parameter to be passed to EventTiles
        tileShape: PropTypes.string,

        // show twelve hour timestamps
        isTwelveHour: PropTypes.bool,

        // show timestamps always
        alwaysShowTimestamps: PropTypes.bool,

        // helper function to access relations for an event
        getRelationsForEvent: PropTypes.func,

        // whether to show reactions for an event
        showReactions: PropTypes.bool,
    };

    // Force props to be loaded for useIRCLayout
    constructor(props) {
        super(props);

        this.state = {
            // previous positions the read marker has been in, so we can
            // display 'ghost' read markers that are animating away
            ghostReadMarkers: [],
            showTypingNotifications: SettingsStore.getValue("showTypingNotifications"),
            useIRCLayout: this.useIRCLayout(SettingsStore.getValue("feature_irc_ui")),
        };

        // opaque readreceipt info for each userId; used by ReadReceiptMarker
        // to manage its animations
        this._readReceiptMap = {};

        // Track read receipts by event ID. For each _shown_ event ID, we store
        // the list of read receipts to display:
        //   [
        //       {
        //           userId: string,
        //           member: RoomMember,
        //           ts: number,
        //       },
        //   ]
        // This is recomputed on each render. It's only stored on the component
        // for ease of passing the data around since it's computed in one pass
        // over all events.
        this._readReceiptsByEvent = {};

        // Track read receipts by user ID. For each user ID we've ever shown a
        // a read receipt for, we store an object:
        //   {
        //       lastShownEventId: string,
        //       receipt: {
        //           userId: string,
        //           member: RoomMember,
        //           ts: number,
        //       },
        //   }
        // so that we can always keep receipts displayed by reverting back to
        // the last shown event for that user ID when needed. This may feel like
        // it duplicates the receipt storage in the room, but at this layer, we
        // are tracking _shown_ event IDs, which the JS SDK knows nothing about.
        // This is recomputed on each render, using the data from the previous
        // render as our fallback for any user IDs we can't match a receipt to a
        // displayed event in the current render cycle.
        this._readReceiptsByUserId = {};

        // Cache hidden events setting on mount since Settings is expensive to
        // query, and we check this in a hot code path.
        this._showHiddenEventsInTimeline =
            SettingsStore.getValue("showHiddenEventsInTimeline");

        this._isMounted = false;

        this._readMarkerNode = createRef();
        this._whoIsTyping = createRef();
        this._scrollPanel = createRef();

        this._showTypingNotificationsWatcherRef =
            SettingsStore.watchSetting("showTypingNotifications", null, this.onShowTypingNotificationsChange);

        this._layoutWatcherRef = SettingsStore.watchSetting("feature_irc_ui", null, this.onLayoutChange);
    }

    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;
        SettingsStore.unwatchSetting(this._showTypingNotificationsWatcherRef);
        SettingsStore.unwatchSetting(this._layoutWatcherRef);
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.readMarkerVisible && this.props.readMarkerEventId !== prevProps.readMarkerEventId) {
            const ghostReadMarkers = this.state.ghostReadMarkers;
            ghostReadMarkers.push(prevProps.readMarkerEventId);
            this.setState({
                ghostReadMarkers,
            });
        }
    }

    onShowTypingNotificationsChange = () => {
        this.setState({
            showTypingNotifications: SettingsStore.getValue("showTypingNotifications"),
        });
    };

    onLayoutChange = () => {
        this.setState({
            useIRCLayout: this.useIRCLayout(SettingsStore.getValue("feature_irc_ui")),
        });
    }

    useIRCLayout(ircLayoutSelected) {
        // if room is null we are not in a normal room list
        return ircLayoutSelected && this.props.room;
    }

    /* get the DOM node representing the given event */
    getNodeForEventId(eventId) {
        if (!this.eventNodes) {
            return undefined;
        }

        return this.eventNodes[eventId];
    }

    /* return true if the content is fully scrolled down right now; else false.
     */
    isAtBottom() {
        return this._scrollPanel.current && this._scrollPanel.current.isAtBottom();
    }

    /* get the current scroll state. See ScrollPanel.getScrollState for
     * details.
     *
     * returns null if we are not mounted.
     */
    getScrollState() {
        return this._scrollPanel.current ? this._scrollPanel.current.getScrollState() : null;
    }

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is within the window
    //  +1: read marker is below the window
    getReadMarkerPosition() {
        const readMarker = this._readMarkerNode.current;
        const messageWrapper = this._scrollPanel.current;

        if (!readMarker || !messageWrapper) {
            return null;
        }

        const wrapperRect = ReactDOM.findDOMNode(messageWrapper).getBoundingClientRect();
        const readMarkerRect = readMarker.getBoundingClientRect();

        // the read-marker pretends to have zero height when it is actually
        // two pixels high; +2 here to account for that.
        if (readMarkerRect.bottom + 2 < wrapperRect.top) {
            return -1;
        } else if (readMarkerRect.top < wrapperRect.bottom) {
            return 0;
        } else {
            return 1;
        }
    }

    /* jump to the top of the content.
     */
    scrollToTop() {
        if (this._scrollPanel.current) {
            this._scrollPanel.current.scrollToTop();
        }
    }

    /* jump to the bottom of the content.
     */
    scrollToBottom() {
        if (this._scrollPanel.current) {
            this._scrollPanel.current.scrollToBottom();
        }
    }

    /**
     * Page up/down.
     *
     * @param {number} mult: -1 to page up, +1 to page down
     */
    scrollRelative(mult) {
        if (this._scrollPanel.current) {
            this._scrollPanel.current.scrollRelative(mult);
        }
    }

    /**
     * Scroll up/down in response to a scroll key
     *
     * @param {KeyboardEvent} ev: the keyboard event to handle
     */
    handleScrollKey(ev) {
        if (this._scrollPanel.current) {
            this._scrollPanel.current.handleScrollKey(ev);
        }
    }

    /* jump to the given event id.
     *
     * offsetBase gives the reference point for the pixelOffset. 0 means the
     * top of the container, 1 means the bottom, and fractional values mean
     * somewhere in the middle. If omitted, it defaults to 0.
     *
     * pixelOffset gives the number of pixels *above* the offsetBase that the
     * node (specifically, the bottom of it) will be positioned. If omitted, it
     * defaults to 0.
     */
    scrollToEvent(eventId, pixelOffset, offsetBase) {
        if (this._scrollPanel.current) {
            this._scrollPanel.current.scrollToToken(eventId, pixelOffset, offsetBase);
        }
    }

    scrollToEventIfNeeded(eventId) {
        const node = this.eventNodes[eventId];
        if (node) {
            node.scrollIntoView({block: "nearest", behavior: "instant"});
        }
    }

    /* check the scroll state and send out pagination requests if necessary.
     */
    checkFillState() {
        if (this._scrollPanel.current) {
            this._scrollPanel.current.checkFillState();
        }
    }

    _isUnmounting() {
        return !this._isMounted;
    }

    // TODO: Implement granular (per-room) hide options
    _shouldShowEvent(mxEv) {
        if (mxEv.sender && MatrixClientPeg.get().isUserIgnored(mxEv.sender.userId)) {
            return false; // ignored = no show (only happens if the ignore happens after an event was received)
        }

        if (this._showHiddenEventsInTimeline) {
            return true;
        }

        if (!haveTileForEvent(mxEv)) {
            return false; // no tile = no show
        }

        // Always show highlighted event
        if (this.props.highlightedEventId === mxEv.getId()) return true;

        return !shouldHideEvent(mxEv);
    }

    _readMarkerForEvent(eventId, isLastEvent) {
        const visible = !isLastEvent && this.props.readMarkerVisible;

        if (this.props.readMarkerEventId === eventId) {
            let hr;
            // if the read marker comes at the end of the timeline (except
            // for local echoes, which are excluded from RMs, because they
            // don't have useful event ids), we don't want to show it, but
            // we still want to create the <li/> for it so that the
            // algorithms which depend on its position on the screen aren't
            // confused.
            if (visible) {
                hr = <hr className="mx_RoomView_myReadMarker"
                    style={{opacity: 1, width: '99%'}}
                />;
            }

            return (
                <li key={"readMarker_"+eventId} ref={this._readMarkerNode}
                      className="mx_RoomView_myReadMarker_container">
                    { hr }
                </li>
            );
        } else if (this.state.ghostReadMarkers.includes(eventId)) {
            // We render 'ghost' read markers in the DOM while they
            // transition away. This allows the actual read marker
            // to be in the right place straight away without having
            // to wait for the transition to finish.
            // There are probably much simpler ways to do this transition,
            // possibly using react-transition-group which handles keeping
            // elements in the DOM whilst they transition out, although our
            // case is a little more complex because only some of the items
            // transition (ie. the read markers do but the event tiles do not)
            // and TransitionGroup requires that all its children are Transitions.
            const hr = <hr className="mx_RoomView_myReadMarker"
                ref={this._collectGhostReadMarker}
                onTransitionEnd={this._onGhostTransitionEnd}
                data-eventid={eventId}
            />;

            // give it a key which depends on the event id. That will ensure that
            // we get a new DOM node (restarting the animation) when the ghost
            // moves to a different event.
            return (
                <li key={"_readuptoghost_"+eventId}
                      className="mx_RoomView_myReadMarker_container">
                    { hr }
                </li>
            );
        }

        return null;
    }

    _collectGhostReadMarker = (node) => {
        if (node) {
            // now the element has appeared, change the style which will trigger the CSS transition
            requestAnimationFrame(() => {
                node.style.width = '10%';
                node.style.opacity = '0';
            });
        }
    };

    _onGhostTransitionEnd = (ev) => {
        // we can now clean up the ghost element
        const finishedEventId = ev.target.dataset.eventid;
        this.setState({
            ghostReadMarkers: this.state.ghostReadMarkers.filter(eid => eid !== finishedEventId),
        });
    };

    _getEventTiles() {
        this.eventNodes = {};

        let i;

        // first figure out which is the last event in the list which we're
        // actually going to show; this allows us to behave slightly
        // differently for the last event in the list. (eg show timestamp)
        //
        // we also need to figure out which is the last event we show which isn't
        // a local echo, to manage the read-marker.
        let lastShownEvent;

        let lastShownNonLocalEchoIndex = -1;
        for (i = this.props.events.length-1; i >= 0; i--) {
            const mxEv = this.props.events[i];
            if (!this._shouldShowEvent(mxEv)) {
                continue;
            }

            if (lastShownEvent === undefined) {
                lastShownEvent = mxEv;
            }

            if (mxEv.status) {
                // this is a local echo
                continue;
            }

            lastShownNonLocalEchoIndex = i;
            break;
        }

        const ret = [];

        let prevEvent = null; // the last event we showed

        this._readReceiptsByEvent = {};
        if (this.props.showReadReceipts) {
            this._readReceiptsByEvent = this._getReadReceiptsByShownEvent();
        }

        let grouper = null;

        for (i = 0; i < this.props.events.length; i++) {
            const mxEv = this.props.events[i];
            const eventId = mxEv.getId();
            const last = (mxEv === lastShownEvent);

            if (grouper) {
                if (grouper.shouldGroup(mxEv)) {
                    grouper.add(mxEv);
                    continue;
                } else {
                    // not part of group, so get the group tiles, close the
                    // group, and continue like a normal event
                    ret.push(...grouper.getTiles());
                    prevEvent = grouper.getNewPrevEvent();
                    grouper = null;
                }
            }

            for (const Grouper of groupers) {
                if (Grouper.canStartGroup(this, mxEv)) {
                    grouper = new Grouper(this, mxEv, prevEvent, lastShownEvent);
                }
            }
            if (!grouper) {
                const wantTile = this._shouldShowEvent(mxEv);
                if (wantTile) {
                    // make sure we unpack the array returned by _getTilesForEvent,
                    // otherwise react will auto-generate keys and we will end up
                    // replacing all of the DOM elements every time we paginate.
                    ret.push(...this._getTilesForEvent(prevEvent, mxEv, last));
                    prevEvent = mxEv;
                }

                const readMarker = this._readMarkerForEvent(eventId, i >= lastShownNonLocalEchoIndex);
                if (readMarker) ret.push(readMarker);
            }
        }

        if (grouper) {
            ret.push(...grouper.getTiles());
        }

        return ret;
    }

    _getTilesForEvent(prevEvent, mxEv, last) {
        const TileErrorBoundary = sdk.getComponent('messages.TileErrorBoundary');
        const EventTile = sdk.getComponent('rooms.EventTile');
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const ret = [];

        const isEditing = this.props.editState &&
            this.props.editState.getEvent().getId() === mxEv.getId();
        // is this a continuation of the previous message?
        let continuation = false;

        // Some events should appear as continuations from previous events of
        // different types.

        const eventTypeContinues =
            prevEvent !== null &&
            continuedTypes.includes(mxEv.getType()) &&
            continuedTypes.includes(prevEvent.getType());

        // if there is a previous event and it has the same sender as this event
        // and the types are the same/is in continuedTypes and the time between them is <= CONTINUATION_MAX_INTERVAL
        if (prevEvent !== null && prevEvent.sender && mxEv.sender && mxEv.sender.userId === prevEvent.sender.userId &&
            // if we don't have tile for previous event then it was shown by showHiddenEvents and has no SenderProfile
            haveTileForEvent(prevEvent) && (mxEv.getType() === prevEvent.getType() || eventTypeContinues) &&
            (mxEv.getTs() - prevEvent.getTs() <= CONTINUATION_MAX_INTERVAL)) {
            continuation = true;
        }

/*
        // Work out if this is still a continuation, as we are now showing commands
        // and /me messages with their own little avatar. The case of a change of
        // event type (commands) is handled above, but we need to handle the /me
        // messages seperately as they have a msgtype of 'm.emote' but are classed
        // as normal messages
        if (prevEvent !== null && prevEvent.sender && mxEv.sender
                && mxEv.sender.userId === prevEvent.sender.userId
                && mxEv.getType() == prevEvent.getType()
                && prevEvent.getContent().msgtype === 'm.emote') {
            continuation = false;
        }
*/

        // local echoes have a fake date, which could even be yesterday. Treat them
        // as 'today' for the date separators.
        let ts1 = mxEv.getTs();
        let eventDate = mxEv.getDate();
        if (mxEv.status) {
            eventDate = new Date();
            ts1 = eventDate.getTime();
        }

        // do we need a date separator since the last event?
        if (this._wantsDateSeparator(prevEvent, eventDate)) {
            const dateSeparator = <li key={ts1}><DateSeparator key={ts1} ts={ts1} /></li>;
            ret.push(dateSeparator);
            continuation = false;
        }

        const eventId = mxEv.getId();
        const highlight = (eventId === this.props.highlightedEventId);

        // we can't use local echoes as scroll tokens, because their event IDs change.
        // Local echos have a send "status".
        const scrollToken = mxEv.status ? undefined : eventId;

        const readReceipts = this._readReceiptsByEvent[eventId];

        // Dev note: `this._isUnmounting.bind(this)` is important - it ensures that
        // the function is run in the context of this class and not EventTile, therefore
        // ensuring the right `this._mounted` variable is used by read receipts (which
        // don't update their position if we, the MessagePanel, is unmounting).
        ret.push(
            <li key={eventId}
                ref={this._collectEventNode.bind(this, eventId)}
                data-scroll-tokens={scrollToken}
            >
                <TileErrorBoundary mxEvent={mxEv}>
                    <EventTile mxEvent={mxEv}
                        continuation={continuation}
                        isRedacted={mxEv.isRedacted()}
                        replacingEventId={mxEv.replacingEventId()}
                        editState={isEditing && this.props.editState}
                        onHeightChanged={this._onHeightChanged}
                        readReceipts={readReceipts}
                        readReceiptMap={this._readReceiptMap}
                        showUrlPreview={this.props.showUrlPreview}
                        checkUnmounting={this._isUnmounting.bind(this)}
                        eventSendStatus={mxEv.getAssociatedStatus()}
                        tileShape={this.props.tileShape}
                        isTwelveHour={this.props.isTwelveHour}
                        permalinkCreator={this.props.permalinkCreator}
                        last={last}
                        isSelectedEvent={highlight}
                        getRelationsForEvent={this.props.getRelationsForEvent}
                        showReactions={this.props.showReactions}
                        useIRCLayout={this.state.useIRCLayout}
                    />
                </TileErrorBoundary>
            </li>,
        );

        return ret;
    }

    _wantsDateSeparator(prevEvent, nextEventDate) {
        if (prevEvent == null) {
            // first event in the panel: depends if we could back-paginate from
            // here.
            return !this.props.suppressFirstDateSeparator;
        }
        return wantsDateSeparator(prevEvent.getDate(), nextEventDate);
    }

    // Get a list of read receipts that should be shown next to this event
    // Receipts are objects which have a 'userId', 'roomMember' and 'ts'.
    _getReadReceiptsForEvent(event) {
        const myUserId = MatrixClientPeg.get().credentials.userId;

        // get list of read receipts, sorted most recent first
        const { room } = this.props;
        if (!room) {
            return null;
        }
        const receipts = [];
        room.getReceiptsForEvent(event).forEach((r) => {
            if (!r.userId || r.type !== "m.read" || r.userId === myUserId) {
                return; // ignore non-read receipts and receipts from self.
            }
            if (MatrixClientPeg.get().isUserIgnored(r.userId)) {
                return; // ignore ignored users
            }
            const member = room.getMember(r.userId);
            receipts.push({
                userId: r.userId,
                roomMember: member,
                ts: r.data ? r.data.ts : 0,
            });
        });
        return receipts;
    }

    // Get an object that maps from event ID to a list of read receipts that
    // should be shown next to that event. If a hidden event has read receipts,
    // they are folded into the receipts of the last shown event.
    _getReadReceiptsByShownEvent() {
        const receiptsByEvent = {};
        const receiptsByUserId = {};

        let lastShownEventId;
        for (const event of this.props.events) {
            if (this._shouldShowEvent(event)) {
                lastShownEventId = event.getId();
            }
            if (!lastShownEventId) {
                continue;
            }

            const existingReceipts = receiptsByEvent[lastShownEventId] || [];
            const newReceipts = this._getReadReceiptsForEvent(event);
            receiptsByEvent[lastShownEventId] = existingReceipts.concat(newReceipts);

            // Record these receipts along with their last shown event ID for
            // each associated user ID.
            for (const receipt of newReceipts) {
                receiptsByUserId[receipt.userId] = {
                    lastShownEventId,
                    receipt,
                };
            }
        }

        // It's possible in some cases (for example, when a read receipt
        // advances before we have paginated in the new event that it's marking
        // received) that we can temporarily not have a matching event for
        // someone which had one in the last. By looking through our previous
        // mapping of receipts by user ID, we can cover recover any receipts
        // that would have been lost by using the same event ID from last time.
        for (const userId in this._readReceiptsByUserId) {
            if (receiptsByUserId[userId]) {
                continue;
            }
            const { lastShownEventId, receipt } = this._readReceiptsByUserId[userId];
            const existingReceipts = receiptsByEvent[lastShownEventId] || [];
            receiptsByEvent[lastShownEventId] = existingReceipts.concat(receipt);
            receiptsByUserId[userId] = { lastShownEventId, receipt };
        }
        this._readReceiptsByUserId = receiptsByUserId;

        // After grouping receipts by shown events, do another pass to sort each
        // receipt list.
        for (const eventId in receiptsByEvent) {
            receiptsByEvent[eventId].sort((r1, r2) => {
                return r2.ts - r1.ts;
            });
        }

        return receiptsByEvent;
    }

    _collectEventNode = (eventId, node) => {
        this.eventNodes[eventId] = node;
    }

    // once dynamic content in the events load, make the scrollPanel check the
    // scroll offsets.
    _onHeightChanged = () => {
        const scrollPanel = this._scrollPanel.current;
        if (scrollPanel) {
            scrollPanel.checkScroll();
        }
    };

    _onTypingShown = () => {
        const scrollPanel = this._scrollPanel.current;
        // this will make the timeline grow, so checkScroll
        scrollPanel.checkScroll();
        if (scrollPanel && scrollPanel.getScrollState().stuckAtBottom) {
            scrollPanel.preventShrinking();
        }
    };

    _onTypingHidden = () => {
        const scrollPanel = this._scrollPanel.current;
        if (scrollPanel) {
            // as hiding the typing notifications doesn't
            // update the scrollPanel, we tell it to apply
            // the shrinking prevention once the typing notifs are hidden
            scrollPanel.updatePreventShrinking();
            // order is important here as checkScroll will scroll down to
            // reveal added padding to balance the notifs disappearing.
            scrollPanel.checkScroll();
        }
    };

    updateTimelineMinHeight() {
        const scrollPanel = this._scrollPanel.current;

        if (scrollPanel) {
            const isAtBottom = scrollPanel.isAtBottom();
            const whoIsTyping = this._whoIsTyping.current;
            const isTypingVisible = whoIsTyping && whoIsTyping.isVisible();
            // when messages get added to the timeline,
            // but somebody else is still typing,
            // update the min-height, so once the last
            // person stops typing, no jumping occurs
            if (isAtBottom && isTypingVisible) {
                scrollPanel.preventShrinking();
            }
        }
    }

    onTimelineReset() {
        const scrollPanel = this._scrollPanel.current;
        if (scrollPanel) {
            scrollPanel.clearPreventShrinking();
        }
    }

    render() {
        const ErrorBoundary = sdk.getComponent('elements.ErrorBoundary');
        const ScrollPanel = sdk.getComponent("structures.ScrollPanel");
        const WhoIsTypingTile = sdk.getComponent("rooms.WhoIsTypingTile");
        const Spinner = sdk.getComponent("elements.Spinner");
        let topSpinner;
        let bottomSpinner;
        if (this.props.backPaginating) {
            topSpinner = <li key="_topSpinner"><Spinner /></li>;
        }
        if (this.props.forwardPaginating) {
            bottomSpinner = <li key="_bottomSpinner"><Spinner /></li>;
        }

        const style = this.props.hidden ? { display: 'none' } : {};

        const className = classNames(
            this.props.className,
            {
                "mx_MessagePanel_alwaysShowTimestamps": this.props.alwaysShowTimestamps,
                "mx_IRCLayout": this.state.useIRCLayout,
                "mx_GroupLayout": !this.state.useIRCLayout,
            },
        );

        let whoIsTyping;
        if (this.props.room && !this.props.tileShape && this.state.showTypingNotifications) {
            whoIsTyping = (<WhoIsTypingTile
                room={this.props.room}
                onShown={this._onTypingShown}
                onHidden={this._onTypingHidden}
                ref={this._whoIsTyping} />
            );
        }

        let ircResizer = null;
        if (this.state.useIRCLayout) {
            ircResizer = <IRCTimelineProfileResizer
                minWidth={20}
                maxWidth={600}
                roomId={this.props.room ? this.props.roomroomId : null}
            />;
        }

        return (
            <ErrorBoundary>
                <ScrollPanel
                    ref={this._scrollPanel}
                    className={className}
                    onScroll={this.props.onScroll}
                    onResize={this.onResize}
                    onFillRequest={this.props.onFillRequest}
                    onUnfillRequest={this.props.onUnfillRequest}
                    style={style}
                    stickyBottom={this.props.stickyBottom}
                    resizeNotifier={this.props.resizeNotifier}
                    fixedChildren={ircResizer}
                >
                    { topSpinner }
                    { this._getEventTiles() }
                    { whoIsTyping }
                    { bottomSpinner }
                </ScrollPanel>
            </ErrorBoundary>
        );
    }
}

/* Grouper classes determine when events can be grouped together in a summary.
 * Groupers should have the following methods:
 * - canStartGroup (static): determines if a new group should be started with the
 *   given event
 * - shouldGroup: determines if the given event should be added to an existing group
 * - add: adds an event to an existing group (should only be called if shouldGroup
 *   return true)
 * - getTiles: returns the tiles that represent the group
 * - getNewPrevEvent: returns the event that should be used as the new prevEvent
 *   when determining things such as whether a date separator is necessary
 */

// Wrap initial room creation events into an EventListSummary
// Grouping only events sent by the same user that sent the `m.room.create` and only until
// the first non-state event or membership event which is not regarding the sender of the `m.room.create` event
class CreationGrouper {
    static canStartGroup = function(panel, ev) {
        return ev.getType() === "m.room.create";
    };

    constructor(panel, createEvent, prevEvent, lastShownEvent) {
        this.panel = panel;
        this.createEvent = createEvent;
        this.prevEvent = prevEvent;
        this.lastShownEvent = lastShownEvent;
        this.events = [];
        // events that we include in the group but then eject out and place
        // above the group.
        this.ejectedEvents = [];
        this.readMarker = panel._readMarkerForEvent(
            createEvent.getId(),
            createEvent === lastShownEvent,
        );
    }

    shouldGroup(ev) {
        const panel = this.panel;
        const createEvent = this.createEvent;
        if (!panel._shouldShowEvent(ev)) {
            return true;
        }
        if (panel._wantsDateSeparator(this.createEvent, ev.getDate())) {
            return false;
        }
        if (ev.getType() === "m.room.member"
            && (ev.getStateKey() !== createEvent.getSender() || ev.getContent()["membership"] !== "join")) {
            return false;
        }
        if (ev.isState() && ev.getSender() === createEvent.getSender()) {
            return true;
        }
        return false;
    }

    add(ev) {
        const panel = this.panel;
        this.readMarker = this.readMarker || panel._readMarkerForEvent(
            ev.getId(),
            ev === this.lastShownEvent,
        );
        if (!panel._shouldShowEvent(ev)) {
            return;
        }
        if (ev.getType() === "m.room.encryption") {
            this.ejectedEvents.push(ev);
        } else {
            this.events.push(ev);
        }
    }

    getTiles() {
        // If we don't have any events to group, don't even try to group them. The logic
        // below assumes that we have a group of events to deal with, but we might not if
        // the events we were supposed to group were redacted.
        if (!this.events || !this.events.length) return [];

        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const EventListSummary = sdk.getComponent('views.elements.EventListSummary');

        const panel = this.panel;
        const ret = [];
        const createEvent = this.createEvent;
        const lastShownEvent = this.lastShownEvent;

        if (panel._wantsDateSeparator(this.prevEvent, createEvent.getDate())) {
            const ts = createEvent.getTs();
            ret.push(
                <li key={ts+'~'}><DateSeparator key={ts+'~'} ts={ts} /></li>,
            );
        }

        // If this m.room.create event should be shown (room upgrade) then show it before the summary
        if (panel._shouldShowEvent(createEvent)) {
            // pass in the createEvent as prevEvent as well so no extra DateSeparator is rendered
            ret.push(...panel._getTilesForEvent(createEvent, createEvent, false));
        }

        for (const ejected of this.ejectedEvents) {
            ret.push(...panel._getTilesForEvent(
                createEvent, ejected, createEvent === lastShownEvent,
            ));
        }

        const eventTiles = this.events.map((e) => {
            // In order to prevent DateSeparators from appearing in the expanded form
            // of EventListSummary, render each member event as if the previous
            // one was itself. This way, the timestamp of the previous event === the
            // timestamp of the current event, and no DateSeparator is inserted.
            return panel._getTilesForEvent(e, e, e === lastShownEvent);
        }).reduce((a, b) => a.concat(b), []);
        // Get sender profile from the latest event in the summary as the m.room.create doesn't contain one
        const ev = this.events[this.events.length - 1];
        ret.push(
            <EventListSummary
                 key="roomcreationsummary"
                 events={this.events}
                 onToggle={panel._onHeightChanged} // Update scroll state
                 summaryMembers={[ev.sender]}
                 summaryText={_t("%(creator)s created and configured the room.", {
                     creator: ev.sender ? ev.sender.name : ev.getSender(),
                 })}
            >
                 { eventTiles }
            </EventListSummary>,
        );

        if (this.readMarker) {
            ret.push(this.readMarker);
        }

        return ret;
    }

    getNewPrevEvent() {
        return this.createEvent;
    }
}

// Wrap consecutive member events in a ListSummary, ignore if redacted
class MemberGrouper {
    static canStartGroup = function(panel, ev) {
        return panel._shouldShowEvent(ev) && isMembershipChange(ev);
    }

    constructor(panel, ev, prevEvent, lastShownEvent) {
        this.panel = panel;
        this.readMarker = panel._readMarkerForEvent(
            ev.getId(),
            ev === lastShownEvent,
        );
        this.events = [ev];
        this.prevEvent = prevEvent;
        this.lastShownEvent = lastShownEvent;
    }

    shouldGroup(ev) {
        if (this.panel._wantsDateSeparator(this.events[0], ev.getDate())) {
            return false;
        }
        return isMembershipChange(ev);
    }

    add(ev) {
        if (ev.getType() === 'm.room.member') {
            // We'll just double check that it's worth our time to do so, through an
            // ugly hack. If textForEvent returns something, we should group it for
            // rendering but if it doesn't then we'll exclude it.
            const renderText = textForEvent(ev);
            if (!renderText || renderText.trim().length === 0) return; // quietly ignore
        }
        this.readMarker = this.readMarker || this.panel._readMarkerForEvent(
            ev.getId(),
            ev === this.lastShownEvent,
        );
        this.events.push(ev);
    }

    getTiles() {
        // If we don't have any events to group, don't even try to group them. The logic
        // below assumes that we have a group of events to deal with, but we might not if
        // the events we were supposed to group were redacted.
        if (!this.events || !this.events.length) return [];

        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const MemberEventListSummary = sdk.getComponent('views.elements.MemberEventListSummary');

        const panel = this.panel;
        const lastShownEvent = this.lastShownEvent;
        const ret = [];

        if (panel._wantsDateSeparator(this.prevEvent, this.events[0].getDate())) {
            const ts = this.events[0].getTs();
            ret.push(
                <li key={ts+'~'}><DateSeparator key={ts+'~'} ts={ts} /></li>,
            );
        }

        // Ensure that the key of the MemberEventListSummary does not change with new
        // member events. This will prevent it from being re-created unnecessarily, and
        // instead will allow new props to be provided. In turn, the shouldComponentUpdate
        // method on MELS can be used to prevent unnecessary renderings.
        //
        // Whilst back-paginating with a MELS at the top of the panel, prevEvent will be null,
        // so use the key "membereventlistsummary-initial". Otherwise, use the ID of the first
        // membership event, which will not change during forward pagination.
        const key = "membereventlistsummary-" + (
            this.prevEvent ? this.events[0].getId() : "initial"
        );

        let highlightInMels;
        let eventTiles = this.events.map((e) => {
            if (e.getId() === panel.props.highlightedEventId) {
                highlightInMels = true;
            }
            // In order to prevent DateSeparators from appearing in the expanded form
            // of MemberEventListSummary, render each member event as if the previous
            // one was itself. This way, the timestamp of the previous event === the
            // timestamp of the current event, and no DateSeparator is inserted.
            return panel._getTilesForEvent(e, e, e === lastShownEvent);
        }).reduce((a, b) => a.concat(b), []);

        if (eventTiles.length === 0) {
            eventTiles = null;
        }

        ret.push(
            <MemberEventListSummary key={key}
                 events={this.events}
                 onToggle={panel._onHeightChanged} // Update scroll state
                 startExpanded={highlightInMels}
            >
                 { eventTiles }
            </MemberEventListSummary>,
        );

        if (this.readMarker) {
            ret.push(this.readMarker);
        }

        return ret;
    }

    getNewPrevEvent() {
        return this.events[0];
    }
}

// all the grouper classes that we use
const groupers = [CreationGrouper, MemberGrouper];
