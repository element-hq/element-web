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

var dis = require("../../dispatcher");
var KeyCode = {
    ENTER: 13,
    TAB: 9,
    SHIFT: 16
};

module.exports = {
    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        this.tabStruct = {
            completing: false,
            original: null,
            index: 0
        };
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
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
            this.onEnter(ev);
        }
        else if (ev.keyCode === KeyCode.TAB) {
            var members = [];
            if (this.props.room) {
                members = this.props.room.getJoinedMembers();
            }
            this.onTab(ev, members);
        }
        else if (ev.keyCode !== KeyCode.SHIFT && this.tabStruct.completing) {
            // they're resuming typing; reset tab complete state vars.
            this.tabStruct.completing = false;
            this.tabStruct.index = 0;
        }
    },

    onEnter: function(ev) {
        var contentText = this.refs.textarea.getDOMNode().value;
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
    }
};

