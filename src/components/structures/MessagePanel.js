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
var sdk = require('../../index');

/* stateless UI component which builds the event tiles in the room timeline.
 */
module.exports = React.createClass({
    displayName: 'MessagePanel',

    propTypes: {
        // true to give the component a 'display: hidden' style.
        hidden: React.PropTypes.bool,

        // the list of MatrixEvents to display
        events: React.PropTypes.array.isRequired,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        highlightedEventId: React.PropTypes.string,

        // event after which we should show a read marker
        readMarkerEventId: React.PropTypes.string,

        // event after which we should show an animating disappearance of a
        // read marker
        readMarkerGhostEventId: React.PropTypes.string,

        // the userid of our user. This is used to suppress the read marker
        // for pending messages.
        ourUserId: React.PropTypes.string,

        // true to suppress the date at the start of the timeline
        suppressFirstDateSeparator: React.PropTypes.bool,

        // true if updates to the event list should cause the scroll panel to
        // scroll down when we are at the bottom of the window. See ScrollPanel
        // for more details.
        stickyBottom: React.PropTypes.bool,

        // callback to determine if a user is the magic freeswitch conference
        // user. Takes one parameter, which is a user id. Should return true if
        // the user is the conference user.
        isConferenceUser: React.PropTypes.func,

        // callback which is called when the panel is scrolled.
        onScroll: React.PropTypes.func,

        // callback which is called when more content is needed.
        onFillRequest: React.PropTypes.func,
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
     * in the middle of the container.
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

    render: function() {
        var ScrollPanel = sdk.getComponent("structures.ScrollPanel");
        return (
            <ScrollPanel ref="scrollPanel" className="mx_RoomView_messagePanel"
                    onScroll={ this.props.onScroll } 
                    onFillRequest={ this.props.onFillRequest }
                    style={ this.props.hidden ? { display: 'none' } : {} }
                    stickyBottom={ this.props.stickyBottom }>
                {this._getEventTiles()}
            </ScrollPanel>
        );
    },

    _getEventTiles: function() {
        var DateSeparator = sdk.getComponent('messages.DateSeparator');
        var EventTile = sdk.getComponent('rooms.EventTile');

        var ret = [];

        var prevEvent = null; // the last event we showed
        var ghostIndex;
        var readMarkerIndex;
        for (var i = 0; i < this.props.events.length; i++) {
            var mxEv = this.props.events[i];

            if (!EventTile.haveTileForEvent(mxEv)) {
                continue;
            }

            if (this.props.isConferenceUser && mxEv.getType() === "m.room.member") {
                if (this.props.isConferenceUser(mxEv.getSender()) ||
                        this.props.isConferenceUser(mxEv.getStateKey())) {
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
            var mxEvSender = mxEv.sender ? mxEv.sender.userId : null;
            if (prevEvent && prevEvent.getId() == this.props.readMarkerEventId) {
                // suppress the read marker if the next event is sent by us; this
                // is a nonsensical and temporary situation caused by the delay between
                // us sending a message and receiving the synthesized receipt.
                if (mxEvSender != this.props.ourUserId) {
                    var hr;
                    hr = (
                        <hr className="mx_RoomView_myReadMarker"
                            style={{opacity: 1, width: '99%'}} 
                        />);
                    readMarkerIndex = ret.length;
                    ret.push(
                        <li key="_readupto"
                                className="mx_RoomView_myReadMarker_container">
                            {hr}
                        </li>);
                }
            }

            // is this a continuation of the previous message?
            var continuation = false;
            if (prevEvent !== null) {
                if (mxEvSender &&
                    prevEvent.sender &&
                    (mxEvSender === prevEvent.sender.userId) &&
                    (mxEv.getType() == prevEvent.getType())
                    )
                {
                    continuation = true;
                }
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

            var last = false;
            if (i == this.props.events.length - 1) {
                // XXX: we might not show a tile for the last event.
                last = true;
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
                        last={last} isSelectedEvent={highlight}/>
                </li>
            );

            // A read up to marker has died and returned as a ghost!
            // Lives in the dom as the ghost of the previous one while it fades away
            if (eventId == this.props.readMarkerGhostEventId) {
                ghostIndex = ret.length;
            }

            prevEvent = mxEv;
        }

        // splice the read marker ghost in now that we know whether the read receipt
        // is the last element or not, because we only decide as we're going along.
        if (readMarkerIndex === undefined && ghostIndex && ghostIndex <= ret.length) {
            var hr;
            hr = (<hr className="mx_RoomView_myReadMarker" 
                          style={{opacity: 1, width: '99%'}} 
                          ref={function(n) {
                              Velocity(n, {opacity: '0', width: '10%'}, 
                                       {duration: 400, easing: 'easeInSine', delay: 1000});
            }} />);
            ret.splice(ghostIndex, 0, (
                <li key="_readuptoghost" 
                        className="mx_RoomView_myReadMarker_container">
                    {hr}
                </li>
            ));
        }

        return ret;
    },

    _collectEventNode: function(eventId, node) {
        if (this.eventNodes == undefined) this.eventNodes = {};
        this.eventNodes[eventId] = node;
    },
});
