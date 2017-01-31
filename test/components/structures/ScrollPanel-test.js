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
var ReactTestUtils = require('react-addons-test-utils');
var expect = require('expect');
var q = require('q');

var sdk = require('matrix-react-sdk');

var ScrollPanel = sdk.getComponent('structures.ScrollPanel');
var test_utils = require('test-utils');

var Tester = React.createClass({
    getInitialState: function() {
        return {
            tileKeys: [],
        };
    },

    componentWillMount: function() {
        this.fillCounts = {'b': 0, 'f': 0};
        this._fillHandlers = {'b': null, 'f': null};
        this._fillDefers = {'b': null, 'f': null};
        this._scrollDefer = null;

        // scrollTop at the last scroll event
        this.lastScrollEvent = null;
    },

    _onFillRequest: function(back) {
        var dir = back ? 'b': 'f';
        console.log("FillRequest: " + dir);
        this.fillCounts[dir]++;

        var handler = this._fillHandlers[dir];
        var defer = this._fillDefers[dir];

        // don't use the same handler twice
        this._fillHandlers[dir] = null;
        this._fillDefers[dir] = null;

        var res;
        if (handler) {
            res = handler();
        } else {
            res = q(false);
        }

        if (defer) {
            defer.resolve();
        }
        return res;
    },

    addFillHandler: function(dir, handler) {
        this._fillHandlers[dir] = handler;
    },

    /* returns a promise which will resolve when the fill happens */
    awaitFill: function(dir) {
        console.log("ScrollPanel Tester: awaiting " + dir + " fill");
        var defer = q.defer();
        this._fillDefers[dir] = defer;
        return defer.promise;
    },

    _onScroll: function(ev) {
        var st = ev.target.scrollTop;
        console.log("ScrollPanel Tester: scroll event; scrollTop: " + st);
        this.lastScrollEvent = st;

        var d = this._scrollDefer;
        if (d) {
            this._scrollDefer = null;
            d.resolve();
        }
    },

    /* returns a promise which will resolve when a scroll event happens */
    awaitScroll: function() {
        console.log("Awaiting scroll");
        this._scrollDefer = q.defer();
        return this._scrollDefer.promise;
    },

    setTileKeys: function(keys) {
        console.log("Updating keys: len=" + keys.length);
        this.setState({tileKeys: keys.slice()});
    },

    scrollPanel: function() {
        return this.refs.sp;
    },

    _mkTile: function(key) {
        // each tile is 150 pixels high:
        // 98 pixels of body
        // 2 pixels of border
        // 50 pixels of margin
        //
        // there is an extra 50 pixels of margin at the bottom.
        return (
            <li key={key} data-scroll-token={key}>
                <div style={{height: '98px', margin: '50px', border: '1px solid black',
                             backgroundColor: '#fff8dc' }}>
                   {key}
                </div>
             </li>
         );
    },

    render: function() {
        var tiles = this.state.tileKeys.map(this._mkTile);
        console.log("rendering with " + tiles.length + " tiles");
        return (
            <ScrollPanel ref="sp"
                onScroll={ this._onScroll }
                onFillRequest={ this._onFillRequest }>
                    {tiles}
            </ScrollPanel>
        );
    },
});

