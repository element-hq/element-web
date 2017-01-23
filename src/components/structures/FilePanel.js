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
            timelineSet: null,
        };
    },

    componentWillMount: function() {
        this.updateTimelineSet(this.props.roomId);
    },

    componentWillReceiveProps: function(nextProps) {
        if (nextProps.roomId !== this.props.roomId) {
            // otherwise we race between re-rendering the TimelinePanel and setting the new timelineSet.
            //
            // FIXME: this race only happens because of the promise returned by getOrCreateFilter().
            // We should only need to create the containsUrl filter once per login session, so in practice
            // it shouldn't be being done here at all.  Then we could just update the timelineSet directly
            // without resetting it first, and speed up room-change.
            this.setState({ timelineSet: null });
            this.updateTimelineSet(nextProps.roomId);
        }
    },

    updateTimelineSet: function(roomId) {
        var client = MatrixClientPeg.get();
        var room = client.getRoom(roomId);

        if (room) {
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

            // FIXME: we shouldn't be doing this every time we change room - see comment above.
            client.getOrCreateFilter("FILTER_FILES_" + client.credentials.userId, filter).then(
                (filterId)=>{
                    filter.filterId = filterId;
                    var timelineSet = room.getOrCreateFilteredTimelineSet(filter);
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

    render: function() {
        // wrap a TimelinePanel with the jump-to-event bits turned off.
        var TimelinePanel = sdk.getComponent("structures.TimelinePanel");
        var Loader = sdk.getComponent("elements.Spinner");

        if (this.state.timelineSet) {
            // console.log("rendering TimelinePanel for timelineSet " + this.state.timelineSet.room.roomId + " " +
            //             "(" + this.state.timelineSet._timelines.join(", ") + ")" + " with key " + this.props.roomId);
            return (
                <TimelinePanel key={"filepanel_" + this.props.roomId}
                    className="mx_FilePanel"
                    manageReadReceipts={false}
                    manageReadMarkers={false}
                    timelineSet={this.state.timelineSet}
                    showUrlPreview = { false }
                    tileShape="file_grid"
                    opacity={ this.props.opacity }
                />
            );
        }
        else {
            return (
                <div className="mx_FilePanel">
                    <Loader/>
                </div>
            );
        }
    },
});

module.exports = FilePanel;
