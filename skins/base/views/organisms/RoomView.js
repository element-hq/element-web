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
var Modal = require("../../../../src/Modal");
var classNames = require("classnames");
var filesize = require('filesize');
var q = require('q');

var MessageTile = ComponentBroker.get('molecules/MessageTile');
var RoomHeader = ComponentBroker.get('molecules/RoomHeader');
var MessageComposer = ComponentBroker.get('molecules/MessageComposer');
var CallView = ComponentBroker.get("molecules/voip/CallView");
var RoomSettings = ComponentBroker.get("molecules/RoomSettings");
var Notifier = ComponentBroker.get('organisms/Notifier');
var MatrixToolbar = ComponentBroker.get('molecules/MatrixToolbar');
var RoomViewController = require("../../../../src/controllers/organisms/RoomView");

var Loader = require("react-loader");


module.exports = React.createClass({
    displayName: 'RoomView',
    mixins: [RoomViewController],

    onSettingsClick: function() {
        this.setState({editingRoomSettings: true});
    },

    onSaveClick: function() {
        this.setState({
            editingRoomSettings: false,
            uploadingRoomSettings: true,
        });

        var new_name = this.refs.header.getRoomName();
        var new_topic = this.refs.room_settings.getTopic();
        var new_join_rule = this.refs.room_settings.getJoinRules();
        var new_history_visibility = this.refs.room_settings.getHistoryVisibility();
        var new_power_levels = this.refs.room_settings.getPowerLevels();

        this.uploadNewState(
            new_name,
            new_topic,
            new_join_rule,
            new_history_visibility,
            new_power_levels
        );
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
                            <img src="img/typing.png" width="40" height="40" alt=""/>
                            {typingString}
                        </div>
                    );
                }
            }

            var roomEdit = null;

            if (this.state.editingRoomSettings) {
                roomEdit = <RoomSettings ref="room_settings" room={this.state.room} />;
            }

            if (this.state.uploadingRoomSettings) {
                roomEdit = <Loader/>;
            }

            var top_bar;
            if (!Notifier.isEnabled()) {
                top_bar = <MatrixToolbar />;
            }

            return (
                <div className="mx_RoomView">
                    {top_bar}
                    <RoomHeader ref="header" room={this.state.room} editing={this.state.editingRoomSettings}
                        onSettingsClick={this.onSettingsClick} onSaveClick={this.onSaveClick}/>
                    <div className="mx_RoomView_auxPanel">
                        <CallView room={this.state.room}/>
                        { roomEdit }
                    </div>
                    <div ref="messageWrapper" className="mx_RoomView_messagePanel" onScroll={ this.onMessageListScroll }>
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
