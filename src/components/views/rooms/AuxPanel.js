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

var React = require('react');
var MatrixClientPeg = require("../../../MatrixClientPeg");
var sdk = require('../../../index');
var dis = require("../../../dispatcher");
var ObjectUtils = require('../../../ObjectUtils');

module.exports = React.createClass({
    displayName: 'AuxPanel',

    propTypes: {
        // js-sdk room object
        room: React.PropTypes.object.isRequired,

        // Conference Handler implementation
        conferenceHandler: React.PropTypes.object,

        // set to true to show the file drop target
        draggingFile: React.PropTypes.bool,

        // set to true to show the 'active conf call' banner
        displayConfCallNotification: React.PropTypes.bool,

        // maxHeight attribute for the aux panel and the video
        // therein
        maxHeight: React.PropTypes.number,

        // a callback which is called when the content of the aux panel changes
        // content in a way that is likely to make it change size.
        onResize: React.PropTypes.func,
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        return (!ObjectUtils.shallowEqual(this.props, nextProps) ||
                !ObjectUtils.shallowEqual(this.state, nextState));
    },

    componentDidUpdate: function(prevProps, prevState) {
        // most changes are likely to cause a resize
        if (this.props.onResize) {
            this.props.onResize();
        }
    },

    onConferenceNotificationClick: function(ev, type) {
        dis.dispatch({
            action: 'place_call',
            type: type,
            room_id: this.props.room.roomId,
        });
        ev.stopPropagation();
        ev.preventDefault();
    },

    render: function() {
        var CallView = sdk.getComponent("voip.CallView");
        var TintableSvg = sdk.getComponent("elements.TintableSvg");

        var fileDropTarget = null;
        if (this.props.draggingFile) {
            fileDropTarget = (
                <div className="mx_RoomView_fileDropTarget">
                    <div className="mx_RoomView_fileDropTargetLabel"
                      title="Drop File Here">
                        <TintableSvg src="img/upload-big.svg" width="45" height="59"/>
                        <br/>
                        Drop file here to upload
                    </div>
                </div>
            );
        }

        var conferenceCallNotification = null;
        if (this.props.displayConfCallNotification) {
            var supportedText, joinText;
            if (!MatrixClientPeg.get().supportsVoip()) {
                supportedText = " (unsupported)";
            }
            else {
                joinText = (<span>
                    Join as <a onClick={(event)=>{ this.onConferenceNotificationClick(event, 'voice');}}
                               href="#">voice</a> or <a onClick={(event)=>{ this.onConferenceNotificationClick(event, 'video'); }}
                               href="#">video</a>.
                </span>);

            }
            conferenceCallNotification = (
                <div className="mx_RoomView_ongoingConfCallNotification">
                    Ongoing conference call{ supportedText }. { joinText }
                </div>
            );
        }

        var callView = (
            <CallView ref="callView" room={this.props.room}
                ConferenceHandler={this.props.conferenceHandler}
                onResize={this.props.onResize}
                maxVideoHeight={this.props.maxHeight}
            />
        );

        return (
            <div className="mx_RoomView_auxPanel" style={{maxHeight: this.props.maxHeight}} >
                { fileDropTarget }
                { callView }
                { conferenceCallNotification }
                { this.props.children }
            </div>
        );
    },
});
