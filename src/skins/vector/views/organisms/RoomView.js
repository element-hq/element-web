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
var q = require('q');

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

    onCancelClick: function() {
        this.setState(this.getInitialState());
    },

    getUnreadMessagesString: function() {
        if (!this.state.numUnreadMessages) {
            return "";
        }
        return this.state.numUnreadMessages + " new message" + (this.state.numUnreadMessages > 1 ? "s" : "");
    },

    scrollToBottom: function() {
        if (!this.refs.messageWrapper) return;
        var messageWrapper = this.refs.messageWrapper.getDOMNode();
        messageWrapper.scrollTop = messageWrapper.scrollHeight;
    },

    render: function() {
        if (!this.state.room) {
            if (this.props.roomId) {
                return (
                    <div>
                    <button onClick={this.onJoinButtonClicked}>Join Room</button>
                    </div>
                );
            } else {
                return (
                    <div />
                );
            }
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
                        <RoomHeader ref="header" room={this.state.room} simpleHeader="Room invite"/>
                        <div className="mx_RoomView_invitePrompt">
                            <div>{inviteEvent.user_id} has invited you to a room</div>
                            <br/>
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
                var unreadMsgs = this.getUnreadMessagesString();
                // unread count trumps who is typing since the unread count is only
                // set when you've scrolled up
                if (unreadMsgs) {
                    statusBar = (
                        <div className="mx_RoomView_unreadMessagesBar" onClick={ this.scrollToBottom }>
                            <img src="img/newmessages.png" width="10" height="12" alt=""/>
                            {unreadMsgs}
                        </div>
                    );
                }
                else if (typingString) {
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
                roomEdit = <RoomSettings ref="room_settings" onSaveClick={this.onSaveClick} room={this.state.room} />;
            }
            if (this.state.uploadingRoomSettings) {
                roomEdit = <Loader/>;
            }

            var conferenceCallNotification = null;
            if (this.state.displayConfCallNotification) {
                conferenceCallNotification = (
                    <div className="mx_RoomView_ongoingConfCallNotification" onClick={this.onConferenceNotificationClick}>
                        Ongoing conference call
                    </div>
                );
            }

            var fileDropTarget = null;
            if (this.state.draggingFile) {
                fileDropTarget = <div className="mx_RoomView_fileDropTarget">
                                    <div className="mx_RoomView_fileDropTargetLabel">
                                        <img src="img/upload-big.png" width="46" height="61" alt="Drop File Here"/><br/>
                                        Drop File Here
                                    </div>
                                 </div>;
            }

            return (
                <div className="mx_RoomView">
                    <RoomHeader ref="header" room={this.state.room} editing={this.state.editingRoomSettings}
                        onSettingsClick={this.onSettingsClick} onSaveClick={this.onSaveClick} onCancelClick={this.onCancelClick} />
                    <div className="mx_RoomView_auxPanel">
                        <CallView room={this.state.room}/>
                        { conferenceCallNotification }
                        { roomEdit }
                    </div>
                    <div ref="messageWrapper" className="mx_RoomView_messagePanel" onScroll={ this.onMessageListScroll }>
                        <div className="mx_RoomView_messageListWrapper">
                            { fileDropTarget }    
                            <ol className="mx_RoomView_MessageList" aria-live="polite">
                                <li className={scrollheader_classes}>
                                </li>
                                {this.getEventTiles()}
                            </ol>
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
