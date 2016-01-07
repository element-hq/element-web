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

    componentWillReceiveProps: function(nextProps) {
        this.refreshUrl();
    },

    defaultAvatarUrl: function(member, width, height, resizeMethod) {
        return Avatar.defaultAvatarUrlForString(member.userId);
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

    _computeUrl: function() {
        return Avatar.avatarUrlForMember(this.props.member,
                                         this.props.width,
                                         this.props.height,
                                         this.props.resizeMethod);
    },

    refreshUrl: function() {
        var newUrl = this._computeUrl();
        if (newUrl != this.currentUrl) {
            this.currentUrl = newUrl;
            this.setState({imageUrl: newUrl});
        }
    },

    getInitialState: function() {
        return {
            imageUrl: this._computeUrl()
        };
    },


    ///////////////

    render: function() {
        // XXX: recalculates default avatar url constantly
        if (this.state.imageUrl === this.defaultAvatarUrl(this.props.member)) {
            var initial;
            if (this.props.member.name[0])
                initial = this.props.member.name[0].toUpperCase();
            if (initial === '@' && this.props.member.name[1])
                initial = this.props.member.name[1].toUpperCase();
         
            return (
                <span className="mx_MemberAvatar" {...this.props}>
                    <span className="mx_MemberAvatar_initial" aria-hidden="true"
                          style={{ fontSize: (this.props.width * 0.65) + "px",
                                   width: this.props.width + "px",
                                   lineHeight: this.props.height + "px" }}>{ initial }</span>
                    <img className="mx_MemberAvatar_image" src={this.state.imageUrl} title={this.props.member.name}
                         onError={this.onError} width={this.props.width} height={this.props.height} />
                </span>
            );            
        }
        return (
            <img className="mx_MemberAvatar mx_MemberAvatar_image" src={this.state.imageUrl}
                onError={this.onError}
                width={this.props.width} height={this.props.height}
                title={this.props.member.name}
                {...this.props}
            />
        );
    }
});
