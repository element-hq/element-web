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

var React = require('react');

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var MessageComposerController = require('matrix-react-sdk/lib/controllers/molecules/MessageComposer')

var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher')

module.exports = React.createClass({
    displayName: 'MessageComposer',
    mixins: [MessageComposerController],

    onInputClick: function(ev) {
        this.refs.textarea.focus();
    },

    onUploadClick: function(ev) {
        this.refs.uploadInput.click();
    },

    onUploadFileSelected: function(ev) {
        var files = ev.target.files;
        // MessageComposer shouldn't have to rely on it's parent passing in a callback to upload a file
        if (files && files.length > 0) {
            this.props.uploadFile(files[0]);
        }
        this.refs.uploadInput.value = null;
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
        return (
            <div className="mx_MessageComposer">
                <div className="mx_MessageComposer_wrapper">
                    <div className="mx_MessageComposer_row">
                        <div className="mx_MessageComposer_avatar">
                            <MemberAvatar member={me} width={24} height={24} />
                        </div>
                        <div className="mx_MessageComposer_input" onClick={ this.onInputClick }>
                            <textarea ref="textarea" rows="1" onKeyDown={this.onKeyDown} onKeyUp={this.onKeyUp} placeholder="Type a message..." />
                        </div>
                        <div className="mx_MessageComposer_upload" onClick={this.onUploadClick}>
                            <img src="img/upload.png" alt="Upload file" title="Upload file" width="17" height="22"/>
                            <input type="file" style={uploadInputStyle} ref="uploadInput" onChange={this.onUploadFileSelected} />
                        </div>
                        <div className="mx_MessageComposer_voicecall" onClick={this.onVoiceCallClick}>
                            <img src="img/voice.png" alt="Voice call" title="Voice call" width="16" height="26"/>
                        </div>
                        <div className="mx_MessageComposer_videocall" onClick={this.onCallClick}>
                            <img src="img/call.png" alt="Video call" title="Video call" width="28" height="20"/>
                        </div>
                    </div>
                </div>
            </div>
        );
    },
});

