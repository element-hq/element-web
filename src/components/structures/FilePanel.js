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

var Matrix = require("matrix-js-sdk");
var sdk = require('../../index');
var MatrixClientPeg = require("../../MatrixClientPeg");
var dis = require("../../dispatcher");

/*
 * Component which shows the filtered file using a TimelinePanel
 */
var FilePanel = React.createClass({
    displayName: 'FilePanel',

    propTypes: {
        roomId: React.PropTypes.string.isRequired,
    },

    getInitialState: function() {
        return {
            room: MatrixClientPeg.get().getRoom(this.props.roomId),
            timelineSet: null,
        }
    },

    componentWillMount: function() {
        if (this.state.room) {
            var client = MatrixClientPeg.get();
            var filter = new Matrix.Filter(client.credentials.userId);
            filter.setDefinition(
                {
                    "room": {
                        "timeline": {
                            "contains_url": true
                        },
                    }
                }
            );

            client.getOrCreateFilter("FILTER_FILES_" + client.credentials.userId, filter).then(
                (filterId)=>{
                    filter.filterId = filterId;
                    var timelineSet = this.state.room.getOrCreateFilteredTimelineSet(filter);
                    this.setState({ timelineSet: timelineSet });
                },
                (error)=>{
                    console.error("Failed to get or create file panel filter", error);
                }
            );
        }
        else {
            console.error("Failed to add filtered timelineSet for FilePanel as no room!");
        }
    },

    // this has to be a proper method rather than an unnamed function,
    // otherwise react calls it with null on each update.
    _gatherTimelinePanelRef: function(r) {
        //this.refs.messagePanel = r;
    },

    render: function() {
        // wrap a TimelinePanel with the jump-to-event bits turned off.
        var TimelinePanel = sdk.getComponent("structures.TimelinePanel");
        var Loader = sdk.getComponent("elements.Spinner");

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

        if (this.state.timelineSet) {
            return (
                <TimelinePanel ref={this._gatherTimelinePanelRef}
                    className="mx_FilePanel"
                    manageReadReceipts={false}
                    manageReadMarkers={false}
                    timelineSet={this.state.timelineSet}
                    showUrlPreview = { false }
                    opacity={ this.props.opacity }
                />
            );
        }
        else {
            return <Loader/>
        }
    },
});

module.exports = FilePanel;
