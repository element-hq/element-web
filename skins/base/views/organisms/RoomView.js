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

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");

var ComponentBroker = require('../../../../src/ComponentBroker');
var classNames = require("classnames");
var filesize = require('filesize');

var MessageTile = ComponentBroker.get('molecules/MessageTile');
var RoomHeader = ComponentBroker.get('molecules/RoomHeader');
var MessageComposer = ComponentBroker.get('molecules/MessageComposer');
var CallView = ComponentBroker.get("molecules/voip/CallView");
var RoomSettings = ComponentBroker.get("molecules/RoomSettings");

var RoomViewController = require("../../../../src/controllers/organisms/RoomView");

var Loader = require("react-loader");


module.exports = React.createClass({
    displayName: 'RoomView',
    mixins: [RoomViewController],

    onSettingsClick: function() {
        this.setState({editingRoomSettings: true});
    },

    onSaveClick: function() {
        this.setState({editingRoomSettings: false});

        var new_name = this.refs.header.getRoomName();
        var new_topic = this.refs.room_settings.getTopic();
        var new_join_rule = this.refs.room_settings.getJoinRules();
        var new_history_visibility = this.refs.room_settings.getHistoryVisibility();

        var old_name = this.state.room.name;

        var old_topic = this.state.room.currentState.getStateEvents('m.room.topic', '');
        if (old_topic) {
            old_topic = old_topic.getContent().topic;
        } else {
            old_topic = "";
        }

        var old_join_rule = this.state.room.currentState.getStateEvents('m.room.join_rules', '');
        if (old_join_rule) {
            old_join_rule = old_join_rule.getContent().join_rule;
        } else {
            old_join_rule = "invite";
        }

        var old_history_visibility = this.state.room.currentState.getStateEvents('m.room.history_visibility', '');
        console.log(old_history_visibility);
        if (old_history_visibility) {
            old_history_visibility = old_history_visibility.getContent().history_visibility;
        } else {
            old_history_visibility = "shared";
        }


        if (old_name != new_name && new_name != undefined) {
            MatrixClientPeg.get().setRoomName(this.state.room.roomId, new_name);
        }

        if (old_topic != new_topic && new_topic != undefined) {
            MatrixClientPeg.get().setRoomTopic(this.state.room.roomId, new_topic);
        }

        if (old_join_rule != new_join_rule && new_join_rule != undefined) {
            MatrixClientPeg.get().sendStateEvent(
                this.state.room.roomId, "m.room.join_rules", {
                    join_rule: new_join_rule,
                }, ""
            );
        }

        if (old_history_visibility != new_history_visibility && new_history_visibility != undefined) {
            MatrixClientPeg.get().sendStateEvent(
                this.state.room.roomId, "m.room.history_visibility", {
                    history_visibility: new_history_visibility,
                }, ""
            );
        }
    },

    render: function() {
        if (!this.state.room) {
            return (
                <div />
            );
        }

        var myUserId = MatrixClientPeg.get().credentials.userId;
        if (this.state.room.currentState.members[myUserId].membership == 'invite') {
            if (this.state.joining) {
                return (
                    <div className="mx_RoomView">
                        <Loader />
                    </div>
                );
            } else {
                var inviteEvent = this.state.room.currentState.members[myUserId].events.member.event;
                // XXX: Leaving this intentionally basic for now because invites are about to change totally
                var joinErrorText = this.state.joinError ? "Failed to join room!" : "";
                return (
                    <div className="mx_RoomView">
                        <div className="mx_RoomView_invitePrompt">
                            <div>{inviteEvent.user_id} has invited you to a room</div>
                            <button ref="joinButton" onClick={this.onJoinButtonClicked}>Join</button>
                            <div className="error">{joinErrorText}</div>
                        </div>
                    </div>
                );
            }
        } else {
            var scrollheader_classes = classNames({
                mx_RoomView_scrollheader: true,
                loading: this.state.paginating
            });

            var statusBar = (
                <div />
            );

            if (this.state.upload) {
                var innerProgressStyle = {
                    width: ((this.state.upload.uploadedBytes / this.state.upload.totalBytes) * 100) + '%'
                };
                statusBar = (
                    <div className="mx_RoomView_uploadBar">
                        <span className="mx_RoomView_uploadFilename">Uploading {this.state.upload.fileName}</span>
                        <span className="mx_RoomView_uploadBytes">
                        {filesize(this.state.upload.uploadedBytes)} / {filesize(this.state.upload.totalBytes)}
                        </span>
                        <div className="mx_RoomView_uploadProgressOuter">
                            <div className="mx_RoomView_uploadProgressInner" style={innerProgressStyle}></div>
                        </div>
                    </div>
                );
            } else {
                var typingString = this.getWhoIsTypingString();
                if (typingString) {
                    statusBar = (
                        <div className="mx_RoomView_typingBar">
                            {typingString}
                        </div>
                    );
                }
            }

            var roomEdit = null;

            if (this.state.editingRoomSettings) {
                roomEdit = <RoomSettings ref="room_settings" room={this.state.room} />;
            }

            return (
                <div className="mx_RoomView">
                    <RoomHeader ref="header" room={this.state.room} editing={this.state.editingRoomSettings}
                        onSettingsClick={this.onSettingsClick} onSaveClick={this.onSaveClick}/>
                    <div className="mx_RoomView_auxPanel">
                        <CallView room={this.state.room}/>
                        { roomEdit }
                    </div>
                    <div ref="messageWrapper" className="mx_RoomView_messagePanel" onScroll={this.onMessageListScroll}>
                        <div className="mx_RoomView_messageListWrapper">
                            <div className="mx_RoomView_MessageList" aria-live="polite">
                                <div className={scrollheader_classes}>
                                </div>
                                {this.getEventTiles()}
                            </div>
                        </div>
                    </div>
                    <div className="mx_RoomView_statusArea">
                        <div className="mx_RoomView_statusAreaBox">
                            {statusBar}
                        </div>
                    </div>
                    <MessageComposer room={this.state.room} uploadFile={this.uploadFile} />
                </div>
            );
        }
    },
});
