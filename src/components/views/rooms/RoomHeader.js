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
var Modal = require("../../../Modal");

var linkify = require('linkifyjs');
var linkifyElement = require('linkifyjs/element');
var linkifyMatrix = require('../../../linkify-matrix');

linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'RoomHeader',

    propTypes: {
        room: React.PropTypes.object,
        oobData: React.PropTypes.object,
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

    componentWillReceiveProps: function(newProps) {
        if (newProps.editing) {
            var topic = this.props.room.currentState.getStateEvents('m.room.topic', '');
            var name = this.props.room.currentState.getStateEvents('m.room.name', '');

            this.setState({
                name: name ? name.getContent().name : '',
                defaultName: this.props.room.getDefaultRoomName(MatrixClientPeg.get().credentials.userId),
                topic: topic ? topic.getContent().topic : '',
            });
        }
    },

    componentDidUpdate: function() {
        if (this.refs.topic) {
            linkifyElement(this.refs.topic, linkifyMatrix.options);
        }
    },

    onNameChanged: function(value) {
        this.setState({ name : value });
    },

    onTopicChanged: function(value) {
        this.setState({ topic : value });
    },

    onAvatarPickerClick: function(ev) {
        if (this.refs.file_label) {
            this.refs.file_label.click();
        }
    },

    onAvatarSelected: function(ev) {
        var self = this;
        var changeAvatar = this.refs.changeAvatar;
        if (!changeAvatar) {
            console.error("No ChangeAvatar found to upload image to!");
            return;
        }
        changeAvatar.onFileSelected(ev).catch(function(err) {
            var errMsg = (typeof err === "string") ? err : (err.error || "");
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: "Failed to set avatar. " + errMsg
            });
        }).done();
    },    

    getRoomName: function() {
        return this.state.name;
    },

    getTopic: function() {
        return this.state.topic;
    },

    render: function() {
        var EditableText = sdk.getComponent("elements.EditableText");
        var RoomAvatar = sdk.getComponent("avatars.RoomAvatar");
        var ChangeAvatar = sdk.getComponent("settings.ChangeAvatar");
        var TintableSvg = sdk.getComponent("elements.TintableSvg");

        var header;
        if (this.props.simpleHeader) {
            var cancel;
            if (this.props.onCancelClick) {
                cancel = <img className="mx_RoomHeader_simpleHeaderCancel" src="img/cancel.svg" onClick={ this.props.onCancelClick } alt="Close" width="18" height="18"/>
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
            var name = null;
            var searchStatus = null;
            var topic_el = null;
            var cancel_button = null;
            var save_button = null;
            var settings_button = null;
            if (this.props.editing) {

                // calculate permissions.  XXX: this should be done on mount or something, and factored out with RoomSettings
                var power_levels = this.props.room.currentState.getStateEvents('m.room.power_levels', '');
                var events_levels = (power_levels ? power_levels.events : {}) || {};
                var user_id = MatrixClientPeg.get().credentials.userId;

                if (power_levels) {
                    power_levels = power_levels.getContent();
                    var default_user_level = parseInt(power_levels.users_default || 0);
                    var user_levels = power_levels.users || {};
                    var current_user_level = user_levels[user_id];
                    if (current_user_level == undefined) current_user_level = default_user_level;
                } else {
                    var default_user_level = 0;
                    var user_levels = [];
                    var current_user_level = 0;
                }
                var state_default = parseInt((power_levels ? power_levels.state_default : 0) || 0);

                var room_avatar_level = state_default;
                if (events_levels['m.room.avatar'] !== undefined) {
                    room_avatar_level = events_levels['m.room.avatar'];
                }
                var can_set_room_avatar = current_user_level >= room_avatar_level;

                var room_name_level = state_default;
                if (events_levels['m.room.name'] !== undefined) {
                    room_name_level = events_levels['m.room.name'];
                }
                var can_set_room_name = current_user_level >= room_name_level;

                var room_topic_level = state_default;
                if (events_levels['m.room.topic'] !== undefined) {
                    room_topic_level = events_levels['m.room.topic'];
                }
                var can_set_room_topic = current_user_level >= room_topic_level;

                var placeholderName = "Unnamed Room";
                if (this.state.defaultName && this.state.defaultName !== 'Empty room') {
                    placeholderName += " (" + this.state.defaultName + ")";
                }

                save_button = <div className="mx_RoomHeader_textButton" onClick={this.props.onSaveClick}>Save</div>
                cancel_button = <div className="mx_RoomHeader_cancelButton" onClick={this.props.onCancelClick}><img src="img/cancel.svg" width="18" height="18" alt="Cancel"/> </div>
            }

            if (can_set_room_name) {
                name =
                    <div className="mx_RoomHeader_name">
                        <EditableText
                             className="mx_RoomHeader_nametext mx_RoomHeader_editable"
                             placeholderClassName="mx_RoomHeader_placeholder"
                             placeholder={ placeholderName }
                             blurToCancel={ false }
                             onValueChanged={ this.onNameChanged }
                             initialValue={ this.state.name }/>
                    </div>
            }
            else {
                var searchStatus;
                // don't display the search count until the search completes and
                // gives us a valid (possibly zero) searchCount.
                if (this.props.searchInfo && this.props.searchInfo.searchCount !== undefined && this.props.searchInfo.searchCount !== null) {
                    searchStatus = <div className="mx_RoomHeader_searchStatus">&nbsp;(~{ this.props.searchInfo.searchCount } results)</div>;
                }

                // XXX: this is a bit inefficient - we could just compare room.name for 'Empty room'...
                var settingsHint = false;
                var members = this.props.room ? this.props.room.getJoinedMembers() : undefined;
                if (members) {
                    if (members.length === 1 && members[0].userId === MatrixClientPeg.get().credentials.userId) {
                        var name = this.props.room.currentState.getStateEvents('m.room.name', '');
                        if (!name || !name.getContent().name) {
                            settingsHint = true;
                        }
                    }
                }

                var roomName = 'Join Room';
                if (this.props.oobData && this.props.oobData.name) {
                    roomName = this.props.oobData.name;
                } else if (this.props.room) {
                    roomName = this.props.room.name;
                }

                name =
                    <div className="mx_RoomHeader_name" onClick={this.props.onSettingsClick}>
                        <div className={ "mx_RoomHeader_nametext " + (settingsHint ? "mx_RoomHeader_settingsHint" : "") } title={ roomName }>{ roomName }</div>
                        { searchStatus }
                        <div className="mx_RoomHeader_settingsButton" title="Settings">
                            <TintableSvg src="img/settings.svg" width="12" height="12"/>
                        </div>
                    </div>
            }

            if (can_set_room_topic) {
                topic_el =
                    <EditableText 
                         className="mx_RoomHeader_topic mx_RoomHeader_editable"
                         placeholderClassName="mx_RoomHeader_placeholder"
                         placeholder="Add a topic"
                         blurToCancel={ false }
                         onValueChanged={ this.onTopicChanged }
                         initialValue={ this.state.topic }/>
            } else {
                var topic = this.props.room ? this.props.room.currentState.getStateEvents('m.room.topic', '') : '';
                if (topic) topic_el = <div className="mx_RoomHeader_topic" ref="topic" title={ topic.getContent().topic }>{ topic.getContent().topic }</div>;
            }

            var roomAvatar = null;
            if (can_set_room_avatar) {
                roomAvatar = (
                    <div className="mx_RoomHeader_avatarPicker">
                        <div onClick={ this.onAvatarPickerClick }>
                            <ChangeAvatar ref="changeAvatar" room={this.props.room} showUploadSection={false} width={48} height={48} />
                        </div>
                        <div className="mx_RoomHeader_avatarPicker_edit">
                            <label htmlFor="avatarInput" ref="file_label">
                                <img src="img/camera.svg"
                                    alt="Upload avatar" title="Upload avatar"
                                    width="17" height="15" />
                            </label>
                            <input id="avatarInput" type="file" onChange={ this.onAvatarSelected }/>
                        </div>
                    </div>
                );
            }
            else if (this.props.room || (this.props.oobData && this.props.oobData.name)) {
                roomAvatar = (
                    <div onClick={this.props.onSettingsClick}>
                        <RoomAvatar room={this.props.room} width={48} height={48} oobData={this.props.oobData} />
                    </div>
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

            var right_row;
            if (!this.props.editing) {
                right_row = 
                    <div className="mx_RoomHeader_rightRow">
                        { forget_button }
                        { leave_button }
                        <div className="mx_RoomHeader_button" onClick={this.props.onSearchClick} title="Search">
                            <TintableSvg src="img/search.svg" width="21" height="19"/>
                        </div>
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
                    {save_button}
                    {cancel_button}
                    {right_row}
                </div>
        }

        return (
            <div className={ "mx_RoomHeader " + (this.props.editing ? "mx_RoomHeader_editing" : "") }>
                { header }
            </div>
        );
    },
});
