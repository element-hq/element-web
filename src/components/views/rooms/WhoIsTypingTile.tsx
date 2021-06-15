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
import Room from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import * as WhoIsTyping from '../../../WhoIsTyping';
import Timer from '../../../utils/Timer';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import MemberAvatar from '../avatars/MemberAvatar';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { compare } from "../../../utils/strings";

interface IProps {
    // the room this statusbar is representing.
    room: Room;
    onShown?: () => void;
    onHidden?: () => void;
    // Number of names to display in typing indication. E.g. set to 3, will
    // result in "X, Y, Z and 100 others are typing."
    whoIsTypingLimit: number;
}

interface IState {
    usersTyping: RoomMember[];
    // a map with userid => Timer to delay
    // hiding the "x is typing" message for a
    // user so hiding it can coincide
    // with the sent message by the other side
    // resulting in less timeline jumpiness
    delayedStopTypingTimers: Record<string, Timer>;
}

@replaceableComponent("views.rooms.WhoIsTypingTile")
export default class WhoIsTypingTile extends React.Component<IProps, IState> {
    static defaultProps = {
        whoIsTypingLimit: 3,
    };

    state = {
        usersTyping: WhoIsTyping.usersTypingApartFromMe(this.props.room),
        delayedStopTypingTimers: {},
    };

    componentDidMount() {
        MatrixClientPeg.get().on("RoomMember.typing", this.onRoomMemberTyping);
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
    }

    componentDidUpdate(_, prevState) {
        const wasVisible = this._isVisible(prevState);
        const isVisible = this._isVisible(this.state);
        if (this.props.onShown && !wasVisible && isVisible) {
            this.props.onShown();
        } else if (this.props.onHidden && wasVisible && !isVisible) {
            this.props.onHidden();
        }
    }

    componentWillUnmount() {
        // we may have entirely lost our client as we're logging out before clicking login on the guest bar...
        const client = MatrixClientPeg.get();
        if (client) {
            client.removeListener("RoomMember.typing", this.onRoomMemberTyping);
            client.removeListener("Room.timeline", this.onRoomTimeline);
        }
        Object.values(this.state.delayedStopTypingTimers).forEach((t) => (t as Timer).abort());
    }

    private _isVisible(state: IState): boolean {
        return state.usersTyping.length !== 0 || Object.keys(state.delayedStopTypingTimers).length !== 0;
    }

    public isVisible = (): boolean => {
        return this._isVisible(this.state);
    };

    private onRoomTimeline = (event: MatrixEvent, room: Room): void => {
        if (room?.roomId === this.props.room?.roomId) {
            const userId = event.getSender();
            // remove user from usersTyping
            const usersTyping = this.state.usersTyping.filter((m) => m.userId !== userId);
            if (usersTyping.length !== this.state.usersTyping.length) {
                this.setState({usersTyping});
            }
            // abort timer if any
            this.abortUserTimer(userId);
        }
    };

    private onRoomMemberTyping = (): void => {
        const usersTyping = WhoIsTyping.usersTypingApartFromMeAndIgnored(this.props.room);
        this.setState({
            delayedStopTypingTimers: this.updateDelayedStopTypingTimers(usersTyping),
            usersTyping,
        });
    };

    private updateDelayedStopTypingTimers(usersTyping: RoomMember[]): Record<string, Timer> {
        const usersThatStoppedTyping = this.state.usersTyping.filter((a) => {
            return !usersTyping.some((b) => a.userId === b.userId);
        });
        const usersThatStartedTyping = usersTyping.filter((a) => {
            return !this.state.usersTyping.some((b) => a.userId === b.userId);
        });
        // abort all the timers for the users that started typing again
        usersThatStartedTyping.forEach((m) => {
            const timer = this.state.delayedStopTypingTimers[m.userId];
            if (timer) {
                timer.abort();
            }
        });
        // prepare new delayedStopTypingTimers object to update state with
        let delayedStopTypingTimers = Object.assign({}, this.state.delayedStopTypingTimers);
        // remove members that started typing again
        delayedStopTypingTimers = usersThatStartedTyping.reduce((delayedStopTypingTimers, m) => {
            delete delayedStopTypingTimers[m.userId];
            return delayedStopTypingTimers;
        }, delayedStopTypingTimers);
        // start timer for members that stopped typing
        delayedStopTypingTimers = usersThatStoppedTyping.reduce((delayedStopTypingTimers, m) => {
            if (!delayedStopTypingTimers[m.userId]) {
                const timer = new Timer(5000);
                delayedStopTypingTimers[m.userId] = timer;
                timer.start();
                timer.finished().then(
                    () => this.removeUserTimer(m.userId), // on elapsed
                    () => {/* aborted */},
                );
            }
            return delayedStopTypingTimers;
        }, delayedStopTypingTimers);

        return delayedStopTypingTimers;
    }

    private abortUserTimer(userId: string): void {
        const timer = this.state.delayedStopTypingTimers[userId];
        if (timer) {
            timer.abort();
            this.removeUserTimer(userId);
        }
    }

    private removeUserTimer(userId: string): void {
        const timer = this.state.delayedStopTypingTimers[userId];
        if (timer) {
            const delayedStopTypingTimers = Object.assign({}, this.state.delayedStopTypingTimers);
            delete delayedStopTypingTimers[userId];
            this.setState({delayedStopTypingTimers});
        }
    }

    private renderTypingIndicatorAvatars(users: RoomMember[], limit: number): JSX.Element[] {
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
                    viewUserOnClick={true}
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
    }

    render() {
        let usersTyping = this.state.usersTyping;
        const stoppedUsersOnTimer = Object.keys(this.state.delayedStopTypingTimers)
            .map((userId) => this.props.room.getMember(userId));
        // append the users that have been reported not typing anymore
        // but have a timeout timer running so they can disappear
        // when a message comes in
        usersTyping = usersTyping.concat(stoppedUsersOnTimer);
        // sort them so the typing members don't change order when
        // moved to delayedStopTypingTimers
        usersTyping.sort((a, b) => compare(a.name, b.name));

        const typingString = WhoIsTyping.whoIsTypingString(
            usersTyping,
            this.props.whoIsTypingLimit,
        );
        if (!typingString) {
            return null;
        }

        return (
            <li className="mx_WhoIsTypingTile" aria-atomic="true">
                <div className="mx_WhoIsTypingTile_avatars">
                    { this.renderTypingIndicatorAvatars(usersTyping, this.props.whoIsTypingLimit) }
                </div>
                <div className="mx_WhoIsTypingTile_label">
                    { typingString }
                </div>
            </li>
        );
    }
}
