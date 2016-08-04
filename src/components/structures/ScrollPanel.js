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

var React = require("react");
var ReactDOM = require("react-dom");
var GeminiScrollbar = require('react-gemini-scrollbar');
var q = require("q");
var KeyCode = require('../../KeyCode');

var DEBUG_SCROLL = false;
// var DEBUG_SCROLL = true;

if (DEBUG_SCROLL) {
    // using bind means that we get to keep useful line numbers in the console
    var debuglog = console.log.bind(console);
} else {
    var debuglog = function () {};
}

/* This component implements an intelligent scrolling list.
 *
 * It wraps a list of <li> children; when items are added to the start or end
 * of the list, the scroll position is updated so that the user still sees the
 * same position in the list.
 *
 * It also provides a hook which allows parents to provide more list elements
 * when we get close to the start or end of the list.
 *
 * Each child element should have a 'data-scroll-token'. This token is used to
 * serialise the scroll state, and returned as the 'trackedScrollToken'
 * attribute by getScrollState().
 *
 * Some notes about the implementation:
 *
 * The saved 'scrollState' can exist in one of two states:
 *
 *   - stuckAtBottom: (the default, and restored by resetScrollState): the
 *     viewport is scrolled down as far as it can be. When the children are
 *     updated, the scroll position will be updated to ensure it is still at
 *     the bottom.
 *
 *   - fixed, in which the viewport is conceptually tied at a specific scroll
 *     offset.  We don't save the absolute scroll offset, because that would be
 *     affected by window width, zoom level, amount of scrollback, etc. Instead
 *     we save an identifier for the last fully-visible message, and the number
 *     of pixels the window was scrolled below it - which is hopefully near
 *     enough.
 *
 * The 'stickyBottom' property controls the behaviour when we reach the bottom
 * of the window (either through a user-initiated scroll, or by calling
 * scrollToBottom). If stickyBottom is enabled, the scrollState will enter
 * 'stuckAtBottom' state - ensuring that new additions cause the window to
 * scroll down further. If stickyBottom is disabled, we just save the scroll
 * offset as normal.
 */
