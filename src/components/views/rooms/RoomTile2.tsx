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
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import RoomAvatar from "../../views/avatars/RoomAvatar";
import dis from '../../../dispatcher/dispatcher';
import { Key } from "../../../Keyboard";
import ActiveRoomObserver from "../../../ActiveRoomObserver";
import NotificationBadge, {
    INotificationState,
    NotificationColor,
    TagSpecificNotificationState
} from "./NotificationBadge";
import { _t } from "../../../languageHandler";
import { ContextMenu, ContextMenuButton } from "../../structures/ContextMenu";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import { MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";
import RoomTileIcon from "./RoomTileIcon";

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
    isMinimized: boolean;
    tag: TagID;

    // TODO: Allow falsifying counts (for invites and stuff)
    // TODO: Transparency? Was this ever used?
    // TODO: Incoming call boxes?
}

interface IState {
    hover: boolean;
    notificationState: INotificationState;
    selected: boolean;
    generalMenuDisplayed: boolean;
}

export default class RoomTile2 extends React.Component<IProps, IState> {
    private roomTileRef: React.RefObject<HTMLDivElement> = createRef();
    private generalMenuButtonRef: React.RefObject<HTMLButtonElement> = createRef();

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
            notificationState: new TagSpecificNotificationState(this.props.room, this.props.tag),
            selected: ActiveRoomObserver.activeRoomId === this.props.room.roomId,
            generalMenuDisplayed: false,
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

    private onGeneralMenuOpenClick = (ev: InputEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({generalMenuDisplayed: true});
    };

    private onCloseGeneralMenu = (ev: InputEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({generalMenuDisplayed: false});
    };

    private onTagRoom = (ev: ButtonEvent, tagId: TagID) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (tagId === DefaultTagID.DM) {
            // TODO: DM Flagging
        } else {
            // TODO: XOR favourites and low priority
        }
    };

    private onLeaveRoomClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.room.roomId,
        });
        this.setState({generalMenuDisplayed: false}); // hide the menu
    };

    private onOpenRoomSettings = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        dis.dispatch({
            action: 'open_room_settings',
            room_id: this.props.room.roomId,
        });
        this.setState({generalMenuDisplayed: false}); // hide the menu
    };

    private renderGeneralMenu(): React.ReactElement {
        if (this.props.isMinimized) return null; // no menu when minimized

        let contextMenu = null;
        if (this.state.generalMenuDisplayed) {
            // The context menu appears within the list, so use the room tile as a reference point
            const elementRect = this.roomTileRef.current.getBoundingClientRect();
            contextMenu = (
                <ContextMenu
                    chevronFace="none"
                    left={elementRect.left}
                    top={elementRect.top + elementRect.height + 8}
                    onFinished={this.onCloseGeneralMenu}
                >
                    <div
                        className="mx_IconizedContextMenu mx_IconizedContextMenu_compact mx_RoomTile2_contextMenu"
                        style={{width: elementRect.width}}
                    >
                        <div className="mx_IconizedContextMenu_optionList">
                            <ul>
                                <li>
                                    <AccessibleButton onClick={(e) => this.onTagRoom(e, DefaultTagID.Favourite)}>
                                        <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconStar" />
                                        <span>{_t("Favourite")}</span>
                                    </AccessibleButton>
                                </li>
                                <li>
                                    <AccessibleButton onClick={(e) => this.onTagRoom(e, DefaultTagID.LowPriority)}>
                                        <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconArrowDown" />
                                        <span>{_t("Low Priority")}</span>
                                    </AccessibleButton>
                                </li>
                                <li>
                                    <AccessibleButton onClick={(e) => this.onTagRoom(e, DefaultTagID.DM)}>
                                        <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconUser" />
                                        <span>{_t("Direct Chat")}</span>
                                    </AccessibleButton>
                                </li>
                                <li>
                                    <AccessibleButton onClick={this.onOpenRoomSettings}>
                                        <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconSettings" />
                                        <span>{_t("Settings")}</span>
                                    </AccessibleButton>
                                </li>
                            </ul>
                        </div>
                        <div className="mx_IconizedContextMenu_optionList">
                            <ul>
                                <li className="mx_RoomTile2_contextMenu_redRow">
                                    <AccessibleButton onClick={this.onLeaveRoomClick}>
                                        <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconSignOut" />
                                        <span>{_t("Leave Room")}</span>
                                    </AccessibleButton>
                                </li>
                            </ul>
                        </div>
                    </div>
                </ContextMenu>
            );
        }

        return (
            <React.Fragment>
                <ContextMenuButton
                    className="mx_RoomTile2_menuButton"
                    onClick={this.onGeneralMenuOpenClick}
                    inputRef={this.generalMenuButtonRef}
                    label={_t("Room options")}
                    isExpanded={this.state.generalMenuDisplayed}
                />
                {contextMenu}
            </React.Fragment>
        );
    }

    public render(): React.ReactElement {
        // TODO: Collapsed state
        // TODO: Invites
        // TODO: a11y proper
        // TODO: Render more than bare minimum

        const classes = classNames({
            'mx_RoomTile2': true,
            'mx_RoomTile2_selected': this.state.selected,
            'mx_RoomTile2_hasMenuOpen': this.state.generalMenuDisplayed,
            'mx_RoomTile2_minimized': this.props.isMinimized,
        });

        const badge = (
            <NotificationBadge
                notification={this.state.notificationState}
                forceCount={false}
                roomId={this.props.room.roomId}
            />
        );

        // TODO: the original RoomTile uses state for the room name. Do we need to?
        let name = this.props.room.name;
        if (typeof name !== 'string') name = '';
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        // TODO: Support collapsed state properly
        // TODO: Tooltip?

        let messagePreview = null;
        if (this.props.showMessagePreview && !this.props.isMinimized) {
            // The preview store heavily caches this info, so should be safe to hammer.
            const text = MessagePreviewStore.instance.getPreviewForRoom(this.props.room, this.props.tag);

            // Only show the preview if there is one to show.
            if (text) {
                messagePreview = (
                    <div className="mx_RoomTile2_messagePreview">
                        {text}
                    </div>
                );
            }
        }

        const nameClasses = classNames({
            "mx_RoomTile2_name": true,
            "mx_RoomTile2_nameWithPreview": !!messagePreview,
            "mx_RoomTile2_nameHasUnreadEvents": this.state.notificationState.color >= NotificationColor.Bold,
        });

        let nameContainer = (
            <div className="mx_RoomTile2_nameContainer">
                <div title={name} className={nameClasses} tabIndex={-1} dir="auto">
                    {name}
                </div>
                {messagePreview}
            </div>
        );
        if (this.props.isMinimized) nameContainer = null;

        const avatarSize = 32;
        return (
            <React.Fragment>
                <RovingTabIndexWrapper inputRef={this.roomTileRef}>
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
                                <RoomAvatar room={this.props.room} width={avatarSize} height={avatarSize} />
                                <RoomTileIcon room={this.props.room} tag={this.props.tag} />
                            </div>
                            {nameContainer}
                            <div className="mx_RoomTile2_badgeContainer">
                                {badge}
                            </div>
                            {this.renderGeneralMenu()}
                        </AccessibleButton>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}
