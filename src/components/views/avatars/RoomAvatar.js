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
var React = require('react');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var Avatar = require('../../../Avatar');
var sdk = require("../../../index");

module.exports = React.createClass({
    displayName: 'RoomAvatar',

    propTypes: {
        room: React.PropTypes.object.isRequired,
        width: React.PropTypes.number,
        height: React.PropTypes.number,
        resizeMethod: React.PropTypes.string
    },

    getDefaultProps: function() {
        return {
            width: 36,
            height: 36,
            resizeMethod: 'crop'
        }
    },

    getInitialState: function() {
        return {
            urls: [
                this.getRoomAvatarUrl(), // highest priority
                this.getOneToOneAvatar(),
                this.getFallbackAvatar() // lowest priority
            ].filter(function(url) {
                return url != null;
            })
        };
    },

    getRoomAvatarUrl: function() {
        return this.props.room.getAvatarUrl(
            MatrixClientPeg.get().getHomeserverUrl(),
            this.props.width, this.props.height, this.props.resizeMethod,
            false
        );
    },

    getOneToOneAvatar: function() {
        var userIds = Object.keys(this.props.room.currentState.members);

        if (userIds.length == 2) {
            var theOtherGuy = null;
            if (this.props.room.currentState.members[userIds[0]].userId == MatrixClientPeg.get().credentials.userId) {
                theOtherGuy = this.props.room.currentState.members[userIds[1]];
            } else {
                theOtherGuy = this.props.room.currentState.members[userIds[0]];
            }
            return theOtherGuy.getAvatarUrl(
                MatrixClientPeg.get().getHomeserverUrl(),
                this.props.width, this.props.height, this.props.resizeMethod,
                false
            );
        } else if (userIds.length == 1) {
            return this.props.room.currentState.members[userIds[0]].getAvatarUrl(
                MatrixClientPeg.get().getHomeserverUrl(),
                this.props.width, this.props.height, this.props.resizeMethod,
                    false
            );
        } else {
           return null;
        }
    },

    getFallbackAvatar: function() {
        return Avatar.defaultAvatarUrlForString(this.props.room.roomId);
    },

    render: function() {
        var BaseAvatar = sdk.getComponent("avatars.BaseAvatar");
        return (
            <BaseAvatar {...this.props} name={this.props.room.name}
                idName={this.props.room.roomId} urls={this.state.urls} />
        );
    }
});
