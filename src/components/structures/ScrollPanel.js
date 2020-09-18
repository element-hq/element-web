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

import React, {createRef} from "react";
import PropTypes from 'prop-types';
import { Key } from '../../Keyboard';
import Timer from '../../utils/Timer';
import AutoHideScrollbar from "./AutoHideScrollbar";

const DEBUG_SCROLL = false;

// The amount of extra scroll distance to allow prior to unfilling.
// See _getExcessHeight.
const UNPAGINATION_PADDING = 6000;
// The number of milliseconds to debounce calls to onUnfillRequest, to prevent
// many scroll events causing many unfilling requests.
const UNFILL_REQUEST_DEBOUNCE_MS = 200;
// _updateHeight makes the height a ceiled multiple of this so we
// don't have to update the height too often. It also allows the user
// to scroll past the pagination spinner a bit so they don't feel blocked so
// much while the content loads.
const PAGE_SIZE = 400;

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

export default class ScrollPanel extends React.Component {
    static propTypes = {
        /* stickyBottom: if set to true, then once the user hits the bottom of
         * the list, any new children added to the list will cause the list to
         * scroll down to show the new element, rather than preserving the
         * existing view.
         */
        stickyBottom: PropTypes.bool,

        /* startAtBottom: if set to true, the view is assumed to start
         * scrolled to the bottom.
         * XXX: It's likely this is unnecessary and can be derived from
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

        /* fixedChildren: allows for children to be passed which are rendered outside
         * of the wrapper
         */
        fixedChildren: PropTypes.node,
    };

    static defaultProps = {
        stickyBottom: true,
        startAtBottom: true,
        onFillRequest: function(backwards) { return Promise.resolve(false); },
        onUnfillRequest: function(backwards, scrollToken) {},
        onScroll: function() {},
    };

    constructor(props) {
        super(props);

        this._pendingFillRequests = {b: null, f: null};

        if (this.props.resizeNotifier) {
            this.props.resizeNotifier.on("middlePanelResizedNoisy", this.onResize);
        }

        this.resetScrollState();

        this._itemlist = createRef();
    }

    componentDidMount() {
        this.checkScroll();
    }

    componentDidUpdate() {
        // after adding event tiles, we may need to tweak the scroll (either to
        // keep at the bottom of the timeline, or to maintain the view after
        // adding events to the top).
        //
        // This will also re-check the fill state, in case the paginate was inadequate
        this.checkScroll();
        this.updatePreventShrinking();
    }

    componentWillUnmount() {
        // set a boolean to say we've been unmounted, which any pending
        // promises can use to throw away their results.
        //
        // (We could use isMounted(), but facebook have deprecated that.)
        this.unmounted = true;

        if (this.props.resizeNotifier) {
            this.props.resizeNotifier.removeListener("middlePanelResizedNoisy", this.onResize);
        }
    }

    onScroll = ev => {
        // skip scroll events caused by resizing
        if (this.props.resizeNotifier && this.props.resizeNotifier.isResizing) return;
        debuglog("onScroll", this._getScrollNode().scrollTop);
        this._scrollTimeout.restart();
        this._saveScrollState();
        this.updatePreventShrinking();
        this.props.onScroll(ev);
        this.checkFillState();
    };

    onResize = () => {
        debuglog("onResize");
        this.checkScroll();
        // update preventShrinkingState if present
        if (this.preventShrinkingState) {
            this.preventShrinking();
        }
    };

    // after an update to the contents of the panel, check that the scroll is
    // where it ought to be, and set off pagination requests if necessary.
    checkScroll = () => {
        if (this.unmounted) {
            return;
        }
        this._restoreSavedScrollState();
        this.checkFillState();
    };

    // return true if the content is fully scrolled down right now; else false.
    //
    // note that this is independent of the 'stuckAtBottom' state - it is simply
    // about whether the content is scrolled down right now, irrespective of
    // whether it will stay that way when the children update.
    isAtBottom = () => {
        const sn = this._getScrollNode();
        // fractional values (both too big and too small)
        // for scrollTop happen on certain browsers/platforms
        // when scrolled all the way down. E.g. Chrome 72 on debian.
        // so check difference <= 1;
        return Math.abs(sn.scrollHeight - (sn.scrollTop + sn.clientHeight)) <= 1;
    };

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
    _getExcessHeight(backwards) {
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
    }

