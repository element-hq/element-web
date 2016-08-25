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

var React = require('react');
var sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'MessageEvent',

    propTypes: {
        /* the MatrixEvent to show */
        mxEvent: React.PropTypes.object.isRequired,

        /* a list of words to highlight */
        highlights: React.PropTypes.array,

        /* link URL for the highlights */
        highlightLink: React.PropTypes.string,

        /* should show URL previews for this event */
        showUrlPreview: React.PropTypes.bool,

        /* callback called when dynamic content in events are loaded */
        onWidgetLoad: React.PropTypes.func,
    },

    getEventTileOps: function() {
        return this.refs.body && this.refs.body.getEventTileOps ? this.refs.body.getEventTileOps() : null;
    },

    render: function() {
        var UnknownBody = sdk.getComponent('messages.UnknownBody');

        var bodyTypes = {
            'm.text': sdk.getComponent('messages.TextualBody'),
            'm.notice': sdk.getComponent('messages.TextualBody'),
            'm.emote': sdk.getComponent('messages.TextualBody'),
            'm.image': sdk.getComponent('messages.MImageBody'),
            'm.file': sdk.getComponent('messages.MFileBody'),
            'm.audio': sdk.getComponent('messages.MAudioBody'),
            'm.video': sdk.getComponent('messages.MVideoBody')
        };

        var content = this.props.mxEvent.getContent();
        var msgtype = content.msgtype;
        var BodyType = UnknownBody;
        if (msgtype && bodyTypes[msgtype]) {
            BodyType = bodyTypes[msgtype];
        } else if (content.url) {
            // Fallback to MFileBody if there's a content URL
            BodyType = bodyTypes['m.file'];
        }

        return <BodyType ref="body" mxEvent={this.props.mxEvent} highlights={this.props.highlights}
                    highlightLink={this.props.highlightLink}
                    showUrlPreview={this.props.showUrlPreview}
                    onWidgetLoad={this.props.onWidgetLoad} />;
    },
});
