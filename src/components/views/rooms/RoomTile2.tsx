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

import React, { createRef } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import classNames from "classnames";
import { RovingTabIndexWrapper } from "../../../accessibility/RovingTabIndex";
import AccessibleButton from "../../views/elements/AccessibleButton";
import RoomAvatar from "../../views/avatars/RoomAvatar";

interface IProps {
    room: Room;

    // TODO: Allow faslifying counts (for invites and stuff)
    // TODO: Transparency?
    // TODO: Incoming call?
    // TODO: onClick
}

interface IState {
}

// TODO: Finish stub
export default class RoomTile2 extends React.Component<IProps, IState> {
    private roomTile = createRef();

    // TODO: Custom status
    // TODO: Lock icon
    // TODO: DM indicator
    // TODO: Presence indicator
    // TODO: e2e shields
    // TODO: Handle changes to room aesthetics (name, join rules, etc)
    // TODO: scrollIntoView?
    // TODO: hover, badge, etc
    // TODO: isSelected for hover effects
    // TODO: Context menu
    // TODO: a11y

    public render(): React.ReactElement {
        // TODO: Collapsed state
        // TODO: Invites
        // TODO: a11y proper
        // TODO: Render more than bare minimum

        const classes = classNames({
            'mx_RoomTile': true,
            // 'mx_RoomTile_selected': this.state.selected,
            // 'mx_RoomTile_unread': this.props.unread,
            // 'mx_RoomTile_unreadNotify': notifBadges,
            // 'mx_RoomTile_highlight': mentionBadges,
            // 'mx_RoomTile_invited': isInvite,
            // 'mx_RoomTile_menuDisplayed': isMenuDisplayed,
            'mx_RoomTile_noBadges': true, // !badges
            // 'mx_RoomTile_transparent': this.props.transparent,
            // 'mx_RoomTile_hasSubtext': subtext && !this.props.collapsed,
        });

        const avatarClasses = classNames({
            'mx_RoomTile_avatar': true,
        });

        // TODO: the original RoomTile uses state for the room name. Do we need to?
        let name = this.props.room.name;
        if (typeof name !== 'string') name = '';
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        const nameClasses = classNames({
            'mx_RoomTile_name': true,
            'mx_RoomTile_invite': false,
            'mx_RoomTile_badgeShown': false,
        });

        return (
            <React.Fragment>
                <RovingTabIndexWrapper inputRef={this.roomTile}>
                    {({onFocus, isActive, ref}) =>
                        <AccessibleButton
                            onFocus={onFocus}
                            tabIndex={isActive ? 0 : -1}
                            inputRef={ref}
                            className={classes}
                            role="treeitem"
                        >
                            <div className={avatarClasses}>
                                <div className="mx_RoomTile_avatar_container">
                                    <RoomAvatar room={this.props.room} width={24} height={24}/>
                                </div>
                            </div>
                            <div className="mx_RoomTile_nameContainer">
                                <div className="mx_RoomTile_labelContainer">
                                    <div title={name} className={nameClasses} tabIndex={-1} dir="auto">
                                        {name}
                                    </div>
                                </div>
                            </div>
                        </AccessibleButton>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}
