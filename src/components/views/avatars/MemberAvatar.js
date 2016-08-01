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
var sdk = require("../../../index");

module.exports = React.createClass({
    displayName: 'MemberAvatar',

    propTypes: {
        member: React.PropTypes.object.isRequired,
        width: React.PropTypes.number,
        height: React.PropTypes.number,
        resizeMethod: React.PropTypes.string
    },

    getDefaultProps: function() {
        return {
            width: 40,
            height: 40,
            resizeMethod: 'crop'
        }
    },

    getInitialState: function() {
        return this._getState(this.props);
    },

    componentWillReceiveProps: function(nextProps) {
        this.setState(this._getState(nextProps));
    },

    _getState: function(props) {
        return {
            name: props.member.name,
            title: props.member.userId,
            imageUrl: Avatar.avatarUrlForMember(props.member,
                                         props.width,
                                         props.height,
                                         props.resizeMethod)
        }
    },

    render: function() {
        var BaseAvatar = sdk.getComponent("avatars.BaseAvatar");

        var {member, ...otherProps} = this.props;

        return (
            <BaseAvatar {...otherProps} name={this.state.name} title={this.state.title}
                idName={member.userId} url={this.state.imageUrl} />
        );
    }
});
