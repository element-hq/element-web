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

import React, {createRef} from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import classNames from "classnames";
import { RovingTabIndexWrapper } from "../../../accessibility/RovingTabIndex";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import dis from '../../../dispatcher/dispatcher';
import { Key } from "../../../Keyboard";
import ActiveRoomObserver from "../../../ActiveRoomObserver";
import { _t } from "../../../languageHandler";
import {
    ChevronFace,
    ContextMenu,
    ContextMenuTooltipButton,
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
import NotificationBadge from "./NotificationBadge";
import { Volume } from "../../../RoomNotifsTypes";
import RoomListStore from "../../../stores/room-list/RoomListStore2";
import RoomListActions from "../../../actions/RoomListActions";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {ActionPayload} from "../../../dispatcher/payloads";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { NotificationState } from "../../../stores/notifications/NotificationState";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";

// TODO: Rename on launch: https://github.com/vector-im/riot-web/issues/14367

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
    notificationState: NotificationState;
    selected: boolean;
    notificationsMenuPosition: PartialDOMRect;
    generalMenuPosition: PartialDOMRect;
}

const messagePreviewId = (roomId: string) => `mx_RoomTile2_messagePreview_${roomId}`;

const contextMenuBelow = (elementRect: PartialDOMRect) => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.pageXOffset - 9;
    const top = elementRect.bottom + window.pageYOffset + 17;
    const chevronFace = ChevronFace.None;
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
    private dispatcherRef: string;
    private roomTileRef = createRef<HTMLDivElement>();

    constructor(props: IProps) {
        super(props);

        this.state = {
            hover: false,
            notificationState: RoomNotificationStateStore.instance.getRoomState(this.props.room, this.props.tag),
            selected: ActiveRoomObserver.activeRoomId === this.props.room.roomId,
            notificationsMenuPosition: null,
            generalMenuPosition: null,
        };

        ActiveRoomObserver.addListener(this.props.room.roomId, this.onActiveRoomUpdate);
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    private get showContextMenu(): boolean {
        return !this.props.isMinimized && this.props.tag !== DefaultTagID.Invite;
    }

    private get showMessagePreview(): boolean {
        return !this.props.isMinimized && this.props.showMessagePreview;
    }

    public componentDidMount() {
        // when we're first rendered (or our sublist is expanded) make sure we are visible if we're active
        if (this.state.selected) {
            this.scrollIntoView();
        }
    }

    public componentWillUnmount() {
        if (this.props.room) {
            ActiveRoomObserver.removeListener(this.props.room.roomId, this.onActiveRoomUpdate);
        }
        defaultDispatcher.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload) => {
        if (payload.action === "view_room" && payload.room_id === this.props.room.roomId && payload.show_room_tile) {
            setImmediate(() => {
                this.scrollIntoView();
            });
        }
    };

    private scrollIntoView = () => {
        if (!this.roomTileRef.current) return;
        this.roomTileRef.current.scrollIntoView({
            block: "nearest",
            behavior: "auto",
        });
    };

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
            show_room_tile: true, // make sure the room is visible in the list
            room_id: this.props.room.roomId,
            clear_search: (ev && (ev.key === Key.ENTER || ev.key === Key.SPACE)),
        });
    };

    private onActiveRoomUpdate = (isActive: boolean) => {
        this.setState({selected: isActive});
    };

    private onNotificationsMenuOpenClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({notificationsMenuPosition: target.getBoundingClientRect()});
    };

    private onCloseNotificationsMenu = () => {
        this.setState({notificationsMenuPosition: null});
    };

    private onGeneralMenuOpenClick = (ev: React.MouseEvent) => {
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

        if (tagId === DefaultTagID.Favourite) {
            const roomTags = RoomListStore.instance.getTagsForRoom(this.props.room);
            const isFavourite = roomTags.includes(DefaultTagID.Favourite);
            const removeTag = isFavourite ? DefaultTagID.Favourite : DefaultTagID.LowPriority;
            const addTag = isFavourite ? null : DefaultTagID.Favourite;
            dis.dispatch(RoomListActions.tagRoom(
                MatrixClientPeg.get(),
                this.props.room,
                removeTag,
                addTag,
                undefined,
                0
            ));
        } else {
            console.warn(`Unexpected tag ${tagId} applied to ${this.props.room.room_id}`);
        }

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

    private onForgetRoomClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        dis.dispatch({
            action: 'forget_room',
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
            // See https://github.com/vector-im/riot-web/issues/14281
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
        if (MatrixClientPeg.get().isGuest() || this.props.tag === DefaultTagID.Archived || !this.showContextMenu) {
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
                <ContextMenuTooltipButton
                    className={classes}
                    onClick={this.onNotificationsMenuOpenClick}
                    title={_t("Notification options")}
                    isExpanded={!!this.state.notificationsMenuPosition}
                    tabIndex={isActive ? 0 : -1}
                />
                {contextMenu}
            </React.Fragment>
        );
    }

    private renderGeneralMenu(): React.ReactElement {
        if (!this.showContextMenu) return null; // no menu to show

        const roomTags = RoomListStore.instance.getTagsForRoom(this.props.room);

        const isFavorite = roomTags.includes(DefaultTagID.Favourite);
        const favouriteIconClassName = isFavorite ? "mx_RoomTile2_iconFavorite" : "mx_RoomTile2_iconStar";
        const favouriteLabelClassName = isFavorite ? "mx_RoomTile2_contextMenu_activeRow" : "";
        const favouriteLabel = isFavorite ? _t("Favourited") : _t("Favourite");

        let contextMenu = null;
        if (this.state.generalMenuPosition && this.props.tag === DefaultTagID.Archived) {
            contextMenu = (
                <ContextMenu {...contextMenuBelow(this.state.generalMenuPosition)} onFinished={this.onCloseGeneralMenu}>
                    <div className="mx_IconizedContextMenu mx_IconizedContextMenu_compact mx_RoomTile2_contextMenu">
                        <div className="mx_IconizedContextMenu_optionList mx_RoomTile2_contextMenu_redRow">
                            <MenuItem onClick={this.onForgetRoomClick} label={_t("Leave Room")}>
                                <span className="mx_IconizedContextMenu_icon mx_RoomTile2_iconSignOut" />
                                <span className="mx_IconizedContextMenu_label">{_t("Forget Room")}</span>
                            </MenuItem>
                        </div>
                    </div>
                </ContextMenu>
            );
        } else if (this.state.generalMenuPosition) {
            contextMenu = (
                <ContextMenu {...contextMenuBelow(this.state.generalMenuPosition)} onFinished={this.onCloseGeneralMenu}>
                    <div className="mx_IconizedContextMenu mx_IconizedContextMenu_compact mx_RoomTile2_contextMenu">
                        <div className="mx_IconizedContextMenu_optionList">
                            <MenuItemCheckbox
                                className={favouriteLabelClassName}
                                onClick={(e) => this.onTagRoom(e, DefaultTagID.Favourite)}
                                active={isFavorite}
                                label={favouriteLabel}
                            >
                                <span className={classNames("mx_IconizedContextMenu_icon", favouriteIconClassName)} />
                                <span className="mx_IconizedContextMenu_label">{favouriteLabel}</span>
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
                <ContextMenuTooltipButton
                    className="mx_RoomTile2_menuButton"
                    onClick={this.onGeneralMenuOpenClick}
                    title={_t("Room options")}
                    isExpanded={!!this.state.generalMenuPosition}
                />
                {contextMenu}
            </React.Fragment>
        );
    }

    public render(): React.ReactElement {
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

        const nameClasses = classNames({
            "mx_RoomTile2_name": true,
            "mx_RoomTile2_nameWithPreview": !!messagePreview,
            "mx_RoomTile2_nameHasUnreadEvents": this.state.notificationState.isUnread,
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
        } else if (this.state.notificationState.hasMentions) {
            ariaLabel += " " + _t("%(count)s unread messages including mentions.", {
                count: this.state.notificationState.count,
            });
        } else if (this.state.notificationState.hasUnreadCount) {
            ariaLabel += " " + _t("%(count)s unread messages.", {
                count: this.state.notificationState.count,
            });
        } else if (this.state.notificationState.isUnread) {
            ariaLabel += " " + _t("Unread messages.");
        }

        let ariaDescribedBy: string;
        if (this.showMessagePreview) {
            ariaDescribedBy = messagePreviewId(this.props.room.roomId);
        }

        let Button: React.ComponentType<React.ComponentProps<typeof AccessibleButton>> = AccessibleButton;
        if (this.props.isMinimized) {
            Button = AccessibleTooltipButton;
        }

        return (
            <React.Fragment>
                <RovingTabIndexWrapper inputRef={this.roomTileRef}>
                    {({onFocus, isActive, ref}) =>
                        <Button
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
                            title={this.props.isMinimized ? name : undefined}
                        >
                            {roomAvatar}
                            {nameContainer}
                            {badge}
                            {this.renderGeneralMenu()}
                            {this.renderNotificationsMenu(isActive)}
                        </Button>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}
