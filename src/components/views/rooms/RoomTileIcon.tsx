/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { RovingTabIndexWrapper } from "../../../accessibility/RovingTabIndex";
import AccessibleButton from "../../views/elements/AccessibleButton";
import RoomAvatar from "../../views/avatars/RoomAvatar";
import ActiveRoomObserver from "../../../ActiveRoomObserver";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import { User } from "matrix-js-sdk/src/models/user";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import DMRoomMap from "../../../utils/DMRoomMap";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import SdkConfig from "../../../SdkConfig";
import { isPresenceEnabled } from "../../../utils/presence";

enum Icon {
    // Note: the names here are used in CSS class names
    None = "NONE", // ... except this one
    Globe = "GLOBE",
    PresenceOnline = "ONLINE",
    PresenceAway = "AWAY",
    PresenceOffline = "OFFLINE",
}

interface IProps {
    room: Room;
    tag: TagID;
}

interface IState {
    icon: Icon;
}

export default class RoomTileIcon extends React.Component<IProps, IState> {
    private isUnmounted = false;
    private dmUser: User;
    private isWatchingTimeline = false;

    constructor(props: IProps) {
        super(props);

        this.state = {
            icon: this.getIcon(),
        };
    }

    private get isPublicRoom(): boolean {
        const joinRules = this.props.room.currentState.getStateEvents("m.room.join_rules", "");
        const joinRule = joinRules && joinRules.getContent().join_rule;
        return joinRule === 'public';
    }

    public componentWillUnmount() {
        this.isUnmounted = true;
        if (this.isWatchingTimeline) this.props.room.off('Room.timeline', this.onRoomTimeline);
        this.unsubscribePresence();
    }

    private unsubscribePresence() {
        if (this.dmUser) {
            this.dmUser.off('User.currentlyActive', this.onPresenceUpdate);
            this.dmUser.off('User.presence', this.onPresenceUpdate);
        }
    }

    private onRoomTimeline = (ev: MatrixEvent, room: Room) => {
        if (this.isUnmounted) return;

        // apparently these can happen?
        if (!room) return;
        if (this.props.room.roomId !== room.roomId) return;

        if (ev.getType() === 'm.room.join_rules' || ev.getType() === 'm.room.member') {
            this.setState({icon: this.getIcon()});
        }
    };

    private onPresenceUpdate = () => {
        if (this.isUnmounted) return;

        let newIcon = this.getPresenceIcon();
        if (newIcon !== this.state.icon) this.setState({icon: newIcon});
    };

    private getPresenceIcon(): Icon {
        let newIcon = Icon.None;

        const isOnline = this.dmUser.currentlyActive || this.dmUser.presence === 'online';
        if (isOnline) {
            newIcon = Icon.PresenceOnline;
        } else if (this.dmUser.presence === 'offline') {
            newIcon = Icon.PresenceOffline;
        } else if (this.dmUser.presence === 'unavailable') {
            newIcon = Icon.PresenceAway;
        }

        return newIcon;
    }

    private getIcon(): Icon {
        let defaultIcon = Icon.None;
        this.unsubscribePresence();
        if (this.props.tag === DefaultTagID.DM && this.props.room.getJoinedMemberCount() === 2) {
            // Track presence, if available
            if (isPresenceEnabled()) {
                const otherUserId = DMRoomMap.shared().getUserIdForRoomId(this.props.room.roomId);
                if (otherUserId) {
                    this.dmUser = MatrixClientPeg.get().getUser(otherUserId);
                    if (this.dmUser) {
                        this.dmUser.on('User.currentlyActive', this.onPresenceUpdate);
                        this.dmUser.on('User.presence', this.onPresenceUpdate);
                        defaultIcon = this.getPresenceIcon();
                    }
                }
            }
        } else {
            // Track publicity
            defaultIcon = this.isPublicRoom ? Icon.Globe : Icon.None;
            this.props.room.on('Room.timeline', this.onRoomTimeline);
            this.isWatchingTimeline = true;
        }
        return defaultIcon;
    }

    public render(): React.ReactElement {
        if (this.state.icon === Icon.None) return null;

        return <span className={`mx_RoomTileIcon mx_RoomTileIcon_${this.state.icon.toLowerCase()}`} />;
    }
}
