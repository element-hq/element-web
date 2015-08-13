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

var React = require('react');

module.exports = {
    propTypes: {
        member: React.PropTypes.object.isRequired,
        width: React.PropTypes.number,
        height: React.PropTypes.number,
        resizeMethod: React.PropTypes.string,
    },

    getDefaultProps: function() {
        return {
            width: 40,
            height: 40,
            resizeMethod: 'crop'
        }
    },

    // takes member as an arg so it can be used if the
    // avatars are required outsode of components
    // (eg. in html5 desktop notifs)
    avatarUrlForMember(member) {
        var url = MatrixClientPeg.get().getAvatarUrlForMember(
            member,
            this.props.width, this.props.height, this.props.resizeMethod,
            false
        );
        if (url === null) {
            url = this.defaultAvatarUrl(member);
        }
        return url;
    },

    defaultAvatarUrl: function(member) {
        return DefaultAvatar.defaultAvatarUrlForString(
            member.userId
        );
    },

    onError: function(ev) {
        // don't tightloop if the browser can't load a data url
        if (ev.target.src == this.defaultAvatarUrl()) {
            return;
        }
        this.setState({
            imageUrl: this.defaultAvatarUrl()
        });
    },

    getInitialState: function() {
        return {
            imageUrl: this.avatarUrlForMember(this.props.member)
        };
    }
};
