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

'use strict';

var React = require('react');
var Avatar = require('../../../Avatar');
var MatrixClientPeg = require('../../../MatrixClientPeg');

module.exports = React.createClass({
    displayName: 'MemberAvatar',

    propTypes: {
        member: React.PropTypes.object,
        width: React.PropTypes.number,
        height: React.PropTypes.number,
        resizeMethod: React.PropTypes.string,
        /**
         * The custom display name to use for this member. This can serve as a
         * drop in replacement for RoomMember objects, or as a clobber name on
         * an existing RoomMember. Used for 3pid invites.
         */
        customDisplayName: React.PropTypes.string
    },

    getDefaultProps: function() {
        return {
            width: 40,
            height: 40,
            resizeMethod: 'crop'
        }
    },

    getInitialState: function() {
        var defaultImageUrl = Avatar.defaultAvatarUrlForString(
            this.props.customDisplayName || this.props.member.userId
        )
        return {
            imageUrl: this._getMemberImageUrl() || defaultImageUrl,
            defaultImageUrl: defaultImageUrl
        };
    },

    componentWillReceiveProps: function(nextProps) {
        this.refreshUrl();
    },

    onError: function(ev) {
        // don't tightloop if the browser can't load a data url
        if (ev.target.src == this.state.defaultImageUrl) {
            return;
        }
        this.setState({
            imageUrl: this.state.defaultImageUrl
        });
    },

    _getMemberImageUrl: function() {
        if (!this.props.member) { return null; }

        return Avatar.avatarUrlForMember(this.props.member,
                                         this.props.width,
                                         this.props.height,
                                         this.props.resizeMethod);
    },

    _getInitialLetter: function() {
        var name = this.props.customDisplayName || this.props.member.name;
        var initial = name[0];
        if (initial === '@' && name[1]) {
            initial = name[1];
        }
        return initial.toUpperCase();
    },

    refreshUrl: function() {
        var newUrl = this._getMemberImageUrl();
        if (newUrl != this.currentUrl) {
            this.currentUrl = newUrl;
            this.setState({imageUrl: newUrl});
        }
    },

    render: function() {
        var name = this.props.customDisplayName || this.props.member.name;

        if (this.state.imageUrl === this.state.defaultImageUrl) {
            var initialLetter = this._getInitialLetter();
            return (
                <span className="mx_MemberAvatar" {...this.props}>
                    <span className="mx_MemberAvatar_initial" aria-hidden="true"
                          style={{ fontSize: (this.props.width * 0.65) + "px",
                                   width: this.props.width + "px",
                                   lineHeight: this.props.height + "px" }}>{ initialLetter }</span>
                    <img className="mx_MemberAvatar_image" src={this.state.imageUrl} title={name}
                         onError={this.onError} width={this.props.width} height={this.props.height} />
                </span>
            );            
        }
        return (
            <img className="mx_MemberAvatar mx_MemberAvatar_image" src={this.state.imageUrl}
                onError={this.onError}
                width={this.props.width} height={this.props.height}
                title={name}
                {...this.props} />
        );
    }
});
