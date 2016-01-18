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
var React = require("react");

var marked = require("marked");
marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: true,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false
});

var MatrixClientPeg = require("../../../MatrixClientPeg");
var SlashCommands = require("../../../SlashCommands");
var Modal = require("../../../Modal");
var CallHandler = require('../../../CallHandler');
var MemberEntry = require("../../../TabCompleteEntries").MemberEntry;
var sdk = require('../../../index');

var dis = require("../../../dispatcher");
var KeyCode = {
    ENTER: 13,
    BACKSPACE: 8,
    DELETE: 46,
    TAB: 9,
    SHIFT: 16,
    UP: 38,
    DOWN: 40
};

var TYPING_USER_TIMEOUT = 10000;
var TYPING_SERVER_TIMEOUT = 30000;
var MARKDOWN_ENABLED = true;

function mdownToHtml(mdown) {
    var html = marked(mdown) || "";
    html = html.trim();
    // strip start and end <p> tags else you get 'orrible spacing
    if (html.indexOf("<p>") === 0) {
        html = html.substring("<p>".length);
    }
    if (html.lastIndexOf("</p>") === (html.length - "</p>".length)) {
        html = html.substring(0, html.length - "</p>".length);
    }
    return html;
}

module.exports = React.createClass({
    displayName: 'MessageComposer',

    statics: {
        // the height we limit the composer to
        MAX_HEIGHT: 100,
    },

    propTypes: {
        tabComplete: React.PropTypes.any,

        // a callback which is called when the height of the composer is
        // changed due to a change in content.
        onResize: React.PropTypes.func,
    },

    componentWillMount: function() {
        this.oldScrollHeight = 0;
        this.markdownEnabled = MARKDOWN_ENABLED;
        var self = this;
        this.sentHistory = {
            // The list of typed messages. Index 0 is more recent
            data: [],
            // The position in data currently displayed
            position: -1,
            // The room the history is for.
            roomId: null,
            // The original text before they hit UP
            originalText: null,
            // The textarea element to set text to.
            element: null,

            init: function(element, roomId) {
                this.roomId = roomId;
                this.element = element;
                this.position = -1;
                var storedData = window.sessionStorage.getItem(
                    "history_" + roomId
                );
                if (storedData) {
                    this.data = JSON.parse(storedData);
                }
                if (this.roomId) {
                    this.setLastTextEntry();
                }
            },

            push: function(text) {
                // store a message in the sent history
                this.data.unshift(text);
                window.sessionStorage.setItem(
                    "history_" + this.roomId,
                    JSON.stringify(this.data)
                );
                // reset history position
                this.position = -1;
                this.originalText = null;
            },

            // move in the history. Returns true if we managed to move.
            next: function(offset) {
                if (this.position === -1) {
                    // user is going into the history, save the current line.
                    this.originalText = this.element.value;
                }
                else {
                    // user may have modified this line in the history; remember it.
                    this.data[this.position] = this.element.value;
                }

                if (offset > 0 && this.position === (this.data.length - 1)) {
                    // we've run out of history
                    return false;
                }

                // retrieve the next item (bounded).
                var newPosition = this.position + offset;
                newPosition = Math.max(-1, newPosition);
                newPosition = Math.min(newPosition, this.data.length - 1);
                this.position = newPosition;

                if (this.position !== -1) {
                    // show the message
                    this.element.value = this.data[this.position];
                }
                else if (this.originalText !== undefined) {
                    // restore the original text the user was typing.
                    this.element.value = this.originalText;
                }

                self.resizeInput();
                return true;
            },

            saveLastTextEntry: function() {
                // save the currently entered text in order to restore it later.
                // NB: This isn't 'originalText' because we want to restore
                // sent history items too!
                var text = this.element.value;
                window.sessionStorage.setItem("input_" + this.roomId, text);
            },

            setLastTextEntry: function() {
                var text = window.sessionStorage.getItem("input_" + this.roomId);
                if (text) {
                    this.element.value = text;
                    self.resizeInput();
                }
            }
        };
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        this.sentHistory.init(
            this.refs.textarea,
            this.props.room.roomId
        );
        this.resizeInput();
        if (this.props.tabComplete) {
            this.props.tabComplete.setTextArea(this.refs.textarea);
        }
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
        this.sentHistory.saveLastTextEntry();
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'focus_composer':
                this.refs.textarea.focus();
                break;
        }
    },

    onKeyDown: function (ev) {
        if (ev.keyCode === KeyCode.ENTER && !ev.shiftKey) {
            var input = this.refs.textarea.value;
            if (input.length === 0) {
                ev.preventDefault();
                return;
            }
            this.sentHistory.push(input);
            this.onEnter(ev);
        }
        else if (ev.keyCode === KeyCode.UP || ev.keyCode === KeyCode.DOWN) {
            var oldSelectionStart = this.refs.textarea.selectionStart;
            // Remember the keyCode because React will recycle the synthetic event
            var keyCode = ev.keyCode;
            // set a callback so we can see if the cursor position changes as
            // a result of this event. If it doesn't, we cycle history.
            setTimeout(() => {
                if (this.refs.textarea.selectionStart == oldSelectionStart) {
                    this.sentHistory.next(keyCode === KeyCode.UP ? 1 : -1);
                    this.resizeInput();
                }
            }, 0);
        }

        if (this.props.tabComplete) {
            this.props.tabComplete.onKeyDown(ev);
        }

        var self = this;
        setTimeout(function() {
            if (self.refs.textarea && self.refs.textarea.value != '') {
                self.onTypingActivity();
            } else {
                self.onFinishedTyping();
            }
        }, 10); // XXX: what is this 10ms setTimeout doing?  Looks hacky :(
    },

    resizeInput: function() {
        // scrollHeight is at least equal to clientHeight, so we have to
        // temporarily crimp clientHeight to 0 to get an accurate scrollHeight value
        this.refs.textarea.style.height = "0px";
        var newHeight = Math.min(this.refs.textarea.scrollHeight,
                                 this.constructor.MAX_HEIGHT);
        this.refs.textarea.style.height = Math.ceil(newHeight) + "px";
        this.oldScrollHeight = this.refs.textarea.scrollHeight;

        if (this.props.onResize) {
            // kick gemini-scrollbar to re-layout
            this.props.onResize();
        }
    },

    onKeyUp: function(ev) {
        if (this.refs.textarea.scrollHeight !== this.oldScrollHeight ||
            ev.keyCode === KeyCode.DELETE ||
            ev.keyCode === KeyCode.BACKSPACE)
        {
            this.resizeInput();
        }
    },

    onEnter: function(ev) {
        var contentText = this.refs.textarea.value;

        // bodge for now to set markdown state on/off. We probably want a separate
        // area for "local" commands which don't hit out to the server.
        if (contentText.indexOf("/markdown") === 0) {
            ev.preventDefault();
            this.refs.textarea.value = '';
            if (contentText.indexOf("/markdown on") === 0) {
                this.markdownEnabled = true;
            }
            else if (contentText.indexOf("/markdown off") === 0) {
                this.markdownEnabled = false;
            }
            else {
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Unknown command",
                    description: "Usage: /markdown on|off"
                });
            }
            return;
        }

        var cmd = SlashCommands.processInput(this.props.room.roomId, contentText);
        if (cmd) {
            ev.preventDefault();
            if (!cmd.error) {
                this.refs.textarea.value = '';
            }
            if (cmd.promise) {
                cmd.promise.done(function() {
                    console.log("Command success.");
                }, function(err) {
                    console.error("Command failure: %s", err);
                    var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createDialog(ErrorDialog, {
                        title: "Server error",
                        description: err.message
                    });
                });
            }
            else if (cmd.error) {
                console.error(cmd.error);
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Command error",
                    description: cmd.error
                });
            }
            return;
        }

        var isEmote = /^\/me /i.test(contentText);
        var sendMessagePromise;

        if (isEmote) {
            contentText = contentText.substring(4);
        }
        else if (contentText[0] === '/') {
            contentText = contentText.substring(1);   
        }

        var htmlText;
        if (this.markdownEnabled && (htmlText = mdownToHtml(contentText)) !== contentText) {
            sendMessagePromise = isEmote ? 
                MatrixClientPeg.get().sendHtmlEmote(this.props.room.roomId, contentText, htmlText) :
                MatrixClientPeg.get().sendHtmlMessage(this.props.room.roomId, contentText, htmlText);
        }
        else {
            sendMessagePromise = isEmote ? 
                MatrixClientPeg.get().sendEmoteMessage(this.props.room.roomId, contentText) :
                MatrixClientPeg.get().sendTextMessage(this.props.room.roomId, contentText);
        }

        sendMessagePromise.done(function() {
            dis.dispatch({
                action: 'message_sent'
            });
        }, function() {
            dis.dispatch({
                action: 'message_send_failed'
            });
        });
        this.refs.textarea.value = '';
        this.resizeInput();
        ev.preventDefault();
    },

    onTypingActivity: function() {
        this.isTyping = true;
        if (!this.userTypingTimer) {
            this.sendTyping(true);
        }
        this.startUserTypingTimer();
        this.startServerTypingTimer();
    },

    onFinishedTyping: function() {
        this.isTyping = false;
        this.sendTyping(false);
        this.stopUserTypingTimer();
        this.stopServerTypingTimer();
    },

    startUserTypingTimer: function() {
        this.stopUserTypingTimer();
        var self = this;
        this.userTypingTimer = setTimeout(function() {
            self.isTyping = false;
            self.sendTyping(self.isTyping);
            self.userTypingTimer = null;
        }, TYPING_USER_TIMEOUT);
    },

    stopUserTypingTimer: function() {
        if (this.userTypingTimer) {
            clearTimeout(this.userTypingTimer);
            this.userTypingTimer = null;
        }
    },

    startServerTypingTimer: function() {
        if (!this.serverTypingTimer) {
            var self = this;
            this.serverTypingTimer = setTimeout(function() {
                if (self.isTyping) {
                    self.sendTyping(self.isTyping);
                    self.startServerTypingTimer();
                }
            }, TYPING_SERVER_TIMEOUT / 2);
        }
    },

    stopServerTypingTimer: function() {
        if (this.serverTypingTimer) {
            clearTimeout(this.servrTypingTimer);
            this.serverTypingTimer = null;
        }
    },

    sendTyping: function(isTyping) {
        MatrixClientPeg.get().sendTyping(
            this.props.room.roomId,
            this.isTyping, TYPING_SERVER_TIMEOUT
        ).done();
    },

    refreshTyping: function() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    },

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

    onHangupClick: function() {
        var call = CallHandler.getCallForRoom(this.props.room.roomId);
        //var call = CallHandler.getAnyActiveCall();
        if (!call) {
            return;
        }
        dis.dispatch({
            action: 'hangup',
            // hangup the call for this room, which may not be the room in props
            // (e.g. conferences which will hangup the 1:1 room instead)
            room_id: call.roomId
        });
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
        var TintableSvg = sdk.getComponent("elements.TintableSvg");

        var callButton, videoCallButton, hangupButton;
        var call = CallHandler.getCallForRoom(this.props.room.roomId);
        //var call = CallHandler.getAnyActiveCall();
        if (this.props.callState && this.props.callState !== 'ended') {
            hangupButton =
                <div className="mx_MessageComposer_hangup" onClick={this.onHangupClick}>
                    <img src="img/hangup.svg" alt="Hangup" title="Hangup" width="25" height="26"/>
                </div>;
        }
        else {
            callButton =
                <div className="mx_MessageComposer_voicecall" onClick={this.onVoiceCallClick} title="Voice call">
                    <TintableSvg src="img/voice.svg" width="16" height="26"/>
                </div>
            videoCallButton =
                <div className="mx_MessageComposer_videocall" onClick={this.onCallClick} title="Video call">
                    <TintableSvg src="img/call.svg" width="30" height="22"/>
                </div>
        }

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
                    <div className="mx_MessageComposer_upload" onClick={this.onUploadClick} title="Upload file">
                        <TintableSvg src="img/upload.svg" width="19" height="24"/>
                        <input type="file" style={uploadInputStyle} ref="uploadInput" onChange={this.onUploadFileSelected} />
                    </div>
                    { hangupButton }
                    { callButton }
                    { videoCallButton }
                </div>
            </div>
        </div>
        );
    }
});

