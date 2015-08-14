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

var Avatar = require('../../Avatar');

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

    defaultAvatarUrl: function(member) {
        return Avatar.defaultAvatarUrlForString(
            member.userId
        );
    },

    onError: function(ev) {
        // don't tightloop if the browser can't load a data url
        if (ev.target.src == this.defaultAvatarUrl(this.props.member)) {
            return;
        }
        this.setState({
            imageUrl: this.defaultAvatarUrl(this.props.member)
        });
    },

    getInitialState: function() {
        return {
            imageUrl: Avatar.avatarUrlForMember(
                this.props.member,
                this.props.width, this.props.height,
                this.props.resizeMethod
            )
        };
    }
};
