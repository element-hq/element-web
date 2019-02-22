/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

const React = require('react');
import PropTypes from 'prop-types';
const sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'SearchResult',

    propTypes: {
        // a matrix-js-sdk SearchResult containing the details of this result
        searchResult: PropTypes.object.isRequired,

        // a list of strings to be highlighted in the results
        searchHighlights: PropTypes.array,

        // href for the highlights in this result
        resultLink: PropTypes.string,

        onWidgetLoad: PropTypes.func,
    },

    render: function() {
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const EventTile = sdk.getComponent('rooms.EventTile');
        const result = this.props.searchResult;
        const mxEv = result.context.getEvent();
        const eventId = mxEv.getId();

        const ts1 = mxEv.getTs();
        const ret = [<DateSeparator key={ts1 + "-search"} ts={ts1} />];

        const timeline = result.context.getTimeline();
        for (var j = 0; j < timeline.length; j++) {
            const ev = timeline[j];
            var highlights;
            const contextual = (j != result.context.getOurEventIndex());
            if (!contextual) {
                highlights = this.props.searchHighlights;
            }
            if (EventTile.haveTileForEvent(ev)) {
                ret.push(<EventTile key={eventId+"+"+j} mxEvent={ev} contextual={contextual} highlights={highlights}
                          permalinkCreator={this.props.permalinkCreator}
                          highlightLink={this.props.resultLink}
                          onWidgetLoad={this.props.onWidgetLoad} />);
            }
        }
        return (
            <li data-scroll-tokens={eventId+"+"+j}>
                { ret }
            </li>);
    },
});
