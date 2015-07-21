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
var ComponentBroker = require('../../../../src/ComponentBroker');

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");
var RoomHeaderController = require("../../../../src/controllers/molecules/RoomHeader");
var EditableText = ComponentBroker.get("atoms/EditableText");

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

    render: function() {

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

            var callButtons;
            if (this.state) {
                switch (this.state.call_state) {
                    case "ringback":
                    case "connected":
                        callButtons = (
                            <div className="mx_RoomHeader_hangupButton" onClick={this.onHangupClick}>
                                End call
                            </div>
                        );
                        break;
                }
            }

            var name = null;
            var topic_el = null;
            var save_button = null;
            var settings_button = null;
            var actual_name = this.props.room.currentState.getStateEvents('m.room.name', '');
            if (actual_name) actual_name = actual_name.getContent().name;
            if (this.props.editing) {
                name = <input type="text" defaultValue={actual_name} placeHolder="Name" ref="name_edit"/>;
                // if (topic) topic_el = <div className="mx_RoomHeader_topic"><textarea>{ topic.getContent().topic }</textarea></div>
                save_button = (
                    <div className="mx_RoomHeader_button"onClick={this.props.onSaveClick}>
                        Save
                    </div>
                );
            } else {
                name = <EditableText label={this.props.room.name} initialValue={actual_name} placeHolder="Name" onValueChanged={this.onNameChange} />;
                if (topic) topic_el = <div className="mx_RoomHeader_topic">{ topic.getContent().topic }</div>;
                settings_button = (
                    <div className="mx_RoomHeader_button" onClick={this.props.onSettingsClick}>
                        <img src="img/settings.png" width="32" height="32"/>
                    </div>
                );
            }

            header =
                <div className="mx_RoomHeader_wrapper">
                    <div className="mx_RoomHeader_leftRow">
                        <div className="mx_RoomHeader_avatar">
                            <img src={ MatrixClientPeg.get().getAvatarUrlForRoom(this.props.room, 48, 48, "crop") } width="48" height="48" alt=""/>
                        </div>
                        <div className="mx_RoomHeader_info">
                            <div className="mx_RoomHeader_name">
                                { name }
                            </div>
                            { topic_el }
                        </div>
                    </div>
                    {callButtons}
                    <div className="mx_RoomHeader_rightRow">
                        { save_button }
                        { settings_button }
                        <div className="mx_RoomHeader_button">
                            <img src="img/search.png" width="32" height="32"/>
                        </div>
                        <div className="mx_RoomHeader_button" onClick={this.onVideoClick}>
                            <img src="img/video.png" width="32" height="32"/>
                        </div>
                        <div className="mx_RoomHeader_button" onClick={this.onVoiceClick}>
                            <img src="img/voip.png" width="32" height="32"/>
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
