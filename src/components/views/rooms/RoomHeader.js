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
var MatrixClientPeg = require('../../../MatrixClientPeg');
var Modal = require("../../../Modal");
var dis = require("../../../dispatcher");
var rate_limited_func = require('../../../ratelimitedfunc');

var linkify = require('linkifyjs');
var linkifyElement = require('linkifyjs/element');
var linkifyMatrix = require('../../../linkify-matrix');
import AccessibleButton from '../elements/AccessibleButton';
import {CancelButton} from './SimpleRoomHeader';

linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'RoomHeader',

    propTypes: {
        room: React.PropTypes.object,
        oobData: React.PropTypes.object,
        editing: React.PropTypes.bool,
        saving: React.PropTypes.bool,
        collapsedRhs: React.PropTypes.bool,
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

    componentDidMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("RoomState.events", this._onRoomStateEvents);

        // When a room name occurs, RoomState.events is fired *before*
        // room.name is updated. So we have to listen to Room.name as well as
        // RoomState.events.
        if (this.props.room) {
            this.props.room.on("Room.name", this._onRoomNameChange);
        }
    },

    componentDidUpdate: function() {
        if (this.refs.topic) {
            linkifyElement(this.refs.topic, linkifyMatrix.options);
        }
    },

    componentWillUnmount: function() {
        if (this.props.room) {
            this.props.room.removeListener("Room.name", this._onRoomNameChange);
        }
        var cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomState.events", this._onRoomStateEvents);
        }
    },

    _onRoomStateEvents: function(event, state) {
        if (!this.props.room || event.getRoomId() != this.props.room.roomId) {
            return;
        }

        // redisplay the room name, topic, etc.
        this._rateLimitedUpdate();
    },

    _rateLimitedUpdate: new rate_limited_func(function() {
        this.forceUpdate();
    }, 500),

    _onRoomNameChange: function(room) {
        this.forceUpdate();
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
            console.error("Failed to set avatar: " + errMsg);
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: "Failed to set avatar.",
            });
        }).done();
    },

    onShowRhsClick: function(ev) {
        dis.dispatch({ action: 'show_right_panel' });
    },

    /**
     * After editing the settings, get the new name for the room
     *
     * Returns undefined if we didn't let the user edit the room name
     */
    getEditedName: function() {
        var newName;
        if (this.refs.nameEditor) {
            newName = this.refs.nameEditor.getRoomName();
        }
        return newName;
    },

    /**
     * After editing the settings, get the new topic for the room
     *
     * Returns undefined if we didn't let the user edit the room topic
     */
    getEditedTopic: function() {
        var newTopic;
        if (this.refs.topicEditor) {
            newTopic = this.refs.topicEditor.getTopic();
        }
        return newTopic;
    },

    render: function() {
        var RoomAvatar = sdk.getComponent("avatars.RoomAvatar");
        var ChangeAvatar = sdk.getComponent("settings.ChangeAvatar");
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        const EmojiText = sdk.getComponent('elements.EmojiText');

        var header;
        var name = null;
        var searchStatus = null;
        var topic_el = null;
        var cancel_button = null;
        var spinner = null;
        var save_button = null;
        var settings_button = null;
        if (this.props.editing) {

            // calculate permissions.  XXX: this should be done on mount or something
            var user_id = MatrixClientPeg.get().credentials.userId;

            var can_set_room_name = this.props.room.currentState.maySendStateEvent(
                'm.room.name', user_id
            );
            var can_set_room_avatar = this.props.room.currentState.maySendStateEvent(
                'm.room.avatar', user_id
            );
            var can_set_room_topic = this.props.room.currentState.maySendStateEvent(
                'm.room.topic', user_id
            );
            var can_set_room_name = this.props.room.currentState.maySendStateEvent(
                'm.room.name', user_id
            );

            save_button = <AccessibleButton className="mx_RoomHeader_textButton" onClick={this.props.onSaveClick}>Save</AccessibleButton>;
        }

        if (this.props.onCancelClick) {
            cancel_button = <CancelButton onClick={this.props.onCancelClick}/>;
        }

        if (this.props.saving) {
            var Spinner = sdk.getComponent("elements.Spinner");
            spinner = <div className="mx_RoomHeader_spinner"><Spinner/></div>;
        }

        if (can_set_room_name) {
            var RoomNameEditor = sdk.getComponent("rooms.RoomNameEditor");
            name = <RoomNameEditor ref="nameEditor" room={this.props.room} />;
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
                    <EmojiText element="div" className={ "mx_RoomHeader_nametext " + (settingsHint ? "mx_RoomHeader_settingsHint" : "") } title={ roomName }>{roomName}</EmojiText>
                    { searchStatus }
                </div>;
        }

        if (can_set_room_topic) {
            var RoomTopicEditor = sdk.getComponent("rooms.RoomTopicEditor");
            topic_el = <RoomTopicEditor ref="topicEditor" room={this.props.room} />;
        } else {
            var topic;
            if (this.props.room) {
                var ev = this.props.room.currentState.getStateEvents('m.room.topic', '');
                if (ev) {
                    topic = ev.getContent().topic;
                }
            }
            if (topic) {
                topic_el = <div className="mx_RoomHeader_topic" ref="topic" title={ topic }>{ topic }</div>;
            }
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

        var settings_button;
        if (this.props.onSettingsClick) {
            settings_button =
                <AccessibleButton className="mx_RoomHeader_button" onClick={this.props.onSettingsClick} title="Settings">
                    <TintableSvg src="img/icons-settings-room.svg" width="16" height="16"/>
                </AccessibleButton>;
        }

//        var leave_button;
//        if (this.props.onLeaveClick) {
//            leave_button =
//                <div className="mx_RoomHeader_button" onClick={this.props.onLeaveClick} title="Leave room">
//                    <TintableSvg src="img/leave.svg" width="26" height="20"/>
//                </div>;
//        }

        var forget_button;
        if (this.props.onForgetClick) {
            forget_button =
                <AccessibleButton className="mx_RoomHeader_button" onClick={this.props.onForgetClick} title="Forget room">
                    <TintableSvg src="img/leave.svg" width="26" height="20"/>
                </AccessibleButton>;
        }

        var rightPanel_buttons;
        if (this.props.collapsedRhs) {
            rightPanel_buttons =
                <AccessibleButton className="mx_RoomHeader_button" onClick={this.onShowRhsClick} title="Show panel">
                    <TintableSvg src="img/maximise.svg" width="10" height="16"/>
                </AccessibleButton>;
        }

        var right_row;
        if (!this.props.editing) {
            right_row =
                <div className="mx_RoomHeader_rightRow">
                    { settings_button }
                    { forget_button }
                    <AccessibleButton className="mx_RoomHeader_button" onClick={this.props.onSearchClick} title="Search">
                        <TintableSvg src="img/icons-search.svg" width="35" height="35"/>
                    </AccessibleButton>
                    { rightPanel_buttons }
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
                {spinner}
                {save_button}
                {cancel_button}
                {right_row}
            </div>;

        return (
            <div className={ "mx_RoomHeader " + (this.props.editing ? "mx_RoomHeader_editing" : "") }>
                { header }
            </div>
        );
    },
});
