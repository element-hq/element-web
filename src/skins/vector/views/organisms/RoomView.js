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
var ReactDOM = require('react-dom');

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var dis = require('matrix-react-sdk/lib/dispatcher');

var sdk = require('matrix-react-sdk')
var classNames = require("classnames");
var filesize = require('filesize');

var GeminiScrollbar = require('react-gemini-scrollbar');
var RoomViewController = require('../../../../controllers/organisms/RoomView')
var VectorConferenceHandler = require('../../../../modules/VectorConferenceHandler');

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

    onRejectButtonClicked: function(ev) {
        var self = this;
        this.setState({
            rejecting: true
        });
        MatrixClientPeg.get().leave(this.props.roomId).done(function() {
            dis.dispatch({ action: 'view_next_room' });
            self.setState({
                rejecting: false
            });
        }, function(err) {
            console.error("Failed to reject invite: %s", err);
            self.setState({
                rejecting: false,
                rejectError: err
            });
        });
    },

    onSearchClick: function() {
        this.setState({ searching: true });
    },

    onConferenceNotificationClick: function() {
        dis.dispatch({
            action: 'place_call',
            type: "video",
            room_id: this.props.roomId
        });
    },

    getUnreadMessagesString: function() {
        if (!this.state.numUnreadMessages) {
            return "";
        }
        return this.state.numUnreadMessages + " new message" + (this.state.numUnreadMessages > 1 ? "s" : "");
    },

    scrollToBottom: function() {
        var scrollNode = this._getScrollNode();
        if (!scrollNode) return;
        scrollNode.scrollTop = scrollNode.scrollHeight;
    },

    render: function() {
        var RoomHeader = sdk.getComponent('molecules.RoomHeader');
        var MessageComposer = sdk.getComponent('molecules.MessageComposer');
        var CallView = sdk.getComponent("voip.CallView");
        var RoomSettings = sdk.getComponent("molecules.RoomSettings");
        var SearchBar = sdk.getComponent("molecules.SearchBar");

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
            if (this.state.joining || this.state.rejecting) {
                var Loader = sdk.getComponent("elements.Spinner");
                return (
                    <div className="mx_RoomView">
                        <Loader />
                    </div>
                );
            } else {
                var inviteEvent = this.state.room.currentState.members[myUserId].events.member.event;
                // XXX: Leaving this intentionally basic for now because invites are about to change totally
                var joinErrorText = this.state.joinError ? "Failed to join room!" : "";
                var rejectErrorText = this.state.rejectError ? "Failed to reject invite!" : "";
                return (
                    <div className="mx_RoomView">
                        <RoomHeader ref="header" room={this.state.room} simpleHeader="Room invite"/>
                        <div className="mx_RoomView_invitePrompt">
                            <div>{inviteEvent.user_id} has invited you to a room</div>
                            <br/>
                            <button ref="joinButton" onClick={this.onJoinButtonClicked}>Join</button>
                            <button onClick={this.onRejectButtonClicked}>Reject</button>
                            <div className="error">{joinErrorText}</div>
                            <div className="error">{rejectErrorText}</div>
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

            // for testing UI...
            // this.state.upload = {
            //     uploadedBytes: 123493,
            //     totalBytes: 347534,
            //     fileName: "testing_fooble.jpg",
            // }

            if (this.state.upload) {
                var innerProgressStyle = {
                    width: ((this.state.upload.uploadedBytes / this.state.upload.totalBytes) * 100) + '%'
                };
                var uploadedSize = filesize(this.state.upload.uploadedBytes);
                var totalSize = filesize(this.state.upload.totalBytes);
                if (uploadedSize.replace(/^.* /,'') === totalSize.replace(/^.* /,'')) {
                    uploadedSize = uploadedSize.replace(/ .*/, '');
                }
                statusBar = (
                    <div className="mx_RoomView_uploadBar">
                        <div className="mx_RoomView_uploadProgressOuter">
                            <div className="mx_RoomView_uploadProgressInner" style={innerProgressStyle}></div>
                        </div>
                        <img className="mx_RoomView_uploadIcon" src="img/fileicon.png" width="17" height="22"/>
                        <img className="mx_RoomView_uploadCancel" src="img/cancel.png" width="18" height="18"/>
                        <div className="mx_RoomView_uploadBytes">
                            { uploadedSize } / { totalSize }
                        </div>
                        <div className="mx_RoomView_uploadFilename">Uploading {this.state.upload.fileName}</div>
                    </div>
                );
            } else {
                var typingString = this.getWhoIsTypingString();
                //typingString = "Testing typing...";
                var unreadMsgs = this.getUnreadMessagesString();
                // no conn bar trumps unread count since you can't get unread messages
                // without a connection! (technically may already have some but meh)
                // It also trumps the "some not sent" msg since you can't resend without
                // a connection!
                if (this.state.syncState === "ERROR") {
                    statusBar = (
                        <div className="mx_RoomView_connectionLostBar">
                            <img src="img/warning2.png" width="30" height="30" alt="/!\"/>
                            <div className="mx_RoomView_connectionLostBar_textArea">
                                <div className="mx_RoomView_connectionLostBar_title">
                                    Connectivity to the server has been lost.
                                </div>
                                <div className="mx_RoomView_connectionLostBar_desc">
                                    Sent messages will be stored until your connection has returned.
                                </div>
                            </div>
                        </div>
                    );
                }
                else if (this.state.hasUnsentMessages) {
                    statusBar = (
                        <div className="mx_RoomView_connectionLostBar">
                            <img src="img/warning2.png" width="30" height="30" alt="/!\"/>
                            <div className="mx_RoomView_connectionLostBar_textArea">
                                <div className="mx_RoomView_connectionLostBar_title">
                                    Some of your messages have not been sent.
                                </div>
                                <div className="mx_RoomView_connectionLostBar_desc">
                                    <a className="mx_RoomView_resend_link"
                                        onClick={ this.onResendAllClick }>
                                    Resend all now
                                    </a> or select individual messages to re-send.
                                </div>
                            </div>
                        </div>
                    );
                }
                // unread count trumps who is typing since the unread count is only
                // set when you've scrolled up
                else if (unreadMsgs) {
                    statusBar = (
                        <div className="mx_RoomView_unreadMessagesBar" onClick={ this.scrollToBottom }>
                            <img src="img/newmessages.png" width="24" height="24" alt=""/>
                            {unreadMsgs}
                        </div>
                    );
                }
                else if (typingString) {
                    statusBar = (
                        <div className="mx_RoomView_typingBar">
                            <div className="mx_RoomView_typingImage">...</div>
                            {typingString}
                        </div>
                    );
                }
            }

            var aux = null;
            if (this.state.editingRoomSettings) {
                aux = <RoomSettings ref="room_settings" onSaveClick={this.onSaveClick} room={this.state.room} />;
            }
            else if (this.state.uploadingRoomSettings) {
                var Loader = sdk.getComponent("elements.Spinner");                
                aux = <Loader/>;
            }
            else if (this.state.searching) {
                aux = <SearchBar ref="search_bar" onCancelClick={this.onCancelClick} onSearch={this.onSearch}/>;
            }

            var conferenceCallNotification = null;
            if (this.state.displayConfCallNotification) {
                var supportedText;
                if (!MatrixClientPeg.get().supportsVoip()) {
                    supportedText = " (unsupported)";
                }
                conferenceCallNotification = (
                    <div className="mx_RoomView_ongoingConfCallNotification" onClick={this.onConferenceNotificationClick}>
                        Ongoing conference call {supportedText}
                    </div>
                );
            }

            var fileDropTarget = null;
            if (this.state.draggingFile) {
                fileDropTarget = <div className="mx_RoomView_fileDropTarget">
                                    <div className="mx_RoomView_fileDropTargetLabel">
                                        <img src="img/upload-big.png" width="43" height="57" alt="Drop File Here"/><br/>
                                        Drop File Here
                                    </div>
                                 </div>;
            }

            return (
                <div className="mx_RoomView">
                    <RoomHeader ref="header" room={this.state.room} editing={this.state.editingRoomSettings} onSearchClick={this.onSearchClick}
                        onSettingsClick={this.onSettingsClick} onSaveClick={this.onSaveClick} onCancelClick={this.onCancelClick} />
                    <div className="mx_RoomView_auxPanel">
                        <CallView room={this.state.room} ConferenceHandler={VectorConferenceHandler}/>
                        { conferenceCallNotification }
                        { aux }
                    </div>
                    <GeminiScrollbar autoshow={true} ref="messagePanel" className="mx_RoomView_messagePanel" onScroll={ this.onMessageListScroll }>
                        <div className="mx_RoomView_messageListWrapper">
                            { fileDropTarget }    
                            <ol className="mx_RoomView_MessageList" aria-live="polite">
                                <li className={scrollheader_classes}>
                                </li>
                                {this.getEventTiles()}
                            </ol>
                        </div>
                    </GeminiScrollbar>
                    <div className="mx_RoomView_statusArea">
                        <div className="mx_RoomView_statusAreaBox">
                            <div className="mx_RoomView_statusAreaBox_line"></div>
                            {statusBar}
                        </div>
                    </div>
                    <MessageComposer room={this.state.room} roomView={this} uploadFile={this.uploadFile} />
                </div>
            );
        }
    },
});
