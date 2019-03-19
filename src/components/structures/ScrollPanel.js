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

const React = require("react");
import PropTypes from 'prop-types';
import Promise from 'bluebird';
import { KeyCode } from '../../Keyboard';
import Timer from '../../utils/Timer';
import AutoHideScrollbar from "./AutoHideScrollbar";

const DEBUG_SCROLL = false;
// const DEBUG_SCROLL = true;

// The amount of extra scroll distance to allow prior to unfilling.
// See _getExcessHeight.
const UNPAGINATION_PADDING = 6000;
// The number of milliseconds to debounce calls to onUnfillRequest, to prevent
// many scroll events causing many unfilling requests.
const UNFILL_REQUEST_DEBOUNCE_MS = 200;

const PAGE_SIZE = 200;

let debuglog;
if (DEBUG_SCROLL) {
    // using bind means that we get to keep useful line numbers in the console
    debuglog = console.log.bind(console, "ScrollPanel debuglog:");
} else {
    debuglog = function() {};
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
 * Each child element should have a 'data-scroll-tokens'. This string of
 * comma-separated tokens may contain a single token or many, where many indicates
 * that the element contains elements that have scroll tokens themselves. The first
 * token in 'data-scroll-tokens' is used to serialise the scroll state, and returned
 * as the 'trackedScrollToken' attribute by getScrollState().
 *
 * IMPORTANT: INDIVIDUAL TOKENS WITHIN 'data-scroll-tokens' MUST NOT CONTAIN COMMAS.
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
        stickyBottom: PropTypes.bool,

        /* startAtBottom: if set to true, the view is assumed to start
         * scrolled to the bottom.
         * XXX: It's likley this is unecessary and can be derived from
         * stickyBottom, but I'm adding an extra parameter to ensure
         * behaviour stays the same for other uses of ScrollPanel.
         * If so, let's remove this parameter down the line.
         */
        startAtBottom: PropTypes.bool,

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
        onFillRequest: PropTypes.func,

        /* onUnfillRequest(backwards): a callback which is called on scroll when
         * there are children elements that are far out of view and could be removed
         * without causing pagination to occur.
         *
         * This function should accept a boolean, which is true to indicate the back/top
         * of the panel and false otherwise, and a scroll token, which refers to the
         * first element to remove if removing from the front/bottom, and last element
         * to remove if removing from the back/top.
         */
        onUnfillRequest: PropTypes.func,

        /* onScroll: a callback which is called whenever any scroll happens.
         */
        onScroll: PropTypes.func,

        /* className: classnames to add to the top-level div
         */
        className: PropTypes.string,

        /* style: styles to add to the top-level div
         */
        style: PropTypes.object,
        /* resizeNotifier: ResizeNotifier to know when middle column has changed size
         */
        resizeNotifier: PropTypes.object,
    },

    getDefaultProps: function() {
        return {
            stickyBottom: true,
            startAtBottom: true,
            onFillRequest: function(backwards) { return Promise.resolve(false); },
            onUnfillRequest: function(backwards, scrollToken) {},
            onScroll: function() {},
        };
    },

    componentWillMount: function() {
        this._pendingFillRequests = {b: null, f: null};

        if (this.props.resizeNotifier) {
            this.props.resizeNotifier.on("middlePanelResized", this.onResize);
        }

        this.resetScrollState();
    },

    componentDidMount: function() {
        this.checkScroll();
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

        if (this.props.resizeNotifier) {
            this.props.resizeNotifier.removeListener("middlePanelResized", this.onResize);
        }
    },

    onScroll: function(ev) {
        this._scrollTimeout.restart();
        this._saveScrollState();
        this._checkBlockShrinking();
        this.checkFillState();

        this.props.onScroll(ev);
    },

    onResize: function() {
        this.clearBlockShrinking();
        this.checkScroll();
    },

    // after an update to the contents of the panel, check that the scroll is
    // where it ought to be, and set off pagination requests if necessary.
    checkScroll: function() {
        this._restoreSavedScrollState();
        this._checkBlockShrinking();
        this.checkFillState();
    },

    // return true if the content is fully scrolled down right now; else false.
    //
    // note that this is independent of the 'stuckAtBottom' state - it is simply
    // about whether the the content is scrolled down right now, irrespective of
    // whether it will stay that way when the children update.
    isAtBottom: function() {
        const sn = this._getScrollNode();
        return sn.scrollTop === sn.scrollHeight - sn.clientHeight;
    },

    // returns the vertical height in the given direction that can be removed from
    // the content box (which has a height of scrollHeight, see checkFillState) without
    // pagination occuring.
    //
    // padding* = UNPAGINATION_PADDING
    //
    // ### Region determined as excess.
    //
    //   .---------.                        -              -
    //   |#########|                        |              |
    //   |#########|   -                    |  scrollTop   |
    //   |         |   | padding*           |              |
    //   |         |   |                    |              |
    // .-+---------+-. -  -                 |              |
    // : |         | :    |                 |              |
    // : |         | :    |  clientHeight   |              |
    // : |         | :    |                 |              |
    // .-+---------+-.    -                 -              |
    // | |         | |    |                                |
    // | |         | |    |  clientHeight                  | scrollHeight
    // | |         | |    |                                |
    // `-+---------+-'    -                                |
    // : |         | :    |                                |
    // : |         | :    |  clientHeight                  |
    // : |         | :    |                                |
    // `-+---------+-' -  -                                |
    //   |         |   | padding*                          |
    //   |         |   |                                   |
    //   |#########|   -                                   |
    //   |#########|                                       |
    //   `---------'                                       -
    _getExcessHeight: function(backwards) {
        const sn = this._getScrollNode();
        const contentHeight = this._getMessagesHeight();
        const listHeight = this._getListHeight();
        const clippedHeight = contentHeight - listHeight;
        const unclippedScrollTop = sn.scrollTop + clippedHeight;

        if (backwards) {
            return unclippedScrollTop - sn.clientHeight - UNPAGINATION_PADDING;
        } else {
            return contentHeight - (unclippedScrollTop + 2*sn.clientHeight) - UNPAGINATION_PADDING;
        }
    },

    // check the scroll state and send out backfill requests if necessary.
    checkFillState: function() {
        if (this.unmounted) {
            return;
        }

        const sn = this._getScrollNode();

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

        const contentHeight = this._getMessagesHeight();
        const contentTop = contentHeight - this._getListHeight();
        const contentScrollTop = sn.scrollTop + contentTop;
        if (contentScrollTop < sn.clientHeight) {
            // need to back-fill
            this._maybeFill(true);
        }
        if (contentScrollTop > contentHeight - sn.clientHeight * 2) {
            // need to forward-fill
            this._maybeFill(false);
        }
    },

    // check if unfilling is possible and send an unfill request if necessary
    _checkUnfillState: function(backwards) {
        let excessHeight = this._getExcessHeight(backwards);
        if (excessHeight <= 0) {
            return;
        }

        const origExcessHeight = excessHeight;

        const tiles = this.refs.itemlist.children;

        // The scroll token of the first/last tile to be unpaginated
        let markerScrollToken = null;

        // Subtract heights of tiles to simulate the tiles being unpaginated until the
        // excess height is less than the height of the next tile to subtract. This
        // prevents excessHeight becoming negative, which could lead to future
        // pagination.
        //
        // If backwards is true, we unpaginate (remove) tiles from the back (top).
        let tile;
        for (let i = 0; i < tiles.length; i++) {
            tile = tiles[backwards ? i : tiles.length - 1 - i];
            // Subtract height of tile as if it were unpaginated
            excessHeight -= tile.clientHeight;
            //If removing the tile would lead to future pagination, break before setting scroll token
            if (tile.clientHeight > excessHeight) {
                break;
            }
            // The tile may not have a scroll token, so guard it
            if (tile.dataset.scrollTokens) {
                markerScrollToken = tile.dataset.scrollTokens.split(',')[0];
            }
        }
        debuglog("unfilling now", backwards, origExcessHeight, Array.prototype.indexOf.call(tiles, tile));

        if (markerScrollToken) {
            // Use a debouncer to prevent multiple unfill calls in quick succession
            // This is to make the unfilling process less aggressive
            if (this._unfillDebouncer) {
                clearTimeout(this._unfillDebouncer);
            }
            this._unfillDebouncer = setTimeout(() => {
                this._unfillDebouncer = null;
                this.props.onUnfillRequest(backwards, markerScrollToken);
            }, UNFILL_REQUEST_DEBOUNCE_MS);
        }
    },

    // check if there is already a pending fill request. If not, set one off.
    _maybeFill: function(backwards) {
        const dir = backwards ? 'b' : 'f';
        if (this._pendingFillRequests[dir]) {
            debuglog("ScrollPanel: Already a "+dir+" fill in progress - not starting another");
            return;
        }

        debuglog("ScrollPanel: starting "+dir+" fill");

        // onFillRequest can end up calling us recursively (via onScroll
        // events) so make sure we set this before firing off the call.
        this._pendingFillRequests[dir] = true;

        Promise.try(() => {
            return this.props.onFillRequest(backwards);
        }).finally(() => {
            this._pendingFillRequests[dir] = false;
        }).then((hasMoreResults) => {
            if (this.unmounted) {
                return;
            }
            // Unpaginate once filling is complete
            this._checkUnfillState(!backwards);

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
     *   false, the first token in data-scroll-tokens of the child which we are
     *   tracking.
     *
     * number bottomOffset: undefined if stuckAtBottom is true; if it is false,
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
        this.scrollState = {
            stuckAtBottom: this.props.startAtBottom,
        };
        this._bottomGrowth = 0;
        this._pages = 0;
        this._scrollTimeout = new Timer(100);
        this._heightUpdateInProgress = false;
    },

    /**
     * jump to the top of the content.
     */
    scrollToTop: function() {
        this._getScrollNode().scrollTop = 0;
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
        const sn = this._getScrollNode();
        sn.scrollTop = sn.scrollHeight;
        this._saveScrollState();
    },

    /**
     * Page up/down.
     *
     * @param {number} mult: -1 to page up, +1 to page down
     */
    scrollRelative: function(mult) {
        const scrollNode = this._getScrollNode();
        const delta = mult * scrollNode.clientHeight * 0.5;
        scrollNode.scrollTop = scrollNode.scrollTop + delta;
        this._saveScrollState();
    },

    /**
     * Scroll up/down in response to a scroll key
     * @param {object} ev the keyboard event
     */
    handleScrollKey: function(ev) {
        switch (ev.keyCode) {
            case KeyCode.PAGE_UP:
                if (!ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this.scrollRelative(-1);
                }
                break;

            case KeyCode.PAGE_DOWN:
                if (!ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this.scrollRelative(1);
                }
                break;

            case KeyCode.HOME:
                if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this.scrollToTop();
                }
                break;

            case KeyCode.END:
                if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this.scrollToBottom();
                }
                break;
        }
    },

    /* Scroll the panel to bring the DOM node with the scroll token
     * `scrollToken` into view.
     *
     * offsetBase gives the reference point for the bottomOffset. 0 means the
     * top of the container, 1 means the bottom, and fractional values mean
     * somewhere in the middle. If omitted, it defaults to 0.
     *
     * bottomOffset gives the number of pixels *above* the offsetBase that the
     * node (specifically, the bottom of it) will be positioned. If omitted, it
     * defaults to 0.
     */
    scrollToToken: function(scrollToken, bottomOffset, offsetBase) {
        bottomOffset = bottomOffset || 0;
        offsetBase = offsetBase || 0;

        // convert bottomOffset so that it is based on the bottom of the
        // container.
        bottomOffset += this._getScrollNode().clientHeight * (1-offsetBase);

        // save the desired scroll state. It's important we do this here rather
        // than as a result of the scroll event, because (a) we might not *get*
        // a scroll event, and (b) it might not currently be possible to set
        // the requested scroll state (eg, because we hit the end of the
        // timeline and need to do more pagination); we want to save the
        // *desired* scroll state rather than what we end up achieving.
        this.scrollState = {
            stuckAtBottom: false,
            trackedScrollToken: scrollToken,
            bottomOffset: bottomOffset,
        };

        // ... then make it so.
        this._restoreSavedScrollState();
    },

    _saveScrollState: function() {
        if (this.props.stickyBottom && this.isAtBottom()) {
            this.scrollState = { stuckAtBottom: true };
            debuglog("ScrollPanel: Saved scroll state", this.scrollState);
            return;
        }

        const scrollNode = this._getScrollNode();
        const viewportBottom = scrollNode.scrollHeight - (scrollNode.scrollTop + scrollNode.clientHeight);

        const itemlist = this.refs.itemlist;
        const messages = itemlist.children;
        let node = null;

        // TODO: do a binary search here, as items are sorted by offsetTop
        // loop backwards, from bottom-most message (as that is the most common case)
        for (let i = messages.length-1; i >= 0; --i) {
            if (!messages[i].dataset.scrollTokens) {
                continue;
            }
            node = messages[i];
            // break at the first message (coming from the bottom)
            // that has it's offsetTop above the bottom of the viewport.
            if (this._topFromBottom(node) > viewportBottom) {
                // Use this node as the scrollToken
                break;
            }
        }

        if (!node) {
            debuglog("ScrollPanel: unable to save scroll state: found no children in the viewport");
            return;
        }

        debuglog("ScrollPanel: replacing scroll state");
        this.scrollState = {
            stuckAtBottom: false,
            trackedNode: node,
            trackedScrollToken: node.dataset.scrollTokens.split(',')[0],
            bottomOffset: this._topFromBottom(node),
        };
    },

    _restoreSavedScrollState: async function() {
        const scrollState = this.scrollState;

        if (scrollState.stuckAtBottom) {
            const sn = this._getScrollNode();
            sn.scrollTop = sn.scrollHeight;
        } else if (scrollState.trackedScrollToken) {
            const itemlist = this.refs.itemlist;
            const trackedNode = this._getTrackedNode();
            if (trackedNode) {
                const newBottomOffset = this._topFromBottom(trackedNode);
                const bottomDiff = newBottomOffset - scrollState.bottomOffset;
                this._bottomGrowth += bottomDiff;
                scrollState.bottomOffset = newBottomOffset;
                itemlist.style.height = `${this._getListHeight()}px`;
                debuglog("ScrollPanel: balancing height because messages below viewport grew by "+bottomDiff+"px");
            }
        }
        // TODO: also call _updateHeight if not already in progress
        if (!this._heightUpdateInProgress) {
            this._heightUpdateInProgress = true;
            try {
                await this._updateHeight();
            } finally {
                this._heightUpdateInProgress = false;
            }
        }
    },
    // need a better name that also indicates this will change scrollTop? Rebalance height? Reveal content?
    async _updateHeight() {
        const startTs = Date.now();
        // wait until user has stopped scrolling
        if (this._scrollTimeout.isRunning()) {
            debuglog("xxx updateHeight waiting for scrolling to end ... ");
            await this._scrollTimeout.finished();
        }

        const sn = this._getScrollNode();
        const itemlist = this.refs.itemlist;
        const contentHeight = this._getMessagesHeight();
        const minHeight = sn.clientHeight;
        const height = Math.max(minHeight, contentHeight);
        this._pages = Math.ceil(height / PAGE_SIZE);
        this._bottomGrowth = 0;
        const newHeight = this._getListHeight();

        if (this.scrollState.stuckAtBottom) {
            itemlist.style.height = `${newHeight}px`;
            sn.scrollTop = sn.scrollHeight;
            debuglog("xxx updateHeight to", newHeight);
        } else {
            const trackedNode = this._getTrackedNode();
            const oldTop = trackedNode.offsetTop;
            itemlist.style.height = `${newHeight}px`;
            const newTop = trackedNode.offsetTop;
            const topDiff = newTop - oldTop;
            sn.scrollTop = sn.scrollTop + topDiff;
            debuglog("xxx updateHeight to", newHeight, topDiff, Date.now() - startTs);
        }
    },

    _getTrackedNode() {
        const scrollState = this.scrollState;
        const trackedNode = scrollState.trackedNode;

        if (!trackedNode || !trackedNode.parentElement) {
            let node;
            const messages = this.refs.itemlist.children;
            const scrollToken = scrollState.trackedScrollToken;

            for (let i = messages.length-1; i >= 0; --i) {
                const m = messages[i];
                // 'data-scroll-tokens' is a DOMString of comma-separated scroll tokens
                // There might only be one scroll token
                if (m.dataset.scrollTokens &&
                    m.dataset.scrollTokens.split(',').indexOf(scrollToken) !== -1) {
                    node = m;
                    break;
                }
            }
            debuglog("had to find tracked node again for " + scrollState.trackedScrollToken);
            scrollState.trackedNode = node;
        }

        if (!scrollState.trackedNode) {
            debuglog("ScrollPanel: No node with ; '"+scrollState.trackedScrollToken+"'");
            return;
        }

        return scrollState.trackedNode;
    },

    _getListHeight() {
        return this._bottomGrowth + (this._pages * PAGE_SIZE);
    },

    _getMessagesHeight() {
        const itemlist = this.refs.itemlist;
        const lastNode = itemlist.lastElementChild;
        // 18 is itemlist padding
        return (lastNode.offsetTop + lastNode.clientHeight) - itemlist.firstElementChild.offsetTop + (18 * 2);
    },

    _topFromBottom(node) {
        return this.refs.itemlist.clientHeight - node.offsetTop;
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

        if (!this._divScroll) {
            // Likewise, we should have the ref by this point, but if not
            // turn the NPE into something meaningful.
            throw new Error("ScrollPanel._getScrollNode called before gemini ref collected");
        }

        return this._divScroll;
    },

    _collectScroll: function(divScroll) {
        this._divScroll = divScroll;
    },

    /**
     * Set the current height as the min height for the message list
     * so the timeline cannot shrink. This is used to avoid
     * jumping when the typing indicator gets replaced by a smaller message.
     */
    blockShrinking: function() {
        const messageList = this.refs.itemlist;
        if (messageList) {
            const currentHeight = messageList.clientHeight;
            messageList.style.minHeight = `${currentHeight}px`;
        }
    },

    /**
     * Clear the previously set min height
     */
    clearBlockShrinking: function() {
        const messageList = this.refs.itemlist;
        if (messageList) {
            messageList.style.minHeight = null;
        }
    },

    _checkBlockShrinking: function() {
        const sn = this._getScrollNode();
        const scrollState = this.scrollState;
        if (!scrollState.stuckAtBottom) {
            const spaceBelowViewport = sn.scrollHeight - (sn.scrollTop + sn.clientHeight);
            // only if we've scrolled up 200px from the bottom
            // should we clear the min-height used by the typing notifications,
            // otherwise we might still see it jump as the whitespace disappears
            // when scrolling up from the bottom
            if (spaceBelowViewport >= 200) {
                this.clearBlockShrinking();
            }
        }
    },

    render: function() {
        // TODO: the classnames on the div and ol could do with being updated to
        // reflect the fact that we don't necessarily contain a list of messages.
        // it's not obvious why we have a separate div and ol anyway.
        return (<AutoHideScrollbar wrappedRef={this._collectScroll}
                onScroll={this.onScroll}
                className={`mx_ScrollPanel ${this.props.className}`} style={this.props.style}>
                    <div className="mx_RoomView_messageListWrapper">
                        <ol ref="itemlist" className="mx_RoomView_MessageList" aria-live="polite">
                            { this.props.children }
                        </ol>
                    </div>
                </AutoHideScrollbar>
            );
    },
});
