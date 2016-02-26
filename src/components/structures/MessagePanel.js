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
var sdk = require('../../index');

/* (almost) stateless UI component which builds the event tiles in the room timeline.
 */
module.exports = React.createClass({
    displayName: 'MessagePanel',

    propTypes: {
        // true to give the component a 'display: none' style.
        hidden: React.PropTypes.bool,

        // true to show a spinner at the top of the timeline to indicate
        // back-pagination in progress
        backPaginating: React.PropTypes.bool,

        // true to show a spinner at the end of the timeline to indicate
        // forward-pagination in progress
        forwardPaginating: React.PropTypes.bool,

        // the list of MatrixEvents to display
        events: React.PropTypes.array.isRequired,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        highlightedEventId: React.PropTypes.string,

        // event after which we should show a read marker
        readMarkerEventId: React.PropTypes.string,

        // whether the read marker should be visible
        readMarkerVisible: React.PropTypes.bool,

        // the userid of our user. This is used to suppress the read marker
        // for pending messages.
        ourUserId: React.PropTypes.string,

        // true to suppress the date at the start of the timeline
        suppressFirstDateSeparator: React.PropTypes.bool,

        // true if updates to the event list should cause the scroll panel to
        // scroll down when we are at the bottom of the window. See ScrollPanel
        // for more details.
        stickyBottom: React.PropTypes.bool,

        // callback which is called when the panel is scrolled.
        onScroll: React.PropTypes.func,

        // callback which is called when more content is needed.
        onFillRequest: React.PropTypes.func,
    },

    componentWillMount: function() {
        // the event after which we put a visible unread marker on the last
        // render cycle; null if readMarkerVisible was false or the RM was
        // suppressed (eg because it was at the end of the timeline)
        this.currentReadMarkerEventId = null;

        // the event after which we are showing a disappearing read marker
        // animation
        this.currentGhostEventId = null;
    },

    /* get the DOM node representing the given event */
    getNodeForEventId: function(eventId) {
        if (!this.eventNodes) {
            return undefined;
        }

        return this.eventNodes[eventId];
    },

    /* return true if the content is fully scrolled down right now; else false.
     */
    isAtBottom: function() {
        return this.refs.scrollPanel
            && this.refs.scrollPanel.isAtBottom();
    },

    /* get the current scroll state. See ScrollPanel.getScrollState for
     * details.
     *
     * returns null if we are not mounted.
     */
    getScrollState: function() {
        if (!this.refs.scrollPanel) { return null; }
        return this.refs.scrollPanel.getScrollState();
    },

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is within the window
    //  +1: read marker is below the window
    getReadMarkerPosition: function() {
        var readMarker = this.refs.readMarkerNode;
        var messageWrapper = this.refs.scrollPanel;

        if (!readMarker || !messageWrapper) {
            return null;
        }

        var wrapperRect = ReactDOM.findDOMNode(messageWrapper).getBoundingClientRect();
        var readMarkerRect = readMarker.getBoundingClientRect();

        // the read-marker pretends to have zero height when it is actually
        // two pixels high; +2 here to account for that.
        if (readMarkerRect.bottom + 2 < wrapperRect.top) {
            return -1;
        } else if (readMarkerRect.top < wrapperRect.bottom) {
            return 0;
        } else {
            return 1;
        }
    },

    /* jump to the bottom of the content.
     */
    scrollToBottom: function() {
        if (this.refs.scrollPanel) {
            this.refs.scrollPanel.scrollToBottom();
        }
    },

    /* jump to the given event id.
     *
     * pixelOffset gives the number of pixels between the bottom of the node
     * and the bottom of the container. If undefined, it will put the node
     * 1/3 of the way down of the container.
     */
    scrollToEvent: function(eventId, pixelOffset) {
        if (this.refs.scrollPanel) {
            this.refs.scrollPanel.scrollToToken(eventId, pixelOffset);
        }
    },

    /* check the scroll state and send out pagination requests if necessary.
     */
    checkFillState: function() {
        if (this.refs.scrollPanel) {
            this.refs.scrollPanel.checkFillState();
        }
    },

    _getEventTiles: function() {
        var EventTile = sdk.getComponent('rooms.EventTile');

        this.eventNodes = {};

        var i;

        // first figure out which is the last event in the list which we're
        // actually going to show; this allows us to behave slightly
        // differently for the last event in the list.
        for (i = this.props.events.length-1; i >= 0; i--) {
            var mxEv = this.props.events[i];
            if (!EventTile.haveTileForEvent(mxEv)) {
                continue;
            }

            break;
        }
        var lastShownEventIndex = i;

        var ret = [];

        var prevEvent = null; // the last event we showed

        // assume there is no read marker until proven otherwise
        var readMarkerVisible = false;

        for (i = 0; i < this.props.events.length; i++) {
            var mxEv = this.props.events[i];
            var wantTile = true;
            var eventId = mxEv.getId();

            if (!EventTile.haveTileForEvent(mxEv)) {
                wantTile = false;
            }

            var last = (i == lastShownEventIndex);

            if (wantTile) {
                ret.push(this._getTilesForEvent(prevEvent, mxEv, last));
                prevEvent = mxEv;
            } else if (!mxEv.status) {
                // if we aren't showing the event, put in a dummy scroll token anyway, so
                // that we can scroll to the right place.
                ret.push(<li key={eventId} data-scroll-token={eventId}/>);
            }

            if (eventId == this.props.readMarkerEventId) {
                var visible = this.props.readMarkerVisible;

                // if the read marker comes at the end of the timeline, we don't want
                // to show it, but we still want to create the <li/> for it so that the
                // algorithms which depend on its position on the screen aren't confused.
                if (i >= lastShownEventIndex) {
                    visible = false;
                }
                ret.push(this._getReadMarkerTile(visible));
                readMarkerVisible = visible;
            } else if (eventId == this.currentReadMarkerEventId && !this.currentGhostEventId) {
                // there is currently a read-up-to marker at this point, but no
                // more. Show an animation of it disappearing.
                ret.push(this._getReadMarkerGhostTile());
                this.currentGhostEventId = eventId;
            } else if (eventId == this.currentGhostEventId) {
                // if we're showing an animation, continue to show it.
                ret.push(this._getReadMarkerGhostTile());
            }
        }

        this.currentReadMarkerEventId = readMarkerVisible ? this.props.readMarkerEventId : null;
        return ret;
    },

    _getTilesForEvent: function(prevEvent, mxEv, last) {
        var EventTile = sdk.getComponent('rooms.EventTile');
        var DateSeparator = sdk.getComponent('messages.DateSeparator');
        var ret = [];

        // is this a continuation of the previous message?
        var continuation = false;
        if (prevEvent !== null && prevEvent.sender && mxEv.sender
                && mxEv.sender.userId === prevEvent.sender.userId
                && mxEv.getType() == prevEvent.getType()) {
            continuation = true;
        }

        // do we need a date separator since the last event?
        var ts1 = mxEv.getTs();
        if ((prevEvent == null && !this.props.suppressFirstDateSeparator) ||
                (prevEvent != null &&
                     new Date(prevEvent.getTs()).toDateString()
                          !== new Date(ts1).toDateString())) {
            var dateSeparator = <li key={ts1}><DateSeparator key={ts1} ts={ts1}/></li>;
            ret.push(dateSeparator);
            continuation = false;
        }

        var eventId = mxEv.getId();
        var highlight = (eventId == this.props.highlightedEventId);

        // we can't use local echoes as scroll tokens, because their event IDs change.
        // Local echos have a send "status".
        var scrollToken = mxEv.status ? undefined : eventId;

        ret.push(
                <li key={eventId}
                        ref={this._collectEventNode.bind(this, eventId)}
                        data-scroll-token={scrollToken}>
                    <EventTile mxEvent={mxEv} continuation={continuation}
                        last={last} isSelectedEvent={highlight}
                        onImageLoad={this._onImageLoad} />
                </li>
        );

        return ret;
    },

    _getReadMarkerTile: function(visible) {
        var hr;
        if (visible) {
            hr = <hr className="mx_RoomView_myReadMarker"
                    style={{opacity: 1, width: '99%'}}
                />;
        }

        return (
            <li key="_readupto" ref="readMarkerNode"
                  className="mx_RoomView_myReadMarker_container">
                {hr}
            </li>
        );
    },

    _getReadMarkerGhostTile: function() {
        // reset the ghostEventId when the animation finishes, so that
        // we can make a new one (and so that we don't run the
        // animation code every time we render)
        var completeFunc = () => {
            this.currentGhostEventId = null;
        };

        var hr = <hr className="mx_RoomView_myReadMarker"
                  style={{opacity: 1, width: '99%'}}
                  ref={function(n) {
                        Velocity(n, {opacity: '0', width: '10%'},
                                    {duration: 400, easing: 'easeInSine',
                                     delay: 1000, complete: completeFunc});
                  }}
            />;

        // give it a key which depends on the event id. That will ensure that
        // we get a new DOM node (restarting the animation) when the ghost
        // moves to a different event.
        return (
            <li key={"_readuptoghost_"+this.currentGhostEventId}
                  className="mx_RoomView_myReadMarker_container">
                {hr}
            </li>
        );
    },

    _collectEventNode: function(eventId, node) {
        this.eventNodes[eventId] = node;
    },


    // once images in the events load, make the scrollPanel check the
    // scroll offsets.
    _onImageLoad: function() {
        var scrollPanel = this.refs.messagePanel;
        if (scrollPanel) {
            scrollPanel.checkScroll();
        }
    },

    render: function() {
        var ScrollPanel = sdk.getComponent("structures.ScrollPanel");
        var Spinner = sdk.getComponent("elements.Spinner");
        var topSpinner, bottomSpinner;
        if (this.props.backPaginating) {
            topSpinner = <li key="_topSpinner"><Spinner /></li>;
        }
        if (this.props.forwardPaginating) {
            bottomSpinner = <li key="_bottomSpinner"><Spinner /></li>;
        }

        return (
            <ScrollPanel ref="scrollPanel" className="mx_RoomView_messagePanel"
                    onScroll={ this.props.onScroll } 
                    onFillRequest={ this.props.onFillRequest }
                    style={ this.props.hidden ? { display: 'none' } : {} }
                    stickyBottom={ this.props.stickyBottom }>
                {topSpinner}
                {this._getEventTiles()}
                {bottomSpinner}
            </ScrollPanel>
        );
    },
});
