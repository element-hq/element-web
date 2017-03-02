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

var MatrixClientPeg = require("../../../MatrixClientPeg");
var SlashCommands = require("../../../SlashCommands");
var Modal = require("../../../Modal");
var MemberEntry = require("../../../TabCompleteEntries").MemberEntry;
var sdk = require('../../../index');

var dis = require("../../../dispatcher");
var KeyCode = require("../../../KeyCode");
var Markdown = require("../../../Markdown");

var TYPING_USER_TIMEOUT = 10000;
var TYPING_SERVER_TIMEOUT = 30000;
var MARKDOWN_ENABLED = true;

export function onSendMessageFailed(err, room) {
    // XXX: temporary logging to try to diagnose
    // https://github.com/vector-im/riot-web/issues/3148
    console.log('MessageComposer got send failure: ' + err.name + '('+err+')');
    if (err.name === "UnknownDeviceError") {
        dis.dispatch({
            action: 'unknown_device_error',
            err: err,
            room: room,
        });
    }
    dis.dispatch({
        action: 'message_send_failed',
    });
}

/*
 * The textInput part of the MessageComposer
 */
export default React.createClass({
    displayName: 'MessageComposerInput',

    statics: {
        // the height we limit the composer to
        MAX_HEIGHT: 100,
    },

    propTypes: {
        tabComplete: React.PropTypes.any,

        // a callback which is called when the height of the composer is
        // changed due to a change in content.
        onResize: React.PropTypes.func,

        // js-sdk Room object
        room: React.PropTypes.object.isRequired,

        // The text to use a placeholder in the input box
        placeholder: React.PropTypes.string.isRequired,
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
        var textarea = this.refs.textarea;
        switch (payload.action) {
            case 'focus_composer':
                textarea.focus();
                break;
            case 'insert_displayname':
                if (textarea.value.length) {
                    var left = textarea.value.substring(0, textarea.selectionStart);
                    var right = textarea.value.substring(textarea.selectionEnd);
                    if (right.length) {
                        left += payload.displayname;
                    }
                    else {
                        left = left.replace(/( ?)$/, " " + payload.displayname);
                    }
                    textarea.value = left + right;
                    textarea.focus();
                    textarea.setSelectionRange(left.length, left.length);
                }
                else {
                    textarea.value = payload.displayname + ": ";
                    textarea.focus();
                }
                break;
        }
    },

    onKeyDown: function(ev) {
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
        this.refs.textarea.style.height = "20px"; // 20 hardcoded from CSS
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

        var isEmote = /^\/me( |$)/i.test(contentText);
        var sendMessagePromise;

        if (isEmote) {
            contentText = contentText.substring(4);
        }
        else if (contentText[0] === '/') {
            contentText = contentText.substring(1);
        }

        let send_markdown = false;
        let mdown;
        if (this.markdownEnabled) {
            mdown = new Markdown(contentText);
            send_markdown = !mdown.isPlainText();
        }

        if (send_markdown) {
            const htmlText = mdown.toHTML();
            sendMessagePromise = isEmote ?
                MatrixClientPeg.get().sendHtmlEmote(this.props.room.roomId, contentText, htmlText) :
                MatrixClientPeg.get().sendHtmlMessage(this.props.room.roomId, contentText, htmlText);
        }
        else {
            if (mdown) contentText = mdown.toPlaintext();
            sendMessagePromise = isEmote ?
                MatrixClientPeg.get().sendEmoteMessage(this.props.room.roomId, contentText) :
                MatrixClientPeg.get().sendTextMessage(this.props.room.roomId, contentText);
        }

        sendMessagePromise.done(function(res) {
            dis.dispatch({
                action: 'message_sent'
            });
        }, (e) => onSendMessageFailed(e, this.props.room));

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

    render: function() {
        return (
            <div className="mx_MessageComposer_input" onClick={ this.onInputClick }>
                <textarea autoFocus ref="textarea" rows="1" onKeyDown={this.onKeyDown} onKeyUp={this.onKeyUp} placeholder={this.props.placeholder} />
            </div>
        );
    }
});