    // check the scroll state and send out backfill requests if necessary.
    checkFillState = async (depth=0) => {
        if (this.unmounted) {
            return;
        }

        const isFirstCall = depth === 0;
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

        // as filling is async and recursive,
        // don't allow more than 1 chain of calls concurrently
        // do make a note when a new request comes in while already running one,
        // so we can trigger a new chain of calls once done.
        if (isFirstCall) {
            if (this._isFilling) {
                debuglog("_isFilling: not entering while request is ongoing, marking for a subsequent request");
                this._fillRequestWhileRunning = true;
                return;
            }
            debuglog("_isFilling: setting");
            this._isFilling = true;
        }

        const itemlist = this._itemlist.current;
        const firstTile = itemlist && itemlist.firstElementChild;
        const contentTop = firstTile && firstTile.offsetTop;
        const fillPromises = [];

        // if scrollTop gets to 1 screen from the top of the first tile,
        // try backward filling
        if (!firstTile || (sn.scrollTop - contentTop) < sn.clientHeight) {
            // need to back-fill
            fillPromises.push(this._maybeFill(depth, true));
        }
        // if scrollTop gets to 2 screens from the end (so 1 screen below viewport),
        // try forward filling
        if ((sn.scrollHeight - sn.scrollTop) < sn.clientHeight * 2) {
            // need to forward-fill
            fillPromises.push(this._maybeFill(depth, false));
        }

        if (fillPromises.length) {
            try {
                await Promise.all(fillPromises);
            } catch (err) {
                console.error(err);
            }
        }
        if (isFirstCall) {
            debuglog("_isFilling: clearing");
            this._isFilling = false;
        }

        if (this._fillRequestWhileRunning) {
            this._fillRequestWhileRunning = false;
            this.checkFillState();
        }
    };

    // check if unfilling is possible and send an unfill request if necessary
    _checkUnfillState(backwards) {
        let excessHeight = this._getExcessHeight(backwards);
        if (excessHeight <= 0) {
            return;
        }

        const origExcessHeight = excessHeight;

        const tiles = this._itemlist.current.children;

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

        if (markerScrollToken) {
            // Use a debouncer to prevent multiple unfill calls in quick succession
            // This is to make the unfilling process less aggressive
            if (this._unfillDebouncer) {
                clearTimeout(this._unfillDebouncer);
            }
            this._unfillDebouncer = setTimeout(() => {
                this._unfillDebouncer = null;
                debuglog("unfilling now", backwards, origExcessHeight);
                this.props.onUnfillRequest(backwards, markerScrollToken);
            }, UNFILL_REQUEST_DEBOUNCE_MS);
        }
    }

    // check if there is already a pending fill request. If not, set one off.
    _maybeFill(depth, backwards) {
        const dir = backwards ? 'b' : 'f';
        if (this._pendingFillRequests[dir]) {
            debuglog("Already a "+dir+" fill in progress - not starting another");
            return;
        }

        debuglog("starting "+dir+" fill");

        // onFillRequest can end up calling us recursively (via onScroll
        // events) so make sure we set this before firing off the call.
        this._pendingFillRequests[dir] = true;

        // wait 1ms before paginating, because otherwise
        // this will block the scroll event handler for +700ms
        // if messages are already cached in memory,
        // This would cause jumping to happen on Chrome/macOS.
        return new Promise(resolve => setTimeout(resolve, 1)).then(() => {
            return this.props.onFillRequest(backwards);
        }).finally(() => {
            this._pendingFillRequests[dir] = false;
        }).then((hasMoreResults) => {
            if (this.unmounted) {
                return;
            }
            // Unpaginate once filling is complete
            this._checkUnfillState(!backwards);

            debuglog(""+dir+" fill complete; hasMoreResults:"+hasMoreResults);
            if (hasMoreResults) {
                // further pagination requests have been disabled until now, so
                // it's time to check the fill state again in case the pagination
                // was insufficient.
                return this.checkFillState(depth + 1);
            }
        });
    }

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
    getScrollState = () => this.scrollState;

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
    resetScrollState = () => {
        this.scrollState = {
            stuckAtBottom: this.props.startAtBottom,
        };
        this._bottomGrowth = 0;
        this._pages = 0;
        this._scrollTimeout = new Timer(100);
        this._heightUpdateInProgress = false;
    };

