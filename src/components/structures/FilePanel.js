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
var MatrixClientPeg = require("../../MatrixClientPeg");
var dis = require("../../dispatcher");

/*
 * Component which shows the filtered file using a TimelinePanel
 */
var FilePanel = React.createClass({
    displayName: 'FilePanel',

    // this has to be a proper method rather than an unnamed function,
    // otherwise react calls it with null on each update.
    _gatherTimelinePanelRef: function(r) {
        this.refs.messagePanel = r;
    },

    render: function() {
        // wrap a TimelinePanel with the jump-to-event bits turned off.

        var room = MatrixClientPeg.get().getRoom(this.props.roomId);

        // <TimelinePanel ref={this._gatherTimelinePanelRef}
        //     room={this.state.room}
        //     hidden={hideMessagePanel}
        //     highlightedEventId={this.props.highlightedEventId}
        //     eventId={this.props.eventId}
        //     eventPixelOffset={this.props.eventPixelOffset}
        //     onScroll={ this.onMessageListScroll }
        //     onReadMarkerUpdated={ this._updateTopUnreadMessagesBar }
        //     showUrlPreview = { this.state.showUrlPreview }
        //     opacity={ this.props.opacity }

        return (
            <TimelinePanel ref={this._gatherTimelinePanelRef}
                room={this.state.room}
                showUrlPreview = { false }
                opacity={ this.props.opacity }
            />
        );
    },
});

module.exports = NotificationPanel;