describe('ScrollPanel', function() {
    var parentDiv;
    var tester;
    var scrollingDiv;

    beforeEach(function(done) {
        test_utils.beforeEach(this);

        // create a div of a useful size to put our panel in, and attach it to
        // the document so that we can interact with it properly.
        parentDiv = document.createElement('div');
        parentDiv.style.width = '800px';
        parentDiv.style.height = '600px';
        parentDiv.style.overflow = 'hidden';
        document.body.appendChild(parentDiv);

        tester = ReactDOM.render(<Tester/>, parentDiv);
        expect(tester.fillCounts.b).toEqual(1);
        expect(tester.fillCounts.f).toEqual(1);

        scrollingDiv = ReactTestUtils.findRenderedDOMComponentWithClass(
            tester, "gm-scroll-view");

        // we need to make sure we don't call done() until q has finished
        // running the completion handlers from the fill requests. We can't
        // just use .done(), because that will end up ahead of those handlers
        // in the queue. We can't use window.setTimeout(0), because that also might
        // run ahead of those handlers.
        const sp = tester.scrollPanel();
        let retriesRemaining = 1;
        const awaitReady = function() {
            return q().then(() => {
                if (sp._pendingFillRequests.b === false &&
                    sp._pendingFillRequests.f === false
                   ) {
                    return;
                }

                if (retriesRemaining == 0) {
                    throw new Error("fillRequests did not complete");
                }
                retriesRemaining--;
                return awaitReady();
            });
        };
        awaitReady().done(done);
    });

    afterEach(function() {
        if (parentDiv) {
            document.body.removeChild(parentDiv);
            parentDiv = null;
        }
    });

    it('should handle scrollEvent strangeness', function(done) {
        var events = [];

        q().then(() => {
            // initialise with a few events
            for (var i = 0; i < 10; i++) {
                events.push(i+90);
            }
            tester.setTileKeys(events);
            expect(tester.fillCounts.b).toEqual(1);
            expect(tester.fillCounts.f).toEqual(2);
            expect(scrollingDiv.scrollHeight).toEqual(1550) // 10*150 + 50
            expect(scrollingDiv.scrollTop).toEqual(1550 - 600);
            return tester.awaitScroll();
        }).then(() => {
            expect(tester.lastScrollEvent).toBe(950);

            // we want to simulate back-filling as we scroll up
            tester.addFillHandler('b', function() {
                var newEvents = [];
                for (var i = 0; i < 10; i++) {
                    newEvents.push(i+80);
                }
                events.unshift.apply(events, newEvents);
                tester.setTileKeys(events);
                return q(true);
            });

            // simulate scrolling up; this should trigger the backfill
            scrollingDiv.scrollTop = 200;

            return tester.awaitFill('b');
        }).then(() => {
            console.log('filled');

            // at this point, ScrollPanel will have updated scrollTop, but
            // the event hasn't fired. Stamp over the scrollTop.
            expect(tester.lastScrollEvent).toEqual(200);
            expect(scrollingDiv.scrollTop).toEqual(10*150 + 200);
            scrollingDiv.scrollTop = 500;

            return tester.awaitScroll();
        }).then(() => {
            expect(tester.lastScrollEvent).toBe(10*150 + 200);
            expect(scrollingDiv.scrollTop).toEqual(10*150 + 200);
        }).done(done);
    });

    it('should not get stuck in #528 workaround', function(done) {
        var events = [];
        q().then(() => {
            // initialise with a bunch of events
            for (var i = 0; i < 40; i++) {
                events.push(i);
            }
            tester.setTileKeys(events);
            expect(tester.fillCounts.b).toEqual(1);
            expect(tester.fillCounts.f).toEqual(2);
            expect(scrollingDiv.scrollHeight).toEqual(6050) // 40*150 + 50
            expect(scrollingDiv.scrollTop).toEqual(6050 - 600);

            // try to scroll up, to a non-integer offset.
            tester.scrollPanel().scrollToToken("30", -101/3);

            expect(scrollingDiv.scrollTop).toEqual(4616); // 31*150 - 34

            // wait for the scroll event to land
            return tester.awaitScroll(); // fails
        }).then(() => {
            expect(tester.lastScrollEvent).toEqual(4616);

            // Now one more event; this will make it reset the scroll, but
            // because the delta will be less than 1, will not trigger a
            // scroll event, this leaving recentEventScroll defined.
            console.log("Adding event 50");
            events.push(50);
            tester.setTileKeys(events);

            // wait for the scrollpanel to stop trying to paginate
        }).then(() => {
            // Now, simulate hitting "scroll to bottom".
            events = [];
            for (var i = 100; i < 120; i++) {
                events.push(i);
            }
            tester.setTileKeys(events);
            tester.scrollPanel().scrollToBottom();

            // wait for the scroll event to land
            return tester.awaitScroll(); // fails
        }).then(() => {
            expect(scrollingDiv.scrollTop).toEqual(20*150 + 50 - 600);

            // simulate a user-initiated scroll on the div
            scrollingDiv.scrollTop = 1200;
            return tester.awaitScroll();
        }).then(() => {
            expect(scrollingDiv.scrollTop).toEqual(1200);
        }).done(done);
    });
});
