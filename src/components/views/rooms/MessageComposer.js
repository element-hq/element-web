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

var CallHandler = require('../../../CallHandler');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var Modal = require('../../../Modal');
var sdk = require('../../../index');
var dis = require('../../../dispatcher');

import UserSettingsStore from '../../../UserSettingsStore';


module.exports = React.createClass({
    displayName: 'MessageComposer',

    propTypes: {
        tabComplete: React.PropTypes.any,

        // a callback which is called when the height of the composer is
        // changed due to a change in content.
        onResize: React.PropTypes.func,

        // js-sdk Room object
        room: React.PropTypes.object.isRequired,

        // string representing the current voip call state
        callState: React.PropTypes.string,

        // callback when a file to upload is chosen
        uploadFile: React.PropTypes.func.isRequired,

        // opacity for dynamic UI fading effects
        opacity: React.PropTypes.number,
    },

    onUploadClick: function(ev) {
        if (MatrixClientPeg.get().isGuest()) {
            var NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
            Modal.createDialog(NeedToRegisterDialog, {
                title: "Please Register",
                description: "Guest users can't upload files. Please register to upload."
            });
            return;
        }

        this.refs.uploadInput.click();
    },

    onUploadFileSelected: function(ev) {
        var files = ev.target.files;

        var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        var TintableSvg = sdk.getComponent("elements.TintableSvg");

        var fileList = [];
        for(var i=0; i<files.length; i++) {
            fileList.push(<li>
                <TintableSvg key={i} src="img/files.svg" width="16" height="16" /> {files[i].name}
            </li>);
        }

        Modal.createDialog(QuestionDialog, {
            title: "Upload Files",
            description: (
                <div>
                    <p>Are you sure you want upload the following files?</p>
                    <ul style={{listStyle: 'none', textAlign: 'left'}}>
                        {fileList}
                    </ul>
                </div>
            ),
            onFinished: (shouldUpload) => {
                if(shouldUpload) {
                    // MessageComposer shouldn't have to rely on its parent passing in a callback to upload a file
                    if (files) {
                        for(var i=0; i<files.length; i++) {
                            this.props.uploadFile(files[i]);
                        }
                    }
                }

                this.refs.uploadInput.value = null;
            }
        });
    },

    onHangupClick: function() {
        var call = CallHandler.getCallForRoom(this.props.room.roomId);
        //var call = CallHandler.getAnyActiveCall();
        if (!call) {
            return;
        }
        dis.dispatch({
            action: 'hangup',
            // hangup the call for this room, which may not be the room in props
            // (e.g. conferences which will hangup the 1:1 room instead)
            room_id: call.roomId
        });
    },

    onCallClick: function(ev) {
        dis.dispatch({
            action: 'place_call',
            type: ev.shiftKey ? "screensharing" : "video",
            room_id: this.props.room.roomId
        });
    },

    onVoiceCallClick: function(ev) {
        dis.dispatch({
            action: 'place_call',
            type: 'voice',
            room_id: this.props.room.roomId
        });
    },

    render: function() {
        var me = this.props.room.getMember(MatrixClientPeg.get().credentials.userId);
        var uploadInputStyle = {display: 'none'};
        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        var MessageComposerInput = sdk.getComponent("rooms.MessageComposerInput" +
            (UserSettingsStore.isFeatureEnabled('rich_text_editor') ? "" : "Old"));

        var controls = [];

        controls.push(
            <div key="controls_avatar" className="mx_MessageComposer_avatar">
                <MemberAvatar member={me} width={24} height={24} />
            </div>
        );

        var callButton, videoCallButton, hangupButton;
        if (this.props.callState && this.props.callState !== 'ended') {
            hangupButton =
                <div key="controls_hangup" className="mx_MessageComposer_hangup" onClick={this.onHangupClick}>
                    <img src="img/hangup.svg" alt="Hangup" title="Hangup" width="25" height="26"/>
                </div>;
        }
        else {
            callButton =
                <div key="controls_call" className="mx_MessageComposer_voicecall" onClick={this.onVoiceCallClick} title="Voice call">
                    <TintableSvg src="img/voice.svg" width="16" height="26"/>
                </div>
            videoCallButton =
                <div key="controls_videocall" className="mx_MessageComposer_videocall" onClick={this.onCallClick} title="Video call">
                    <TintableSvg src="img/call.svg" width="30" height="22"/>
                </div>
        }

        var canSendMessages = this.props.room.currentState.maySendMessage(
            MatrixClientPeg.get().credentials.userId);

        if (canSendMessages) {
            // This also currently includes the call buttons. Really we should
            // check separately for whether we can call, but this is slightly
            // complex because of conference calls.
            var uploadButton = (
                <div key="controls_upload" className="mx_MessageComposer_upload"
                        onClick={this.onUploadClick} title="Upload file">
                    <TintableSvg src="img/upload.svg" width="19" height="24"/>
                    <input ref="uploadInput" type="file"
                        style={uploadInputStyle}
                        multiple
                        onChange={this.onUploadFileSelected} />
                </div>
            );

            controls.push(
                <MessageComposerInput key="controls_input" tabComplete={this.props.tabComplete}
                    onResize={this.props.onResize} room={this.props.room} />,
                uploadButton,
                hangupButton,
                callButton,
                videoCallButton
            );
        } else {
            controls.push(
                <div key="controls_error" className="mx_MessageComposer_noperm_error">
                    You do not have permission to post to this room
                </div>
            );
        }

        return (
            <div className="mx_MessageComposer mx_fadable" style={{ opacity: this.props.opacity }}>
                <div className="mx_MessageComposer_wrapper">
                    <div className="mx_MessageComposer_row">
                        {controls}
                    </div>
                </div>
            </div>
        );
    }
});

