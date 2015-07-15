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

module.exports = {
    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
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
        if (ev.keyCode == 13) {
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
        }
    },
};

