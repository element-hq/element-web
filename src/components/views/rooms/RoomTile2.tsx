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

interface IProps {
    room: Room;

    // TODO: Allow falsifying counts (for invites and stuff)
    // TODO: Transparency? Was this ever used?
    // TODO: Incoming call boxes?
}

interface IBadgeState {
    showBadge: boolean; // if numUnread > 0 && !showBadge -> bold room
    numUnread: number; // used only if showBadge or showBadgeHighlight is true
    hasUnread: number; // used to make the room bold
    showBadgeHighlight: boolean; // make the badge red
    isInvite: boolean; // show a `!` instead of a number
}

interface IState extends IBadgeState {
    hover: boolean;
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

            ...this.getBadgeState(),
        };
    }

    public componentWillUnmount() {
        // TODO: Listen for changes to the badge count and update as needed
    }

    private updateBadgeCount() {
        this.setState({...this.getBadgeState()});
    }

    private getBadgeState(): IBadgeState {
        // TODO: Make this code path faster
        const highlightCount = RoomNotifs.getUnreadNotificationCount(this.props.room, 'highlight');
        const numUnread = RoomNotifs.getUnreadNotificationCount(this.props.room);
        const showBadge = Unread.doesRoomHaveUnreadMessages(this.props.room);
        const myMembership = getEffectiveMembership(this.props.room.getMyMembership());
        const isInvite = myMembership === EffectiveMembership.Invite;
        const notifState = RoomNotifs.getRoomNotifsState(this.props.room.roomId);
        const shouldShowNotifBadge = RoomNotifs.shouldShowNotifBadge(notifState);
        const shouldShowHighlightBadge = RoomNotifs.shouldShowMentionBadge(notifState);

        return {
            showBadge: (showBadge && shouldShowNotifBadge) || isInvite,
            numUnread,
            hasUnread: showBadge,
            showBadgeHighlight: (highlightCount > 0 && shouldShowHighlightBadge) || isInvite,
            isInvite,
        };
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

        const classes = classNames({
            'mx_RoomTile': true,
            // 'mx_RoomTile_selected': this.state.selected,
            'mx_RoomTile_unread': this.state.numUnread > 0 || this.state.hasUnread,
            'mx_RoomTile_unreadNotify': this.state.showBadge,
            'mx_RoomTile_highlight': this.state.showBadgeHighlight,
            'mx_RoomTile_invited': this.state.isInvite,
            // 'mx_RoomTile_menuDisplayed': isMenuDisplayed,
            'mx_RoomTile_noBadges': !this.state.showBadge,
            // 'mx_RoomTile_transparent': this.props.transparent,
            // 'mx_RoomTile_hasSubtext': subtext && !this.props.collapsed,
        });

        const avatarClasses = classNames({
            'mx_RoomTile_avatar': true,
        });


        let badge;
        if (this.state.showBadge) {
            const badgeClasses = classNames({
                'mx_RoomTile_badge': true,
                'mx_RoomTile_badgeButton': false, // this.state.badgeHover || isMenuDisplayed
            });
            const formattedCount = this.state.isInvite ? `!` : FormattingUtils.formatCount(this.state.numUnread);
            badge = <div className={badgeClasses}>{formattedCount}</div>;
        }

        // TODO: the original RoomTile uses state for the room name. Do we need to?
        let name = this.props.room.name;
        if (typeof name !== 'string') name = '';
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        const nameClasses = classNames({
            'mx_RoomTile_name': true,
            'mx_RoomTile_invite': this.state.isInvite,
            'mx_RoomTile_badgeShown': this.state.showBadge,
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