    /**
     * jump to the top of the content.
     */
    scrollToTop = () => {
        this._getScrollNode().scrollTop = 0;
        this._saveScrollState();
    };

    /**
     * jump to the bottom of the content.
     */
    scrollToBottom = () => {
        // the easiest way to make sure that the scroll state is correctly
        // saved is to do the scroll, then save the updated state. (Calculating
        // it ourselves is hard, and we can't rely on an onScroll callback
        // happening, since there may be no user-visible change here).
        const sn = this._getScrollNode();
        sn.scrollTop = sn.scrollHeight;
        this._saveScrollState();
    };

    /**
     * Page up/down.
     *
     * @param {number} mult: -1 to page up, +1 to page down
     */
    scrollRelative = mult => {
        const scrollNode = this._getScrollNode();
        const delta = mult * scrollNode.clientHeight * 0.5;
        scrollNode.scrollBy(0, delta);
        this._saveScrollState();
    };

    /**
     * Scroll up/down in response to a scroll key
     * @param {object} ev the keyboard event
     */
    handleScrollKey = ev => {
        switch (ev.key) {
            case Key.PAGE_UP:
                if (!ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this.scrollRelative(-1);
                }
                break;

            case Key.PAGE_DOWN:
                if (!ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this.scrollRelative(1);
                }
                break;

            case Key.HOME:
                if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this.scrollToTop();
                }
                break;

            case Key.END:
                if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this.scrollToBottom();
                }
                break;
        }
    };

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
    scrollToToken = (scrollToken, pixelOffset, offsetBase) => {
        pixelOffset = pixelOffset || 0;
        offsetBase = offsetBase || 0;

        // set the trackedScrollToken so we can get the node through _getTrackedNode
        this.scrollState = {
            stuckAtBottom: false,
            trackedScrollToken: scrollToken,
        };
        const trackedNode = this._getTrackedNode();
        const scrollNode = this._getScrollNode();
        if (trackedNode) {
            // set the scrollTop to the position we want.
            // note though, that this might not succeed if the combination of offsetBase and pixelOffset
            // would position the trackedNode towards the top of the viewport.
            // This because when setting the scrollTop only 10 or so events might be loaded,
            // not giving enough content below the trackedNode to scroll downwards
            // enough so it ends up in the top of the viewport.
            debuglog("scrollToken: setting scrollTop", {offsetBase, pixelOffset, offsetTop: trackedNode.offsetTop});
            scrollNode.scrollTop = (trackedNode.offsetTop - (scrollNode.clientHeight * offsetBase)) + pixelOffset;
            this._saveScrollState();
        }
    };

    _saveScrollState() {
        if (this.props.stickyBottom && this.isAtBottom()) {
            this.scrollState = { stuckAtBottom: true };
            debuglog("saved stuckAtBottom state");
            return;
        }

        const scrollNode = this._getScrollNode();
        const viewportBottom = scrollNode.scrollHeight - (scrollNode.scrollTop + scrollNode.clientHeight);

        const itemlist = this._itemlist.current;
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
            debuglog("unable to save scroll state: found no children in the viewport");
            return;
        }
        const scrollToken = node.dataset.scrollTokens.split(',')[0];
        debuglog("saving anchored scroll state to message", node && node.innerText, scrollToken);
        const bottomOffset = this._topFromBottom(node);
        this.scrollState = {
            stuckAtBottom: false,
            trackedNode: node,
            trackedScrollToken: scrollToken,
            bottomOffset: bottomOffset,
            pixelOffset: bottomOffset - viewportBottom, //needed for restoring the scroll position when coming back to the room
        };
    }

    async _restoreSavedScrollState() {
        const scrollState = this.scrollState;

        if (scrollState.stuckAtBottom) {
            const sn = this._getScrollNode();
            if (sn.scrollTop !== sn.scrollHeight) {
                sn.scrollTop = sn.scrollHeight;
            }
        } else if (scrollState.trackedScrollToken) {
            const itemlist = this._itemlist.current;
            const trackedNode = this._getTrackedNode();
            if (trackedNode) {
                const newBottomOffset = this._topFromBottom(trackedNode);
                const bottomDiff = newBottomOffset - scrollState.bottomOffset;
                this._bottomGrowth += bottomDiff;
                scrollState.bottomOffset = newBottomOffset;
                const newHeight = `${this._getListHeight()}px`;
                if (itemlist.style.height !== newHeight) {
                    itemlist.style.height = newHeight;
                }
                debuglog("balancing height because messages below viewport grew by", bottomDiff);
            }
        }
        if (!this._heightUpdateInProgress) {
            this._heightUpdateInProgress = true;
            try {
                await this._updateHeight();
            } finally {
                this._heightUpdateInProgress = false;
            }
        } else {
            debuglog("not updating height because request already in progress");
        }
    }

    // need a better name that also indicates this will change scrollTop? Rebalance height? Reveal content?
    async _updateHeight() {
        // wait until user has stopped scrolling
        if (this._scrollTimeout.isRunning()) {
            debuglog("updateHeight waiting for scrolling to end ... ");
            await this._scrollTimeout.finished();
        } else {
            debuglog("updateHeight getting straight to business, no scrolling going on.");
        }

        // We might have unmounted since the timer finished, so abort if so.
        if (this.unmounted) {
            return;
        }

        const sn = this._getScrollNode();
        const itemlist = this._itemlist.current;
        const contentHeight = this._getMessagesHeight();
        const minHeight = sn.clientHeight;
        const height = Math.max(minHeight, contentHeight);
        this._pages = Math.ceil(height / PAGE_SIZE);
        this._bottomGrowth = 0;
        const newHeight = `${this._getListHeight()}px`;

        const scrollState = this.scrollState;
        if (scrollState.stuckAtBottom) {
            if (itemlist.style.height !== newHeight) {
                itemlist.style.height = newHeight;
            }
            if (sn.scrollTop !== sn.scrollHeight){
                sn.scrollTop = sn.scrollHeight;
            }
            debuglog("updateHeight to", newHeight);
        } else if (scrollState.trackedScrollToken) {
            const trackedNode = this._getTrackedNode();
            // if the timeline has been reloaded
            // this can be called before scrollToBottom or whatever has been called
            // so don't do anything if the node has disappeared from
            // the currently filled piece of the timeline
            if (trackedNode) {
                const oldTop = trackedNode.offsetTop;
                if (itemlist.style.height !== newHeight) {
                    itemlist.style.height = newHeight;
                }
                const newTop = trackedNode.offsetTop;
                const topDiff = newTop - oldTop;
                // important to scroll by a relative amount as
                // reading scrollTop and then setting it might
                // yield out of date values and cause a jump
                // when setting it
                sn.scrollBy(0, topDiff);
                debuglog("updateHeight to", {newHeight, topDiff});
            }
        }
    }

    _getTrackedNode() {
        const scrollState = this.scrollState;
        const trackedNode = scrollState.trackedNode;

        if (!trackedNode || !trackedNode.parentElement) {
            let node;
            const messages = this._itemlist.current.children;
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
            if (node) {
                debuglog("had to find tracked node again for " + scrollState.trackedScrollToken);
            }
            scrollState.trackedNode = node;
        }

        if (!scrollState.trackedNode) {
            debuglog("No node with ; '"+scrollState.trackedScrollToken+"'");
            return;
        }

        return scrollState.trackedNode;
    }

    _getListHeight() {
        return this._bottomGrowth + (this._pages * PAGE_SIZE);
    }

    _getMessagesHeight() {
        const itemlist = this._itemlist.current;
        const lastNode = itemlist.lastElementChild;
        const lastNodeBottom = lastNode ? lastNode.offsetTop + lastNode.clientHeight : 0;
        const firstNodeTop = itemlist.firstElementChild ? itemlist.firstElementChild.offsetTop : 0;
        // 18 is itemlist padding
        return lastNodeBottom - firstNodeTop + (18 * 2);
    }

    _topFromBottom(node) {
        // current capped height - distance from top = distance from bottom of container to top of tracked element
        return this._itemlist.current.clientHeight - node.offsetTop;
    }

    /* get the DOM node which has the scrollTop property we care about for our
     * message panel.
     */
    _getScrollNode() {
        if (this.unmounted) {
            // this shouldn't happen, but when it does, turn the NPE into
            // something more meaningful.
            throw new Error("ScrollPanel._getScrollNode called when unmounted");
        }

        if (!this._divScroll) {
            // Likewise, we should have the ref by this point, but if not
            // turn the NPE into something meaningful.
            throw new Error("ScrollPanel._getScrollNode called before AutoHideScrollbar ref collected");
        }

        return this._divScroll;
    }

    _collectScroll = divScroll => {
        this._divScroll = divScroll;
    };

    /**
    Mark the bottom offset of the last tile so we can balance it out when
    anything below it changes, by calling updatePreventShrinking, to keep
    the same minimum bottom offset, effectively preventing the timeline to shrink.
    */
    preventShrinking = () => {
        const messageList = this._itemlist.current;
        const tiles = messageList && messageList.children;
        if (!messageList) {
            return;
        }
        let lastTileNode;
        for (let i = tiles.length - 1; i >= 0; i--) {
            const node = tiles[i];
            if (node.dataset.scrollTokens) {
                lastTileNode = node;
                break;
            }
        }
        if (!lastTileNode) {
            return;
        }
        this.clearPreventShrinking();
        const offsetFromBottom = messageList.clientHeight - (lastTileNode.offsetTop + lastTileNode.clientHeight);
        this.preventShrinkingState = {
            offsetFromBottom: offsetFromBottom,
            offsetNode: lastTileNode,
        };
        debuglog("prevent shrinking, last tile ", offsetFromBottom, "px from bottom");
    };

    /** Clear shrinking prevention. Used internally, and when the timeline is reloaded. */
    clearPreventShrinking = () => {
        const messageList = this._itemlist.current;
        const balanceElement = messageList && messageList.parentElement;
        if (balanceElement) balanceElement.style.paddingBottom = null;
        this.preventShrinkingState = null;
        debuglog("prevent shrinking cleared");
    };

    /**
    update the container padding to balance
    the bottom offset of the last tile since
    preventShrinking was called.
    Clears the prevent-shrinking state ones the offset
    from the bottom of the marked tile grows larger than
    what it was when marking.
    */
    updatePreventShrinking = () => {
        if (this.preventShrinkingState) {
            const sn = this._getScrollNode();
            const scrollState = this.scrollState;
            const messageList = this._itemlist.current;
            const {offsetNode, offsetFromBottom} = this.preventShrinkingState;
            // element used to set paddingBottom to balance the typing notifs disappearing
            const balanceElement = messageList.parentElement;
            // if the offsetNode got unmounted, clear
            let shouldClear = !offsetNode.parentElement;
            // also if 200px from bottom
            if (!shouldClear && !scrollState.stuckAtBottom) {
                const spaceBelowViewport = sn.scrollHeight - (sn.scrollTop + sn.clientHeight);
                shouldClear = spaceBelowViewport >= 200;
            }
            // try updating if not clearing
            if (!shouldClear) {
                const currentOffset = messageList.clientHeight - (offsetNode.offsetTop + offsetNode.clientHeight);
                const offsetDiff = offsetFromBottom - currentOffset;
                if (offsetDiff > 0) {
                    balanceElement.style.paddingBottom = `${offsetDiff}px`;
                    debuglog("update prevent shrinking ", offsetDiff, "px from bottom");
                } else if (offsetDiff < 0) {
                    shouldClear = true;
                }
            }
            if (shouldClear) {
                this.clearPreventShrinking();
            }
        }
    };

    render() {
        // TODO: the classnames on the div and ol could do with being updated to
        // reflect the fact that we don't necessarily contain a list of messages.
        // it's not obvious why we have a separate div and ol anyway.

        // give the <ol> an explicit role=list because Safari+VoiceOver seems to think an ordered-list with
        // list-style-type: none; is no longer a list
        return (<AutoHideScrollbar wrappedRef={this._collectScroll}
                onScroll={this.onScroll}
                className={`mx_ScrollPanel ${this.props.className}`} style={this.props.style}>
                    { this.props.fixedChildren }
                    <div className="mx_RoomView_messageListWrapper">
                        <ol ref={this._itemlist} className="mx_RoomView_MessageList" aria-live="polite" role="list">
                            { this.props.children }
                        </ol>
                    </div>
                </AutoHideScrollbar>
            );
    }
}
