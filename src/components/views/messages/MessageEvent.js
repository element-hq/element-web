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

'use strict';

const React = require('react');
import PropTypes from 'prop-types';
const sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'MessageEvent',

    propTypes: {
        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,

        /* a list of words to highlight */
        highlights: PropTypes.array,

        /* link URL for the highlights */
        highlightLink: PropTypes.string,

        /* should show URL previews for this event */
        showUrlPreview: PropTypes.bool,

        /* callback called when dynamic content in events are loaded */
        onHeightChanged: PropTypes.func,

        /* the shape of the tile, used */
        tileShape: PropTypes.string,

        /* the maximum image height to use, if the event is an image */
        maxImageHeight: PropTypes.number,
    },

    getEventTileOps: function() {
        return this.refs.body && this.refs.body.getEventTileOps ? this.refs.body.getEventTileOps() : null;
    },

    render: function() {
        const UnknownBody = sdk.getComponent('messages.UnknownBody');

        const bodyTypes = {
            'm.text': sdk.getComponent('messages.TextualBody'),
            'm.notice': sdk.getComponent('messages.TextualBody'),
            'm.emote': sdk.getComponent('messages.TextualBody'),
            'm.image': sdk.getComponent('messages.MImageBody'),
            'm.file': sdk.getComponent('messages.MFileBody'),
            'm.audio': sdk.getComponent('messages.MAudioBody'),
            'm.video': sdk.getComponent('messages.MVideoBody'),
        };
        const evTypes = {
            'm.sticker': sdk.getComponent('messages.MStickerBody'),
        };

        const content = this.props.mxEvent.getContent();
        const type = this.props.mxEvent.getType();
        const msgtype = content.msgtype;
        let BodyType = UnknownBody;
        if (!this.props.mxEvent.isRedacted()) {
            // only resolve BodyType if event is not redacted
            if (type && evTypes[type]) {
                BodyType = evTypes[type];
            } else if (msgtype && bodyTypes[msgtype]) {
                BodyType = bodyTypes[msgtype];
            } else if (content.url) {
                // Fallback to MFileBody if there's a content URL
                BodyType = bodyTypes['m.file'];
            }
        }

        return <BodyType
            ref="body" mxEvent={this.props.mxEvent}
            highlights={this.props.highlights}
            highlightLink={this.props.highlightLink}
            showUrlPreview={this.props.showUrlPreview}
            tileShape={this.props.tileShape}
            maxImageHeight={this.props.maxImageHeight}
            onHeightChanged={this.props.onHeightChanged} />;
    },
});
