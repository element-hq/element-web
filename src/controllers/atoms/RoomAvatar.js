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

var MatrixClientPeg = require('../../MatrixClientPeg');
var DefaultAvatar = require('../../DefaultAvatar');

module.exports = {
    getDefaultProps: function() {
        return {
            width: 40,
            height: 40,
            resizeMethod: 'crop'
        }
    },

    // takes member as an arg so it can be used if the
    // avatars are required outsode of components
    // (eg. in html5 desktop notifs, although this is not)
    avatarUrlForRoom(room) {
        var url = MatrixClientPeg.get().getAvatarUrlForRoom(
            room,
            this.props.width, this.props.height, this.props.resizeMethod,
            false
        );
        if (url === null) {
            url = this.defaultAvatarUrl(room);
        }
        return url;
    },

    defaultAvatarUrl: function(room) {
        return DefaultAvatar.defaultAvatarUrlForString(
            this.props.room.roomId
        );
    },

    onError: function(ev) {
        // don't tightloop if the browser can't load a data url
        if (ev.target.src == this.defaultAvatarUrl(this.props.room)) {
            return;
        }
        this.setState({
            imageUrl: this.defaultAvatarUrl(this.props.room)
        });
    },

    getInitialState: function() {
        return {
            imageUrl: this.avatarUrlForRoom(this.props.room)
        };
    }
};
