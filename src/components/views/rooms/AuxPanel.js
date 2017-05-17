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

const React = require('react');
const MatrixClientPeg = require("../../../MatrixClientPeg");
const sdk = require('../../../index');
const dis = require("../../../dispatcher");
const ObjectUtils = require('../../../ObjectUtils');
const AppsDrawer = require('./AppsDrawer');

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
        const CallView = sdk.getComponent("voip.CallView");
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        let fileDropTarget = null;
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

        let conferenceCallNotification = null;
        if (this.props.displayConfCallNotification) {
            let supportedText;
            let joinText;
            if (!MatrixClientPeg.get().supportsVoip()) {
                supportedText = " (unsupported)";
            } else {
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

        const callView = (
            <CallView ref="callView" room={this.props.room}
                ConferenceHandler={this.props.conferenceHandler}
                onResize={this.props.onResize}
                maxVideoHeight={this.props.maxHeight}
            />
        );

        let appsDrawer = null;
        if(this.props.showApps) {
            appsDrawer = <AppsDrawer ref="appsDrawer" room={this.props.room} />;
        }

        return (
            <div className="mx_RoomView_auxPanel" style={{maxHeight: this.props.maxHeight}} >
                { appsDrawer }
                { fileDropTarget }
                { callView }
                { conferenceCallNotification }
                { this.props.children }
            </div>
        );
    },
});
