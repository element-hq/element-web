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
import classNames from "classnames";
import { RovingTabIndexWrapper } from "../../../accessibility/RovingTabIndex";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import dis from '../../../dispatcher/dispatcher';
import { Key } from "../../../Keyboard";
import ActiveRoomObserver from "../../../ActiveRoomObserver";
import { _t } from "../../../languageHandler";
import {
    ContextMenu,
    ContextMenuButton,
    MenuItemRadio,
    MenuItemCheckbox,
    MenuItem,
} from "../../structures/ContextMenu";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import { MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import {
    getRoomNotifsState,
    setRoomNotifsState,
    ALL_MESSAGES,
    ALL_MESSAGES_LOUD,
    MENTIONS_ONLY,
    MUTE,
} from "../../../RoomNotifs";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { TagSpecificNotificationState } from "../../../stores/notifications/TagSpecificNotificationState";
import { INotificationState } from "../../../stores/notifications/INotificationState";
import NotificationBadge from "./NotificationBadge";
import { NotificationColor } from "../../../stores/notifications/NotificationColor";
import { Volume } from "../../../RoomNotifsTypes";

// TODO: Remove banner on launch: https://github.com/vector-im/riot-web/issues/14231
// TODO: Rename on launch: https://github.com/vector-im/riot-web/issues/14231

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

    // TODO: Incoming call boxes: https://github.com/vector-im/riot-web/issues/14177
}

type PartialDOMRect = Pick<DOMRect, "left" | "bottom">;

interface IState {
    hover: boolean;
    notificationState: INotificationState;
    selected: boolean;
    notificationsMenuPosition: PartialDOMRect;
    generalMenuPosition: PartialDOMRect;
}

const messagePreviewId = (roomId: string) => `mx_RoomTile2_messagePreview_${roomId}`;

const contextMenuBelow = (elementRect: PartialDOMRect) => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.pageXOffset - 9;
    const top = elementRect.bottom + window.pageYOffset + 17;
    const chevronFace = "none";
    return {left, top, chevronFace};
};

interface INotifOptionProps {
    active: boolean;
    iconClassName: string;
    label: string;
    onClick(ev: ButtonEvent);
}

const NotifOption: React.FC<INotifOptionProps> = ({active, onClick, iconClassName, label}) => {
    const classes = classNames({
        mx_RoomTile2_contextMenu_activeRow: active,
    });

    let activeIcon;
    if (active) {
        activeIcon = <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconCheck" />;
    }

    return (
        <MenuItemRadio className={classes} onClick={onClick} active={active} label={label}>
            <span className={classNames("mx_IconizedContextMenu_icon", iconClassName)} />
            <span className="mx_IconizedContextMenu_label">{ label }</span>
            { activeIcon }
        </MenuItemRadio>
    );
};

