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
import sdk from '../../../index';
import WhoIsTyping from '../../../WhoIsTyping';
import Timer from '../../../utils/Timer';
import MatrixClientPeg from '../../../MatrixClientPeg';
import MemberAvatar from '../avatars/MemberAvatar';

module.exports = React.createClass({
    displayName: 'WhoIsTypingTile',

    propTypes: {
        // the room this statusbar is representing.
        room: PropTypes.object.isRequired,
        onVisible: PropTypes.func,
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
            userTimers: {},
            // a map with userid => Timer to delay
            // hiding the "x is typing" message for a
            // user so hiding it can coincide
            // with the sent message by the other side
            // resulting in less timeline jumpiness
        };
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("RoomMember.typing", this.onRoomMemberTyping);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
    },

    componentDidUpdate: function(_, prevState) {
        if (this.props.onVisible &&
            !prevState.usersTyping.length &&
            this.state.usersTyping.length
        ) {
            this.props.onVisible();
        }
    },

    componentWillUnmount: function() {
        // we may have entirely lost our client as we're logging out before clicking login on the guest bar...
        const client = MatrixClientPeg.get();
        if (client) {
            client.removeListener("RoomMember.typing", this.onRoomMemberTyping);
            client.removeListener("Room.timeline", this.onRoomTimeline);
        }
        Object.values(this.state.userTimers).forEach((t) => t.abort());
    },

    onRoomTimeline: function(event, room) {
        if (room.roomId === this.props.room.roomId) {
            const userId = event.getSender();
            // remove user from usersTyping
            const usersTyping = this.state.usersTyping.filter((m) => m.userId !== userId);
            this.setState({usersTyping});
            // abort timer if any
            this._abortUserTimer(userId);
        }
    },

    onRoomMemberTyping: function(ev, member) {
        const usersTyping = WhoIsTyping.usersTypingApartFromMeAndIgnored(this.props.room);
        this.setState({
            userTimers: this._updateUserTimers(usersTyping),
            usersTyping,
        });
    },

    _updateUserTimers(usersTyping) {
        const usersThatStoppedTyping = this.state.usersTyping.filter((a) => {
            return !usersTyping.some((b) => a.userId === b.userId);
        });
        const usersThatStartedTyping = usersTyping.filter((a) => {
            return !this.state.usersTyping.some((b) => a.userId === b.userId);
        });
        // abort all the timers for the users that started typing again
        usersThatStartedTyping.forEach((m) => {
            const timer = this.state.userTimers[m.userId];
            timer && timer.abort();
        });
        // prepare new userTimers object to update state with
        let userTimers = Object.assign({}, this.state.userTimers);
        // remove members that started typing again
        userTimers = usersThatStartedTyping.reduce((userTimers, m) => {
            delete userTimers[m.userId];
            return userTimers;
        }, userTimers);
        // start timer for members that stopped typing
        userTimers = usersThatStoppedTyping.reduce((userTimers, m) => {
            if (!userTimers[m.userId]) {
                const timer = new Timer(5000);
                userTimers[m.userId] = timer;
                timer.start();
                timer.finished().then(
                    () => this._removeUserTimer(m.userId),  //on elapsed
                    () => {/* aborted */},
                );
            }
            return userTimers;
        }, userTimers);

        return userTimers;
    },

    _abortUserTimer: function(userId) {
        const timer = this.state.userTimers[userId];
        if (timer) {
            timer.abort();
            this._removeUserTimer(userId);
        }
    },

    _removeUserTimer: function(userId) {
        const timer = this.state.userTimers[userId];
        if (timer) {
            const userTimers = Object.assign({}, this.state.userTimers);
            delete userTimers[userId];
            this.setState({userTimers});
        }
    },

    _renderTypingIndicatorAvatars: function(users, limit) {
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
                <span className="mx_WhoIsTypingTile_remainingAvatarPlaceholder" key="others">
                    +{ othersCount }
                </span>,
            );
        }

        return avatars;
    },

    render: function() {
        let usersTyping = this.state.usersTyping;
        const stoppedUsersOnTimer = Object.keys(this.state.userTimers)
            .map((userId) => this.props.room.getMember(userId));
        // append the users that have been reported not typing anymore
        // but have a timeout timer running so they can disappear
        // when a message comes in
        usersTyping = usersTyping.concat(stoppedUsersOnTimer);

        const typingString = WhoIsTyping.whoIsTypingString(
            usersTyping,
            this.props.whoIsTypingLimit,
        );
        if (!typingString) {
            return (<div className="mx_WhoIsTypingTile_empty" />);
        }

        const EmojiText = sdk.getComponent('elements.EmojiText');

        return (
            <li className="mx_WhoIsTypingTile">
                <div className="mx_WhoIsTypingTile_avatars">
                    { this._renderTypingIndicatorAvatars(usersTyping, this.props.whoIsTypingLimit) }
                </div>
                <div className="mx_WhoIsTypingTile_label">
                    <EmojiText>{ typingString }</EmojiText>
                </div>
            </li>
        );
    },
});
