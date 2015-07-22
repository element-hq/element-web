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

var MatrixClientPeg = require("../../MatrixClientPeg");
var SlashCommands = require("../../SlashCommands");
var Modal = require("../../Modal");
var ComponentBroker = require('../../ComponentBroker');
var ErrorDialog = ComponentBroker.get("organisms/ErrorDialog");

var dis = require("../../dispatcher");
var KeyCode = {
    ENTER: 13,
    TAB: 9,
    SHIFT: 16,
    UP: 38,
    DOWN: 40
};

var TYPING_USER_TIMEOUT = 10000;
var TYPING_SERVER_TIMEOUT = 30000;

module.exports = {
    componentWillMount: function() {
        this.tabStruct = {
            completing: false,
            original: null,
            index: 0
        };
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
                }
            }
        };
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        this.sentHistory.init(
            this.refs.textarea.getDOMNode(),
            this.props.room.roomId
        );
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
        this.sentHistory.saveLastTextEntry();
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'focus_composer':
                this.refs.textarea.getDOMNode().focus();
                break;
        }
    },

    onKeyDown: function (ev) {
        if (ev.keyCode === KeyCode.ENTER) {
            var input = this.refs.textarea.getDOMNode().value;
            if (input.length === 0) {
                ev.preventDefault();
                return;
            }
            this.sentHistory.push(input);
            this.onEnter(ev);
        }
        else if (ev.keyCode === KeyCode.TAB) {
            var members = [];
            if (this.props.room) {
                members = this.props.room.getJoinedMembers();
            }
            this.onTab(ev, members);
        }
        else if (ev.keyCode === KeyCode.UP || ev.keyCode === KeyCode.DOWN) {
            this.sentHistory.next(
                ev.keyCode === KeyCode.UP ? 1 : -1
            );
            ev.preventDefault();
        }
        else if (ev.keyCode !== KeyCode.SHIFT && this.tabStruct.completing) {
            // they're resuming typing; reset tab complete state vars.
            this.tabStruct.completing = false;
            this.tabStruct.index = 0;
        }

        var self = this;
        setTimeout(function() {
            if (self.refs.textarea.getDOMNode().value != '') {
                self.onTypingActivity();
            } else {
                self.onFinishedTyping();
            }
        }, 10);
    },

    onEnter: function(ev) {
        var contentText = this.refs.textarea.getDOMNode().value;

        var cmd = SlashCommands.processInput(this.props.room.roomId, contentText);
        if (cmd) {
            ev.preventDefault();
            if (!cmd.error) {
                this.refs.textarea.getDOMNode().value = '';
            }
            if (cmd.promise) {
                cmd.promise.done(function() {
                    console.log("Command success.");
                }, function(err) {
                    console.error("Command failure: %s", err);
                    Modal.createDialog(ErrorDialog, {
                        title: "Server error",
                        description: err.message
                    });
                });
            }
            else if (cmd.error) {
                console.error(cmd.error);
                Modal.createDialog(ErrorDialog, {
                    title: "Command error",
                    description: cmd.error
                });
            }
            return;
        }

        var content = null;
        if (/^\/me /i.test(contentText)) {
            content = {
                msgtype: 'm.emote',
                body: contentText.substring(4)
            };
        } else {
            content = {
                msgtype: 'm.text',
                body: contentText
            };
        }

        MatrixClientPeg.get().sendMessage(this.props.room.roomId, content).then(function() {
            dis.dispatch({
                action: 'message_sent'
            });
        }, function() {
            dis.dispatch({
                action: 'message_send_failed'
            });
        });
        this.refs.textarea.getDOMNode().value = '';
        ev.preventDefault();
    },

    onTab: function(ev, sortedMembers) {
        var textArea = this.refs.textarea.getDOMNode();
        if (!this.tabStruct.completing) {
            this.tabStruct.completing = true;
            this.tabStruct.index = 0;
            // cache starting text
            this.tabStruct.original = textArea.value;
        }

        // loop in the right direction
        if (ev.shiftKey) {
            this.tabStruct.index --;
            if (this.tabStruct.index < 0) {
                // wrap to the last search match, and fix up to a real index
                // value after we've matched.
                this.tabStruct.index = Number.MAX_VALUE;
            }
        }
        else {
            this.tabStruct.index++;
        }

        var searchIndex = 0;
        var targetIndex = this.tabStruct.index;
        var text = this.tabStruct.original;

        var search = /@?([a-zA-Z0-9_\-:\.]+)$/.exec(text);
        // console.log("Searched in '%s' - got %s", text, search);
        if (targetIndex === 0) { // 0 is always the original text
            textArea.value = text;
        }
        else if (search && search[1]) {
            // console.log("search found: " + search+" from "+text);
            var expansion;

            // FIXME: could do better than linear search here
            for (var i=0; i<sortedMembers.length; i++) {
                var member = sortedMembers[i];
                if (member.name && searchIndex < targetIndex) {
                    if (member.name.toLowerCase().indexOf(search[1].toLowerCase()) === 0) {
                        expansion = member.name;
                        searchIndex++;
                    }
                }
            }

            if (searchIndex < targetIndex) { // then search raw mxids
                for (var i=0; i<sortedMembers.length; i++) {
                    if (searchIndex >= targetIndex) {
                        break;
                    }
                    var userId = sortedMembers[i].userId;
                    // === 1 because mxids are @username
                    if (userId.toLowerCase().indexOf(search[1].toLowerCase()) === 1) {
                        expansion = userId;
                        searchIndex++;
                    }
                }
            }

            if (searchIndex === targetIndex ||
                    targetIndex === Number.MAX_VALUE) {
                // xchat-style tab complete, add a colon if tab
                // completing at the start of the text
                if (search[0].length === text.length) {
                    expansion += ": ";
                }
                else {
                    expansion += " ";
                }
                textArea.value = text.replace(
                    /@?([a-zA-Z0-9_\-:\.]+)$/, expansion
                );
                // cancel blink
                textArea.style["background-color"] = "";
                if (targetIndex === Number.MAX_VALUE) {
                    // wrap the index around to the last index found
                    this.tabStruct.index = searchIndex;
                    targetIndex = searchIndex;
                }
            }
            else {
                // console.log("wrapped!");
                textArea.style["background-color"] = "#faa";
                setTimeout(function() {
                     textArea.style["background-color"] = "";
                }, 150);
                textArea.value = text;
                this.tabStruct.index = 0;
            }
        }
        else {
            this.tabStruct.index = 0;
        }
        // prevent the default TAB operation (typically focus shifting)
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

    }
};

