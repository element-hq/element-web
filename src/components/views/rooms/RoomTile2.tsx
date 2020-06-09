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
import dis from '../../../dispatcher/dispatcher';
import { Key } from "../../../Keyboard";
import ActiveRoomObserver from "../../../ActiveRoomObserver";
import NotificationBadge, { INotificationState, NotificationColor, RoomNotificationState } from "./NotificationBadge";

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

interface IProps {
    room: Room;
    showMessagePreview: boolean;

    // TODO: Allow falsifying counts (for invites and stuff)
    // TODO: Transparency? Was this ever used?
    // TODO: Incoming call boxes?
}

interface IState {
    hover: boolean;
    notificationState: INotificationState;
    selected: boolean;
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
            notificationState: new RoomNotificationState(this.props.room),
            selected: ActiveRoomObserver.activeRoomId === this.props.room.roomId,
        };

        ActiveRoomObserver.addListener(this.props.room.roomId, this.onActiveRoomUpdate);
    }

    public componentWillUnmount() {
        if (this.props.room) {
            ActiveRoomObserver.removeListener(this.props.room.roomId, this.onActiveRoomUpdate);
        }
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

    private onActiveRoomUpdate = (isActive: boolean) => {
        this.setState({selected: isActive});
    };

    public render(): React.ReactElement {
        // TODO: Collapsed state
        // TODO: Invites
        // TODO: a11y proper
        // TODO: Render more than bare minimum

        const classes = classNames({
            'mx_RoomTile2': true,
            'mx_RoomTile2_selected': this.state.selected,
        });

        const badge = <NotificationBadge notification={this.state.notificationState} allowNoCount={true} />;

        // TODO: the original RoomTile uses state for the room name. Do we need to?
        let name = this.props.room.name;
        if (typeof name !== 'string') name = '';
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        // TODO: Support collapsed state properly
        // TODO: Tooltip?

        let messagePreview = null;
        if (this.props.showMessagePreview) {
            // TODO: Actually get the real message preview from state
            messagePreview = <div className="mx_RoomTile2_messagePreview">I just ate a pie.</div>;
        }

        const nameClasses = classNames({
            "mx_RoomTile2_name": true,
            "mx_RoomTile2_nameWithPreview": !!messagePreview,
            "mx_RoomTile2_nameHasUnreadEvents": this.state.notificationState.color >= NotificationColor.Bold,
        });

        const avatarSize = 32;
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
                            <div className="mx_RoomTile2_avatarContainer">
                                <RoomAvatar room={this.props.room} width={avatarSize} height={avatarSize}/>
                            </div>
                            <div className="mx_RoomTile2_nameContainer">
                                <div title={name} className={nameClasses} tabIndex={-1} dir="auto">
                                    {name}
                                </div>
                                {messagePreview}
                            </div>
                            <div className="mx_RoomTile2_badgeContainer">
                                {badge}
                            </div>
                        </AccessibleButton>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}
