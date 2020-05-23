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
import Tooltip from "../../views/elements/Tooltip";
import dis from '../../../dispatcher/dispatcher';
import { Key } from "../../../Keyboard";
import * as RoomNotifs from '../../../RoomNotifs';
import { EffectiveMembership, getEffectiveMembership } from "../../../stores/room-list/membership";
import * as Unread from '../../../Unread';
import * as FormattingUtils from "../../../utils/FormattingUtils";

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

enum NotificationColor {
    // Inverted (None -> Red) because we do integer comparisons on this
    None, // nothing special
    Bold, // no badge, show as unread
    Grey, // unread notified messages
    Red,  // unread pings
}

interface IProps {
    room: Room;

    // TODO: Allow falsifying counts (for invites and stuff)
    // TODO: Transparency? Was this ever used?
    // TODO: Incoming call boxes?
}

interface INotificationState {
    symbol: string;
    color: NotificationColor;
}

interface IState {
    hover: boolean;
    notificationState: INotificationState;
}

export default class RoomTile2 extends React.Component<IProps, IState> {
    private roomTile = createRef();

    // TODO: Custom status
    // TODO: Lock icon
    // TODO: Presence indicator
    // TODO: e2e shields
    // TODO: Handle changes to room aesthetics (name, join rules, etc)
    // TODO: scrollIntoView?
    // TODO: hover, badge, etc
    // TODO: isSelected for hover effects
    // TODO: Context menu
    // TODO: a11y

    constructor(props: IProps) {
        super(props);

        this.state = {
            hover: false,
            notificationState: this.getNotificationState(),
        };
    }

    public componentWillUnmount() {
        // TODO: Listen for changes to the badge count and update as needed
    }

    // XXX: This is a bit of an awful-looking hack. We should probably be using state for
    // this, but instead we're kinda forced to either duplicate the code or thread a variable
    // through the code paths. This feels like the least evil option.
    private get roomIsInvite(): boolean {
        return getEffectiveMembership(this.props.room.getMyMembership()) === EffectiveMembership.Invite;
    }

    // TODO: Make use of this function when the notification state needs updating.
    private updateNotificationState() {
        this.setState({notificationState: this.getNotificationState()});
    }

    private getNotificationState(): INotificationState {
        const state: INotificationState = {
            color: NotificationColor.None,
            symbol: null,
        };

        if (this.roomIsInvite) {
            state.color = NotificationColor.Red;
            state.symbol = "!";
        } else {
            const redNotifs = RoomNotifs.getUnreadNotificationCount(this.props.room, 'highlight');
            const greyNotifs = RoomNotifs.getUnreadNotificationCount(this.props.room, 'total');

            // For a 'true count' we pick the grey notifications first because they include the
            // red notifications. If we don't have a grey count for some reason we use the red
            // count. If that count is broken for some reason, assume zero. This avoids us showing
            // a badge for 'NaN' (which formats as 'NaNB' for NaN Billion).
            const trueCount = greyNotifs ? greyNotifs : (redNotifs ? redNotifs : 0);

            // Note: we only set the symbol if we have an actual count. We don't want to show
            // zero on badges.

            if (redNotifs > 0) {
                state.color = NotificationColor.Red;
                state.symbol = FormattingUtils.formatCount(trueCount);
            } else if (greyNotifs > 0) {
                state.color = NotificationColor.Grey;
                state.symbol = FormattingUtils.formatCount(trueCount);
            } else {
                // We don't have any notified messages, but we might have unread messages. Let's
                // find out.
                const hasUnread = Unread.doesRoomHaveUnreadMessages(this.props.room);
                if (hasUnread) {
                    state.color = NotificationColor.Bold;
                    // no symbol for this state
                }
            }
        }

        return state;
    }

    private onTileMouseEnter = () => {
        this.setState({hover: true});
    };

    private onTileMouseLeave = () => {
        this.setState({hover: false});
    };

    private onTileClick = (ev: React.KeyboardEvent) => {
        dis.dispatch({
            action: 'view_room',
            // TODO: Support show_room_tile in new room list
            show_room_tile: true, // make sure the room is visible in the list
            room_id: this.props.room.roomId,
            clear_search: (ev && (ev.key === Key.ENTER || ev.key === Key.SPACE)),
        });
    };

    public render(): React.ReactElement {
        // TODO: Collapsed state
        // TODO: Invites
        // TODO: a11y proper
        // TODO: Render more than bare minimum

        const hasBadge = this.state.notificationState.color > NotificationColor.Bold;
        const isUnread = this.state.notificationState.color > NotificationColor.None;
        const classes = classNames({
            'mx_RoomTile': true,
            // 'mx_RoomTile_selected': this.state.selected,
            'mx_RoomTile_unread': isUnread,
            'mx_RoomTile_unreadNotify': this.state.notificationState.color >= NotificationColor.Grey,
            'mx_RoomTile_highlight': this.state.notificationState.color >= NotificationColor.Red,
            'mx_RoomTile_invited': this.roomIsInvite,
            // 'mx_RoomTile_menuDisplayed': isMenuDisplayed,
            'mx_RoomTile_noBadges': !hasBadge,
            // 'mx_RoomTile_transparent': this.props.transparent,
            // 'mx_RoomTile_hasSubtext': subtext && !this.props.collapsed,
        });

        const avatarClasses = classNames({
            'mx_RoomTile_avatar': true,
        });


        let badge;
        if (hasBadge) {
            const badgeClasses = classNames({
                'mx_RoomTile_badge': true,
                'mx_RoomTile_badgeButton': false, // this.state.badgeHover || isMenuDisplayed
            });
            badge = <div className={badgeClasses}>{this.state.notificationState.symbol}</div>;
        }

        // TODO: the original RoomTile uses state for the room name. Do we need to?
        let name = this.props.room.name;
        if (typeof name !== 'string') name = '';
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        const nameClasses = classNames({
            'mx_RoomTile_name': true,
            'mx_RoomTile_invite': this.roomIsInvite,
            'mx_RoomTile_badgeShown': hasBadge,
        });

        // TODO: Support collapsed state properly
        let tooltip = null;
        if (false) { // isCollapsed
            if (this.state.hover) {
                tooltip = <Tooltip className="mx_RoomTile_tooltip" label={this.props.room.name} dir="auto"/>
            }
        }

        return (
            <React.Fragment>
                <RovingTabIndexWrapper inputRef={this.roomTile}>
                    {({onFocus, isActive, ref}) =>
                        <AccessibleButton
                            onFocus={onFocus}
                            tabIndex={isActive ? 0 : -1}
                            inputRef={ref}
                            className={classes}
                            onMouseEnter={this.onTileMouseEnter}
                            onMouseLeave={this.onTileMouseLeave}
                            onClick={this.onTileClick}
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
                                {badge}
                            </div>
                            {tooltip}
                        </AccessibleButton>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}
