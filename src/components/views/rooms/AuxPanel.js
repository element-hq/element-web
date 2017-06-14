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

import React from 'react';
import MatrixClientPeg from "../../../MatrixClientPeg";
import sdk from '../../../index';
import dis from "../../../dispatcher";
import ObjectUtils from '../../../ObjectUtils';
import AppsDrawer from './AppsDrawer';
import  { _t, _tJsx} from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'AuxPanel',

    propTypes: {
        // js-sdk room object
        room: React.PropTypes.object.isRequired,
        userId: React.PropTypes.string.isRequired,
        showApps: React.PropTypes.bool,

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
                      title={_t("Drop File Here")}>
                        <TintableSvg src="img/upload-big.svg" width="45" height="59"/>
                        <br/>
                        {_t("Drop file here to upload")}
                    </div>
                </div>
            );
        }

        let conferenceCallNotification = null;
        if (this.props.displayConfCallNotification) {
            let supportedText = '';
            let joinNode;
            if (!MatrixClientPeg.get().supportsVoip()) {
                supportedText = _t(" (unsupported)");
            } else {
                joinNode = (<span>
                    {_tJsx(
                        "Join as <voiceText>voice</voiceText> or <videoText>video</videoText>.",
                        [/<voiceText>(.*?)<\/voiceText>/, /<videoText>(.*?)<\/videoText>/],
                        [
                            (sub) => <a onClick={(event)=>{ this.onConferenceNotificationClick(event, 'voice');}} href="#">{sub}</a>,
                            (sub) => <a onClick={(event)=>{ this.onConferenceNotificationClick(event, 'video');}} href="#">{sub}</a>,
                        ]
                    )}
                </span>);
            }
            // XXX: the translation here isn't great: appending ' (unsupported)' is likely to not make sense in many languages,
            // but there are translations for this in the languages we do have so I'm leaving it for now.
            conferenceCallNotification = (
                <div className="mx_RoomView_ongoingConfCallNotification">
                    {_t("Ongoing conference call%(supportedText)s.", {supportedText: supportedText})}
                    &nbsp;
                    {joinNode}
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
            appsDrawer = <AppsDrawer ref="appsDrawer"
                room={this.props.room}
                userId={this.props.userId}
                maxHeight={this.props.maxHeight}/>;
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