module.exports = React.createClass({
    displayName: 'ScrollPanel',

    propTypes: {
        /* stickyBottom: if set to true, then once the user hits the bottom of
         * the list, any new children added to the list will cause the list to
         * scroll down to show the new element, rather than preserving the
         * existing view.
         */
        stickyBottom: React.PropTypes.bool,

        /* onFillRequest(backwards): a callback which is called on scroll when
         * the user nears the start (backwards = true) or end (backwards =
         * false) of the list.
         *
         * This should return a promise; no more calls will be made until the
         * promise completes.
         *
         * The promise should resolve to true if there is more data to be
         * retrieved in this direction (in which case onFillRequest may be
         * called again immediately), or false if there is no more data in this
         * directon (at this time) - which will stop the pagination cycle until
         * the user scrolls again.
         */
        onFillRequest: React.PropTypes.func,

        /* onScroll: a callback which is called whenever any scroll happens.
         */
        onScroll: React.PropTypes.func,

        /* onResize: a callback which is called whenever the Gemini scroll
         * panel is resized
         */
        onResize: React.PropTypes.func,

        /* className: classnames to add to the top-level div
         */
        className: React.PropTypes.string,

        /* style: styles to add to the top-level div
         */
        style: React.PropTypes.object,
    },

    getDefaultProps: function() {
        return {
            stickyBottom: true,
            onFillRequest: function(backwards) { return q(false); },
            onScroll: function() {},
        };
    },

    componentWillMount: function() {
        this._pendingFillRequests = {b: null, f: null};
        this.resetScrollState();
    },

    componentDidMount: function() {
        this.checkFillState();
    },

    componentDidUpdate: function() {
        // after adding event tiles, we may need to tweak the scroll (either to
        // keep at the bottom of the timeline, or to maintain the view after
        // adding events to the top).
        //
        // This will also re-check the fill state, in case the paginate was inadequate
        this.checkScroll();
    },

    componentWillUnmount: function() {
        // set a boolean to say we've been unmounted, which any pending
        // promises can use to throw away their results.
        //
        // (We could use isMounted(), but facebook have deprecated that.)
        this.unmounted = true;
    },

    onScroll: function(ev) {
        var sn = this._getScrollNode();
        debuglog("Scroll event: offset now:", sn.scrollTop,
                 "_lastSetScroll:", this._lastSetScroll);

        // Sometimes we see attempts to write to scrollTop essentially being
        // ignored. (Or rather, it is successfully written, but on the next
        // scroll event, it's been reset again).
        //
        // This was observed on Chrome 47, when scrolling using the trackpad in OS
        // X Yosemite.  Can't reproduce on El Capitan. Our theory is that this is
        // due to Chrome not being able to cope with the scroll offset being reset
        // while a two-finger drag is in progress.
        //
        // By way of a workaround, we detect this situation and just keep
        // resetting scrollTop until we see the scroll node have the right
        // value.
        if (this._lastSetScroll !== undefined && sn.scrollTop < this._lastSetScroll-200) {
            console.log("Working around vector-im/vector-web#528");
            this._restoreSavedScrollState();
            return;
        }

        // If there weren't enough children to fill the viewport, the scroll we
        // got might be different to the scroll we wanted; we don't want to
        // forget what we wanted, so don't overwrite the saved state unless
        // this appears to be a user-initiated scroll.
        if (sn.scrollTop != this._lastSetScroll) {
            this._saveScrollState();
        } else {
            debuglog("Ignoring scroll echo");

            // only ignore the echo once, otherwise we'll get confused when the
            // user scrolls away from, and back to, the autoscroll point.
            this._lastSetScroll = undefined;
        }

        this.props.onScroll(ev);

        this.checkFillState();
    },

    onResize: function() {
        this.props.onResize();
        this.checkScroll();
        this.refs.geminiPanel.forceUpdate();
    },

    // after an update to the contents of the panel, check that the scroll is
    // where it ought to be, and set off pagination requests if necessary.
    checkScroll: function() {
        this._restoreSavedScrollState();
        this.checkFillState();
    },

    // return true if the content is fully scrolled down right now; else false.
    //
    // note that this is independent of the 'stuckAtBottom' state - it is simply
    // about whether the the content is scrolled down right now, irrespective of
    // whether it will stay that way when the children update.
    isAtBottom: function() {
        var sn = this._getScrollNode();

        // there seems to be some bug with flexbox/gemini/chrome/richvdh's
        // understanding of the box model, wherein the scrollNode ends up 2
        // pixels higher than the available space, even when there are less
        // than a screenful of messages. + 3 is a fudge factor to pretend
        // that we're at the bottom when we're still a few pixels off.

        return sn.scrollHeight - Math.ceil(sn.scrollTop) <= sn.clientHeight + 3;
    },

    // check the scroll state and send out backfill requests if necessary.
    checkFillState: function() {
        if (this.unmounted) {
            return;
        }

        var sn = this._getScrollNode();

        // if there is less than a screenful of messages above or below the
        // viewport, try to get some more messages.
        //
        // scrollTop is the number of pixels between the top of the content and
        //     the top of the viewport.
        //
        // scrollHeight is the total height of the content.
        //
        // clientHeight is the height of the viewport (excluding borders,
        // margins, and scrollbars).
        //
        //
        //   .---------.          -                 -
        //   |         |          |  scrollTop      |
        // .-+---------+-.    -   -                 |
        // | |         | |    |                     |
        // | |         | |    |  clientHeight       | scrollHeight
        // | |         | |    |                     |
        // `-+---------+-'    -                     |
        //   |         |                            |
        //   |         |                            |
        //   `---------'                            -
        //

        if (sn.scrollTop < sn.clientHeight) {
            // need to back-fill
            this._maybeFill(true);
        }
        if (sn.scrollTop > sn.scrollHeight - sn.clientHeight * 2) {
            // need to forward-fill
            this._maybeFill(false);
        }
    },

    // check if there is already a pending fill request. If not, set one off.
    _maybeFill: function(backwards) {
        var dir = backwards ? 'b' : 'f';
        if (this._pendingFillRequests[dir]) {
            debuglog("ScrollPanel: Already a "+dir+" fill in progress - not starting another");
            return;
        }

        debuglog("ScrollPanel: starting "+dir+" fill");

        // onFillRequest can end up calling us recursively (via onScroll
        // events) so make sure we set this before firing off the call. That
        // does present the risk that we might not ever actually fire off the
        // fill request, so wrap it in a try/catch.
        this._pendingFillRequests[dir] = true;
        var fillPromise;
        try {
             fillPromise = this.props.onFillRequest(backwards);
        } catch (e) {
            this._pendingFillRequests[dir] = false;
            throw e;
        }

        q.finally(fillPromise, () => {
            this._pendingFillRequests[dir] = false;
        }).then((hasMoreResults) => {
            debuglog("ScrollPanel: "+dir+" fill complete; hasMoreResults:"+hasMoreResults);
            if (hasMoreResults) {
                // further pagination requests have been disabled until now, so
                // it's time to check the fill state again in case the pagination
                // was insufficient.
                this.checkFillState();
            }
        }).done();
    },

    /* get the current scroll state. This returns an object with the following
     * properties:
     *
     * boolean stuckAtBottom: true if we are tracking the bottom of the
     *   scroll. false if we are tracking a particular child.
     *
     * string trackedScrollToken: undefined if stuckAtBottom is true; if it is
     *   false, the data-scroll-token of the child which we are tracking.
     *
     * number pixelOffset: undefined if stuckAtBottom is true; if it is false,
     *   the number of pixels the bottom of the tracked child is above the
     *   bottom of the scroll panel.
     */
    getScrollState: function() {
        return this.scrollState;
    },

    /* reset the saved scroll state.
     *
     * This is useful if the list is being replaced, and you don't want to
     * preserve scroll even if new children happen to have the same scroll
     * tokens as old ones.
     *
     * This will cause the viewport to be scrolled down to the bottom on the
     * next update of the child list. This is different to scrollToBottom(),
     * which would save the current bottom-most child as the active one (so is
     * no use if no children exist yet, or if you are about to replace the
     * child list.)
     */
    resetScrollState: function() {
        this.scrollState = {stuckAtBottom: true};
    },

    /**
     * jump to the top of the content.
     */
    scrollToTop: function() {
        this._setScrollTop(0);
        this._saveScrollState();
    },

    /**
     * jump to the bottom of the content.
     */
    scrollToBottom: function() {
        // the easiest way to make sure that the scroll state is correctly
        // saved is to do the scroll, then save the updated state. (Calculating
        // it ourselves is hard, and we can't rely on an onScroll callback
        // happening, since there may be no user-visible change here).
        this._setScrollTop(Number.MAX_VALUE);
        this._saveScrollState();
    },

    /**
     * Page up/down.
     *
     * mult: -1 to page up, +1 to page down
     */
    scrollRelative: function(mult) {
        var scrollNode = this._getScrollNode();
        var delta = mult * scrollNode.clientHeight * 0.5;
        this._setScrollTop(scrollNode.scrollTop + delta);
        this._saveScrollState();
    },

    /**
     * Scroll up/down in response to a scroll key
     */
    handleScrollKey: function(ev) {
        switch (ev.keyCode) {
            case KeyCode.PAGE_UP:
                this.scrollRelative(-1);
                break;

            case KeyCode.PAGE_DOWN:
                this.scrollRelative(1);
                break;

            case KeyCode.HOME:
                if (ev.ctrlKey) {
                    this.scrollToTop();
                }
                break;

            case KeyCode.END:
                if (ev.ctrlKey) {
                    this.scrollToBottom();
                }
                break;
        }
    },

    /* Scroll the panel to bring the DOM node with the scroll token
     * `scrollToken` into view.
     *
     * offsetBase gives the reference point for the pixelOffset. 0 means the
     * top of the container, 1 means the bottom, and fractional values mean
     * somewhere in the middle. If omitted, it defaults to 0.
     *
     * pixelOffset gives the number of pixels *above* the offsetBase that the
     * node (specifically, the bottom of it) will be positioned. If omitted, it
     * defaults to 0.
     */
    scrollToToken: function(scrollToken, pixelOffset, offsetBase) {
        pixelOffset = pixelOffset || 0;
        offsetBase = offsetBase || 0;

        // convert pixelOffset so that it is based on the bottom of the
        // container.
        pixelOffset += this._getScrollNode().clientHeight * (1-offsetBase);

        // save the desired scroll state. It's important we do this here rather
        // than as a result of the scroll event, because (a) we might not *get*
        // a scroll event, and (b) it might not currently be possible to set
        // the requested scroll state (eg, because we hit the end of the
        // timeline and need to do more pagination); we want to save the
        // *desired* scroll state rather than what we end up achieving.
        this.scrollState = {
            stuckAtBottom: false,
            trackedScrollToken: scrollToken,
            pixelOffset: pixelOffset
        };

        // ... then make it so.
        this._restoreSavedScrollState();
    },

    // set the scrollTop attribute appropriately to position the given child at the
    // given offset in the window. A helper for _restoreSavedScrollState.
    _scrollToToken: function(scrollToken, pixelOffset) {
        /* find the dom node with the right scrolltoken */
        var node;
        var messages = this.refs.itemlist.children;
        for (var i = messages.length-1; i >= 0; --i) {
            var m = messages[i];
            if (!m.dataset.scrollToken) continue;
            if (m.dataset.scrollToken == scrollToken) {
                node = m;
                break;
            }
        }

        if (!node) {
            debuglog("ScrollPanel: No node with scrollToken '"+scrollToken+"'");
            return;
        }

        var scrollNode = this._getScrollNode();
        var wrapperRect = ReactDOM.findDOMNode(this).getBoundingClientRect();
        var boundingRect = node.getBoundingClientRect();
        var scrollDelta = boundingRect.bottom + pixelOffset - wrapperRect.bottom;

        debuglog("Scrolling to token '" + node.dataset.scrollToken + "'+" +
                 pixelOffset + " (delta: "+scrollDelta+")");

        if(scrollDelta != 0) {
            this._setScrollTop(scrollNode.scrollTop + scrollDelta);
        }

    },

    _saveScrollState: function() {
        if (this.props.stickyBottom && this.isAtBottom()) {
            this.scrollState = { stuckAtBottom: true };
            debuglog("Saved scroll state", this.scrollState);
            return;
        }

        var itemlist = this.refs.itemlist;
        var wrapperRect = ReactDOM.findDOMNode(this).getBoundingClientRect();
        var messages = itemlist.children;

        for (var i = messages.length-1; i >= 0; --i) {
            var node = messages[i];
            if (!node.dataset.scrollToken) continue;

            var boundingRect = node.getBoundingClientRect();
            if (boundingRect.bottom < wrapperRect.bottom) {
                this.scrollState = {
                    stuckAtBottom: false,
                    trackedScrollToken: node.dataset.scrollToken,
                    pixelOffset: wrapperRect.bottom - boundingRect.bottom,
                }
                debuglog("Saved scroll state", this.scrollState);
                return;
            }
        }

        debuglog("Unable to save scroll state: found no children in the viewport");
    },

    _restoreSavedScrollState: function() {
        var scrollState = this.scrollState;
        var scrollNode = this._getScrollNode();

        if (scrollState.stuckAtBottom) {
            this._setScrollTop(Number.MAX_VALUE);
        } else if (scrollState.trackedScrollToken) {
            this._scrollToToken(scrollState.trackedScrollToken,
                               scrollState.pixelOffset);
        }
    },

    _setScrollTop: function(scrollTop) {
        var scrollNode = this._getScrollNode();

        var prevScroll = scrollNode.scrollTop;

        // FF ignores attempts to set scrollTop to very large numbers
        scrollNode.scrollTop = Math.min(scrollTop, scrollNode.scrollHeight);

        // If this change generates a scroll event, we should not update the
        // saved scroll state on it. See the comments in onScroll.
        //
        // If we *don't* expect a scroll event, we need to leave _lastSetScroll
        // alone, otherwise we'll end up ignoring a future scroll event which is
        // nothing to do with this change.

        if (scrollNode.scrollTop != prevScroll) {
            this._lastSetScroll = scrollNode.scrollTop;
        }

        debuglog("Set scrollTop:", scrollNode.scrollTop,
                 "requested:", scrollTop,
                 "_lastSetScroll:", this._lastSetScroll);
    },

    /* get the DOM node which has the scrollTop property we care about for our
     * message panel.
     */
    _getScrollNode: function() {
        if (this.unmounted) {
            // this shouldn't happen, but when it does, turn the NPE into
            // something more meaningful.
            throw new Error("ScrollPanel._getScrollNode called when unmounted");
        }

        return this.refs.geminiPanel.scrollbar.getViewElement();
    },

    render: function() {
        // TODO: the classnames on the div and ol could do with being updated to
        // reflect the fact that we don't necessarily contain a list of messages.
        // it's not obvious why we have a separate div and ol anyway.
        return (<GeminiScrollbar autoshow={true} ref="geminiPanel"
                onScroll={this.onScroll} onResize={this.onResize}
                className={this.props.className} style={this.props.style}>
                    <div className="mx_RoomView_messageListWrapper">
                        <ol ref="itemlist" className="mx_RoomView_MessageList" aria-live="polite">
                            {this.props.children}
                        </ol>
                    </div>
                </GeminiScrollbar>
               );
    },
});
