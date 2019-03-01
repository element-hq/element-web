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

const React = require('react');
const ReactDOM = require("react-dom");
const ReactTestUtils = require('react-addons-test-utils');
const expect = require('expect');
import Promise from 'bluebird';

const sdk = require('matrix-react-sdk');

const ScrollPanel = sdk.getComponent('structures.ScrollPanel');
const test_utils = require('test-utils');

const Tester = React.createClass({
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
        const dir = back ? 'b': 'f';
        console.log("FillRequest: " + dir);
        this.fillCounts[dir]++;

        const handler = this._fillHandlers[dir];
        const defer = this._fillDefers[dir];

        // don't use the same handler twice
        this._fillHandlers[dir] = null;
        this._fillDefers[dir] = null;

        let res;
        if (handler) {
            res = handler();
        } else {
            res = Promise.resolve(false);
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
        const defer = Promise.defer();
        this._fillDefers[dir] = defer;
        return defer.promise;
    },

    _onScroll: function(ev) {
        const st = ev.target.scrollTop;
        console.log("ScrollPanel Tester: scroll event; scrollTop: " + st);
        this.lastScrollEvent = st;

        const d = this._scrollDefer;
        if (d) {
            this._scrollDefer = null;
            d.resolve();
        }
    },

    /* returns a promise which will resolve when a scroll event happens */
    awaitScroll: function() {
        console.log("Awaiting scroll");
        this._scrollDefer = Promise.defer();
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
            <li key={key} data-scroll-tokens={key}>
                <div style={{height: '98px', margin: '50px', border: '1px solid black',
                             backgroundColor: '#fff8dc' }}>
                   { key }
                </div>
             </li>
         );
    },

    render: function() {
        const tiles = this.state.tileKeys.map(this._mkTile);
        console.log("rendering with " + tiles.length + " tiles");
        return (
            <ScrollPanel ref="sp"
                onScroll={this._onScroll}
                onFillRequest={this._onFillRequest}>
                    { tiles }
            </ScrollPanel>
        );
    },
});

describe('ScrollPanel', function() {
    let parentDiv;
    let tester;
    let scrollingDiv;

    beforeEach(function(done) {
        test_utils.beforeEach(this);

        // create a div of a useful size to put our panel in, and attach it to
        // the document so that we can interact with it properly.
        parentDiv = document.createElement('div');
        parentDiv.style.width = '800px';
        parentDiv.style.height = '600px';
        parentDiv.style.overflow = 'hidden';
        document.body.appendChild(parentDiv);

        tester = ReactDOM.render(<Tester />, parentDiv);
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
            return Promise.resolve().then(() => {
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

    it('should handle scrollEvent strangeness', function() {
        const events = [];

        return Promise.resolve().then(() => {
            // initialise with a load of events
            for (let i = 0; i < 20; i++) {
                events.push(i+80);
            }
            tester.setTileKeys(events);
            expect(scrollingDiv.scrollHeight).toEqual(3050); // 20*150 + 50
            expect(scrollingDiv.scrollTop).toEqual(3050 - 600);
            return tester.awaitScroll();
        }).then(() => {
            expect(tester.lastScrollEvent).toBe(3050 - 600);

            tester.scrollPanel().scrollToToken("92", 0);

            // at this point, ScrollPanel will have updated scrollTop, but
            // the event hasn't fired.
            expect(tester.lastScrollEvent).toEqual(3050 - 600);
            expect(scrollingDiv.scrollTop).toEqual(1950);

            // now stamp over the scrollTop.
            console.log('faking #528');
            scrollingDiv.scrollTop = 500;

            return tester.awaitScroll();
        }).then(() => {
            expect(tester.lastScrollEvent).toBe(1950);
            expect(scrollingDiv.scrollTop).toEqual(1950);
        });
    });
});