export default class RoomTile2 extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            hover: false,
            notificationState: new TagSpecificNotificationState(this.props.room, this.props.tag),
            selected: ActiveRoomObserver.activeRoomId === this.props.room.roomId,
            notificationsMenuPosition: null,
            generalMenuPosition: null,
        };

        ActiveRoomObserver.addListener(this.props.room.roomId, this.onActiveRoomUpdate);
    }

    private get showContextMenu(): boolean {
        return !this.props.isMinimized && this.props.tag !== DefaultTagID.Invite;
    }

    private get showMessagePreview(): boolean {
        return !this.props.isMinimized && this.props.showMessagePreview;
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
        ev.preventDefault();
        ev.stopPropagation();
        dis.dispatch({
            action: 'view_room',
            // TODO: Support show_room_tile in new room list: https://github.com/vector-im/riot-web/issues/14233
            show_room_tile: true, // make sure the room is visible in the list
            room_id: this.props.room.roomId,
            clear_search: (ev && (ev.key === Key.ENTER || ev.key === Key.SPACE)),
        });
    };

    private onActiveRoomUpdate = (isActive: boolean) => {
        this.setState({selected: isActive});
    };

    private onNotificationsMenuOpenClick = (ev: InputEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({notificationsMenuPosition: target.getBoundingClientRect()});
    };

    private onCloseNotificationsMenu = () => {
        this.setState({notificationsMenuPosition: null});
    };

    private onGeneralMenuOpenClick = (ev: InputEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({generalMenuPosition: target.getBoundingClientRect()});
    };

    private onContextMenu = (ev: React.MouseEvent) => {
        // If we don't have a context menu to show, ignore the action.
        if (!this.showContextMenu) return;

        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            generalMenuPosition: {
                left: ev.clientX,
                bottom: ev.clientY,
            },
        });
    };

    private onCloseGeneralMenu = () => {
        this.setState({generalMenuPosition: null});
    };

    private onTagRoom = (ev: ButtonEvent, tagId: TagID) => {
        ev.preventDefault();
        ev.stopPropagation();

        // TODO: Support tagging: https://github.com/vector-im/riot-web/issues/14211
        // TODO: XOR favourites and low priority: https://github.com/vector-im/riot-web/issues/14210

        if ((ev as React.KeyboardEvent).key === Key.ENTER) {
            // Implements https://www.w3.org/TR/wai-aria-practices/#keyboard-interaction-12
            this.setState({generalMenuPosition: null}); // hide the menu
        }
    };

    private onLeaveRoomClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.room.roomId,
        });
        this.setState({generalMenuPosition: null}); // hide the menu
    };

    private onOpenRoomSettings = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        dis.dispatch({
            action: 'open_room_settings',
            room_id: this.props.room.roomId,
        });
        this.setState({generalMenuPosition: null}); // hide the menu
    };

    private async saveNotifState(ev: ButtonEvent, newState: Volume) {
        ev.preventDefault();
        ev.stopPropagation();
        if (MatrixClientPeg.get().isGuest()) return;

        // get key before we go async and React discards the nativeEvent
        const key = (ev as React.KeyboardEvent).key;
        try {
            // TODO add local echo - https://github.com/vector-im/riot-web/issues/14280
            await setRoomNotifsState(this.props.room.roomId, newState);
        } catch (error) {
            // TODO: some form of error notification to the user to inform them that their state change failed.
            // https://github.com/vector-im/riot-web/issues/14281
            console.error(error);
        }

        if (key === Key.ENTER) {
            // Implements https://www.w3.org/TR/wai-aria-practices/#keyboard-interaction-12
            this.setState({notificationsMenuPosition: null}); // hide the menu
        }
    }

    private onClickAllNotifs = ev => this.saveNotifState(ev, ALL_MESSAGES);
    private onClickAlertMe = ev => this.saveNotifState(ev, ALL_MESSAGES_LOUD);
    private onClickMentions = ev => this.saveNotifState(ev, MENTIONS_ONLY);
    private onClickMute = ev => this.saveNotifState(ev, MUTE);

    private renderNotificationsMenu(isActive: boolean): React.ReactElement {
        if (MatrixClientPeg.get().isGuest() || !this.showContextMenu) {
            // the menu makes no sense in these cases so do not show one
            return null;
        }

        const state = getRoomNotifsState(this.props.room.roomId);

        let contextMenu = null;
        if (this.state.notificationsMenuPosition) {
            contextMenu = (
                <ContextMenu {...contextMenuBelow(this.state.notificationsMenuPosition)} onFinished={this.onCloseNotificationsMenu}>
                    <div className="mx_IconizedContextMenu mx_IconizedContextMenu_compact mx_RoomTile2_contextMenu">
                        <div className="mx_IconizedContextMenu_optionList">
                            <NotifOption
                                label={_t("Use default")}
                                active={state === ALL_MESSAGES}
                                iconClassName="mx_RoomTile2_iconBell"
                                onClick={this.onClickAllNotifs}
                            />
                            <NotifOption
                                label={_t("All messages")}
                                active={state === ALL_MESSAGES_LOUD}
                                iconClassName="mx_RoomTile2_iconBellDot"
                                onClick={this.onClickAlertMe}
                            />
                            <NotifOption
                                label={_t("Mentions & Keywords")}
                                active={state === MENTIONS_ONLY}
                                iconClassName="mx_RoomTile2_iconBellMentions"
                                onClick={this.onClickMentions}
                            />
                            <NotifOption
                                label={_t("None")}
                                active={state === MUTE}
                                iconClassName="mx_RoomTile2_iconBellCrossed"
                                onClick={this.onClickMute}
                            />
                        </div>
                    </div>
                </ContextMenu>
            );
        }

        const classes = classNames("mx_RoomTile2_notificationsButton", {
            // Show bell icon for the default case too.
            mx_RoomTile2_iconBell: state === ALL_MESSAGES,
            mx_RoomTile2_iconBellDot: state === ALL_MESSAGES_LOUD,
            mx_RoomTile2_iconBellMentions: state === MENTIONS_ONLY,
            mx_RoomTile2_iconBellCrossed: state === MUTE,

            // Only show the icon by default if the room is overridden to muted.
            // TODO: [FTUE Notifications] Probably need to detect global mute state
            mx_RoomTile2_notificationsButton_show: state === MUTE,
        });

        return (
            <React.Fragment>
                <ContextMenuButton
                    className={classes}
                    onClick={this.onNotificationsMenuOpenClick}
                    label={_t("Notification options")}
                    isExpanded={!!this.state.notificationsMenuPosition}
                    tabIndex={isActive ? 0 : -1}
                />
                {contextMenu}
            </React.Fragment>
        );
    }

    private renderGeneralMenu(): React.ReactElement {
        if (!this.showContextMenu) return null; // no menu to show

        // TODO: We could do with a proper invite context menu, unlike what showContextMenu suggests

        let contextMenu = null;
        if (this.state.generalMenuPosition) {
            contextMenu = (
                <ContextMenu {...contextMenuBelow(this.state.generalMenuPosition)} onFinished={this.onCloseGeneralMenu}>
                    <div className="mx_IconizedContextMenu mx_IconizedContextMenu_compact mx_RoomTile2_contextMenu">
                        <div className="mx_IconizedContextMenu_optionList">
                            <MenuItemCheckbox
                                onClick={(e) => this.onTagRoom(e, DefaultTagID.Favourite)}
                                active={false} // TODO: https://github.com/vector-im/riot-web/issues/14283
                                label={_t("Favourite")}
                            >
                                <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconStar" />
                                <span className="mx_IconizedContextMenu_label">{_t("Favourite")}</span>
                            </MenuItemCheckbox>
                            <MenuItem onClick={this.onOpenRoomSettings} label={_t("Settings")}>
                                <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconSettings" />
                                <span className="mx_IconizedContextMenu_label">{_t("Settings")}</span>
                            </MenuItem>
                        </div>
                        <div className="mx_IconizedContextMenu_optionList mx_RoomTile2_contextMenu_redRow">
                            <MenuItem onClick={this.onLeaveRoomClick} label={_t("Leave Room")}>
                                <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconSignOut" />
                                <span className="mx_IconizedContextMenu_label">{_t("Leave Room")}</span>
                            </MenuItem>
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
                    label={_t("Room options")}
                    isExpanded={!!this.state.generalMenuPosition}
                />
                {contextMenu}
            </React.Fragment>
        );
    }

    public render(): React.ReactElement {
        // TODO: Invites: https://github.com/vector-im/riot-web/issues/14198

        const classes = classNames({
            'mx_RoomTile2': true,
            'mx_RoomTile2_selected': this.state.selected,
            'mx_RoomTile2_hasMenuOpen': !!(this.state.generalMenuPosition || this.state.notificationsMenuPosition),
            'mx_RoomTile2_minimized': this.props.isMinimized,
        });

        const roomAvatar = <DecoratedRoomAvatar
            room={this.props.room}
            avatarSize={32}
            tag={this.props.tag}
            displayBadge={this.props.isMinimized}
        />;

        let badge: React.ReactNode;
        if (!this.props.isMinimized) {
            // aria-hidden because we summarise the unread count/highlight status in a manual aria-label below
            badge = (
                <div className="mx_RoomTile2_badgeContainer" aria-hidden="true">
                    <NotificationBadge
                        notification={this.state.notificationState}
                        forceCount={false}
                        roomId={this.props.room.roomId}
                    />
                </div>
            );
        }

        // TODO: the original RoomTile uses state for the room name. Do we need to?
        let name = this.props.room.name;
        if (typeof name !== 'string') name = '';
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        let messagePreview = null;
        if (this.showMessagePreview) {
            // The preview store heavily caches this info, so should be safe to hammer.
            const text = MessagePreviewStore.instance.getPreviewForRoom(this.props.room, this.props.tag);

            // Only show the preview if there is one to show.
            if (text) {
                messagePreview = (
                    <div className="mx_RoomTile2_messagePreview" id={messagePreviewId(this.props.room.roomId)}>
                        {text}
                    </div>
                );
            }
        }

        const notificationColor = this.state.notificationState.color;
        const nameClasses = classNames({
            "mx_RoomTile2_name": true,
            "mx_RoomTile2_nameWithPreview": !!messagePreview,
            "mx_RoomTile2_nameHasUnreadEvents": notificationColor >= NotificationColor.Bold,
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

        let ariaLabel = name;
        // The following labels are written in such a fashion to increase screen reader efficiency (speed).
        if (this.props.tag === DefaultTagID.Invite) {
            // append nothing
        } else if (notificationColor >= NotificationColor.Red) {
            ariaLabel += " " + _t("%(count)s unread messages including mentions.", {
                count: this.state.notificationState.count,
            });
        } else if (notificationColor >= NotificationColor.Grey) {
            ariaLabel += " " + _t("%(count)s unread messages.", {
                count: this.state.notificationState.count,
            });
        } else if (notificationColor >= NotificationColor.Bold) {
            ariaLabel += " " + _t("Unread messages.");
        }

        let ariaDescribedBy: string;
        if (this.showMessagePreview) {
            ariaDescribedBy = messagePreviewId(this.props.room.roomId);
        }

        return (
            <React.Fragment>
                <RovingTabIndexWrapper>
                    {({onFocus, isActive, ref}) =>
                        <AccessibleButton
                            onFocus={onFocus}
                            tabIndex={isActive ? 0 : -1}
                            inputRef={ref}
                            className={classes}
                            onMouseEnter={this.onTileMouseEnter}
                            onMouseLeave={this.onTileMouseLeave}
                            onClick={this.onTileClick}
                            onContextMenu={this.onContextMenu}
                            role="treeitem"
                            aria-label={ariaLabel}
                            aria-selected={this.state.selected}
                            aria-describedby={ariaDescribedBy}
                        >
                            {roomAvatar}
                            {nameContainer}
                            {badge}
                            {this.renderGeneralMenu()}
                            {this.renderNotificationsMenu(isActive)}
                        </AccessibleButton>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}
