/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd

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

import React from 'react';
import PropTypes from 'prop-types';
import { _t, _td } from '../../../languageHandler';
import sdk from '../../../index';
import WhoIsTyping from '../../../WhoIsTyping';
import MatrixClientPeg from '../../../MatrixClientPeg';
import MemberAvatar from '../avatars/MemberAvatar';

module.exports = React.createClass({
    displayName: 'WhoIsTypingTile',

    propTypes: {
        // the room this statusbar is representing.
        room: PropTypes.object.isRequired,

        // Number of names to display in typing indication. E.g. set to 3, will
        // result in "X, Y, Z and 100 others are typing."
        whoIsTypingLimit: PropTypes.number,
    },

    getDefaultProps: function() {
        return {
            whoIsTypingLimit: 3,
        };
    },

    getInitialState: function() {
        return {
            usersTyping: WhoIsTyping.usersTypingApartFromMe(this.props.room),
        };
    },

    componentWillMount: function() {
        // MatrixClientPeg.get().on("RoomMember.typing", this.onRoomMemberTyping);
    },

    componentWillUnmount: function() {
        // we may have entirely lost our client as we're logging out before clicking login on the guest bar...
        const client = MatrixClientPeg.get();
        if (client) {
            // client.removeListener("RoomMember.typing", this.onRoomMemberTyping);
        }
    },

    onRoomMemberTyping: function(ev, member) {
        this.setState({
            usersTyping: WhoIsTyping.usersTypingApartFromMeAndIgnored(this.props.room),
        });
    },

    _renderTypingIndicatorAvatars: function(limit) {
        let users = this.state.usersTyping;

        let othersCount = 0;
        if (users.length > limit) {
            othersCount = users.length - limit + 1;
            users = users.slice(0, limit - 1);
        }

        const avatars = users.map((u) => {
            return (
                <MemberAvatar
                    key={u.userId}
                    member={u}
                    width={24}
                    height={24}
                    resizeMethod="crop"
                />
            );
        });

        if (othersCount > 0) {
            avatars.push(
                <span className="mx_WhoIsTypingTile_typingIndicatorRemaining" key="others">
                    +{ othersCount }
                </span>,
            );
        }

        return avatars;
    },

    // return suitable content for the main (text) part of the status bar.
    _getContent: function() {
        const EmojiText = sdk.getComponent('elements.EmojiText');

        const typingString = WhoIsTyping.whoIsTypingString(
            this.state.usersTyping,
            this.props.whoIsTypingLimit,
        );
        if (typingString) {
            return (
                <div className="mx_WhoIsTypingTile_typingBar">
                    <EmojiText>{ typingString }</EmojiText>
                </div>
            );
        }
    },

    render: function() {
        // if (this.state.usersTyping.length === 0) {
        //     return;
        // }
        return (
            <div className="mx_WhoIsTypingTile">
                <div className="mx_WhoIsTypingTile_indicator">
                    <div className="mx_WhoIsTypingTile_typingIndicatorAvatars">
                        { this._renderTypingIndicatorAvatars(this.props.whoIsTypingLimit) }
                    </div>
                </div>
                <div role="alert">
                    { this._getContent() }
                </div>
            </div>
        );
    },
});
