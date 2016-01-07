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

'use strict';

var React = require('react');
var sdk = require('../../../index');
var dis = require("../../../dispatcher");
var MatrixClientPeg = require('../../../MatrixClientPeg');

module.exports = React.createClass({
    displayName: 'RoomHeader',

    propTypes: {
        room: React.PropTypes.object,
        editing: React.PropTypes.bool,
        onSettingsClick: React.PropTypes.func,
        onSaveClick: React.PropTypes.func,
        onSearchClick: React.PropTypes.func,
        onLeaveClick: React.PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            editing: false,
            onSettingsClick: function() {},
            onSaveClick: function() {},
        };
    },

    onVideoClick: function(e) {
        dis.dispatch({
            action: 'place_call',
            type: e.shiftKey ? "screensharing" : "video",
            room_id: this.props.room.roomId
        });
    },

    onVoiceClick: function() {
        dis.dispatch({
            action: 'place_call',
            type: "voice",
            room_id: this.props.room.roomId
        });
    },

    onNameChange: function(new_name) {
        if (this.props.room.name != new_name && new_name) {
            MatrixClientPeg.get().setRoomName(this.props.room.roomId, new_name);
        }
    },

    getRoomName: function() {
        return this.refs.name_edit.value;
    },

    render: function() {
        var EditableText = sdk.getComponent("elements.EditableText");
        var RoomAvatar = sdk.getComponent('avatars.RoomAvatar');
        var TintableSvg = sdk.getComponent("elements.TintableSvg");

        var header;
        if (this.props.simpleHeader) {
            var cancel;
            if (this.props.onCancelClick) {
                cancel = <img className="mx_RoomHeader_simpleHeaderCancel" src="img/cancel-black.png" onClick={ this.props.onCancelClick } alt="Close" width="18" height="18"/>
            }
            header =
                <div className="mx_RoomHeader_wrapper">
                    <div className="mx_RoomHeader_simpleHeader">
                        { this.props.simpleHeader }
                        { cancel }
                    </div>
                </div>
        }
        else {
            var topic = this.props.room.currentState.getStateEvents('m.room.topic', '');

            var name = null;
            var searchStatus = null;
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
                // <EditableText label={this.props.room.name} initialValue={actual_name} placeHolder="Name" onValueChanged={this.onNameChange} />

                var searchStatus;
                // don't display the search count until the search completes and
                // gives us a valid (possibly zero) searchCount.
                if (this.props.searchInfo && this.props.searchInfo.searchCount !== undefined && this.props.searchInfo.searchCount !== null) {
                    searchStatus = <div className="mx_RoomHeader_searchStatus">&nbsp;(~{ this.props.searchInfo.searchCount } results)</div>;
                }

                name =
                    <div className="mx_RoomHeader_name" onClick={this.props.onSettingsClick}>
                        <div className="mx_RoomHeader_nametext" title={ this.props.room.name }>{ this.props.room.name }</div>
                        { searchStatus }
                        <div className="mx_RoomHeader_settingsButton" title="Settings">
                            <TintableSvg src="img/settings.svg" width="12" height="12"/>
                        </div>
                    </div>
                if (topic) topic_el = <div className="mx_RoomHeader_topic" title={topic.getContent().topic}>{ topic.getContent().topic }</div>;
            }

            var roomAvatar = null;
            if (this.props.room) {
                roomAvatar = (
                    <RoomAvatar room={this.props.room} width="48" height="48" />
                );
            }

            var leave_button;
            if (this.props.onLeaveClick) {
                leave_button =
                    <div className="mx_RoomHeader_button mx_RoomHeader_leaveButton" onClick={this.props.onLeaveClick} title="Leave room">
                        <TintableSvg src="img/leave.svg" width="26" height="20"/>
                    </div>;
            }

            var forget_button;
            if (this.props.onForgetClick) {
                forget_button =
                    <div className="mx_RoomHeader_button mx_RoomHeader_leaveButton" onClick={this.props.onForgetClick} title="Forget room">
                        <TintableSvg src="img/leave.svg" width="26" height="20"/>
                    </div>;
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
                    {cancel_button}
                    {save_button}
                    <div className="mx_RoomHeader_rightRow">
                        { forget_button }
                        { leave_button }
                        <div className="mx_RoomHeader_button" onClick={this.props.onSearchClick} title="Search">
                            <TintableSvg src="img/search.svg" width="21" height="19"/>
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
