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
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher')

var CallHandler = require('matrix-react-sdk/lib/CallHandler');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var RoomHeaderController = require('matrix-react-sdk/lib/controllers/molecules/RoomHeader')

module.exports = React.createClass({
    displayName: 'RoomHeader',
    mixins: [RoomHeaderController],

    onNameChange: function(new_name) {
        if (this.props.room.name != new_name && new_name) {
            MatrixClientPeg.get().setRoomName(this.props.room.roomId, new_name);
        }
    },

    getRoomName: function() {
        return this.refs.name_edit.getDOMNode().value;
    },

    onFullscreenClick: function() {
        dis.dispatch({action: 'video_fullscreen', fullscreen: true}, true);
    },

    render: function() {
        var EditableText = sdk.getComponent("atoms.EditableText");
        var RoomAvatar = sdk.getComponent('atoms.RoomAvatar');

        var header;
        if (this.props.simpleHeader) {
            header =
                <div className="mx_RoomHeader_wrapper">
                    <div className="mx_RoomHeader_simpleHeader">
                        { this.props.simpleHeader }
                    </div>
                </div>
        }
        else {
            var topic = this.props.room.currentState.getStateEvents('m.room.topic', '');

            var call_buttons;
            var zoom_button;
            if (this.state && this.state.call_state != 'ended') {
                var muteVideoButton;
                var activeCall = (
                    CallHandler.getCallForRoom(this.props.room.roomId)
                );
/*                
                if (activeCall && activeCall.type === "video") {
                    muteVideoButton = (
                        <div className="mx_RoomHeader_textButton mx_RoomHeader_voipButton"
                                onClick={this.onMuteVideoClick}>
                            {
                                (activeCall.isLocalVideoMuted() ?
                                    "Unmute" : "Mute") + " video"
                            }
                        </div>
                    );
                }
                        {muteVideoButton}
                        <div className="mx_RoomHeader_textButton mx_RoomHeader_voipButton"
                                onClick={this.onMuteAudioClick}>
                            {
                                (activeCall && activeCall.isMicrophoneMuted() ?
                                    "Unmute" : "Mute") + " audio"
                            }
                        </div>
*/                

                call_buttons = (
                    <div className="mx_RoomHeader_textButton"
                            onClick={this.onHangupClick}>
                        End call
                    </div>
                );
            }

            var name = null;
            var topic_el = null;
            var cancel_button = null;
            var save_button = null;
            var settings_button = null;
            var actual_name = this.props.room.currentState.getStateEvents('m.room.name', '');
            if (actual_name) actual_name = actual_name.getContent().name;
            if (this.props.editing) {
                name = 
                    <div className="mx_RoomHeader_nameEditing">
                        <input className="mx_RoomHeader_nameInput" type="text" defaultValue={actual_name} placeholder="Name" ref="name_edit"/>
                    </div>
                // if (topic) topic_el = <div className="mx_RoomHeader_topic"><textarea>{ topic.getContent().topic }</textarea></div>
                cancel_button = <div className="mx_RoomHeader_textButton" onClick={this.props.onCancelClick}>Cancel</div>
                save_button = <div className="mx_RoomHeader_textButton" onClick={this.props.onSaveClick}>Save Changes</div>
            } else {
                name =
                    <div className="mx_RoomHeader_name">
                        <EditableText label={this.props.room.name} initialValue={actual_name} placeHolder="Name" onValueChanged={this.onNameChange} />
                    </div>
                if (topic) topic_el = <div className="mx_RoomHeader_topic" title={topic.getContent().topic}>{ topic.getContent().topic }</div>;
                settings_button = (
                    <div className="mx_RoomHeader_button" onClick={this.props.onSettingsClick}>
                        <img src="img/settings.png" width="32" height="32"/>
                    </div>
                );
            }

            var roomAvatar = null;
            if (this.props.room) {
                roomAvatar = (
                    <RoomAvatar room={this.props.room} width="48" height="48" />
                );
            }

            if (activeCall && activeCall.type == "video") {
                zoom_button = (
                    <div className="mx_RoomHeader_button" onClick={this.onFullscreenClick}>
                        <img src="img/zoom.png" title="Fullscreen" alt="Fullscreen" width="32" height="32" style={{ 'marginTop': '3px' }}/>
                    </div>
                );
            }

            header =
                <div className="mx_RoomHeader_wrapper">
                    <div className="mx_RoomHeader_leftRow">
                        <div className="mx_RoomHeader_avatar">
                            { roomAvatar }
                        </div>
                        <div className="mx_RoomHeader_info">
                            { name }
                            { topic_el }
                        </div>
                    </div>
                    {call_buttons}
                    {cancel_button}
                    {save_button}
                    <div className="mx_RoomHeader_rightRow">
                        { settings_button }
                        { zoom_button }
                        <div className="mx_RoomHeader_button mx_RoomHeader_search">
                            <img src="img/search.png" title="Search" alt="Search" width="32" height="32"/>
                        </div>
                        <div className="mx_RoomHeader_button mx_RoomHeader_video" onClick={activeCall && activeCall.type === "video" ? this.onMuteVideoClick : this.onVideoClick}>
                            <img src="img/video.png" title="Video call" alt="Video call" width="32" height="32"/>
                        </div>
                        <div className="mx_RoomHeader_button mx_RoomHeader_voice" onClick={activeCall ? this.onMuteAudioClick : this.onVoiceClick}>
                            <img src="img/voip.png" title="VoIP call" alt="VoIP call" width="32" height="32"/>
                        </div>
                    </div>
                </div>
        }

        return (
            <div className="mx_RoomHeader">
                { header }
            </div>
        );
    },
});
