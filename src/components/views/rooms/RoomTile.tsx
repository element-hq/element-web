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
import dis from '../../../dispatcher/dispatcher';
import defaultDispatcher from '../../../dispatcher/dispatcher';
import { Key } from "../../../Keyboard";
import ActiveRoomObserver from "../../../ActiveRoomObserver";
import { _t } from "../../../languageHandler";
import { ChevronFace, ContextMenuTooltipButton, MenuItemRadio } from "../../structures/ContextMenu";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import { MessagePreviewStore, ROOM_PREVIEW_CHANGED } from "../../../stores/room-list/MessagePreviewStore";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { ALL_MESSAGES, ALL_MESSAGES_LOUD, MENTIONS_ONLY, MUTE, } from "../../../RoomNotifs";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import NotificationBadge from "./NotificationBadge";
import { Volume } from "../../../RoomNotifsTypes";
import RoomListStore from "../../../stores/room-list/RoomListStore";
import RoomListActions from "../../../actions/RoomListActions";
import { ActionPayload } from "../../../dispatcher/payloads";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { NOTIFICATION_STATE_UPDATE, NotificationState } from "../../../stores/notifications/NotificationState";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { EchoChamber } from "../../../stores/local-echo/EchoChamber";
import { CachedRoomKey, RoomEchoChamber } from "../../../stores/local-echo/RoomEchoChamber";
import { PROPERTY_UPDATED } from "../../../stores/local-echo/GenericEchoChamber";
import IconizedContextMenu, {
    IconizedContextMenuCheckbox,
    IconizedContextMenuOption,
    IconizedContextMenuOptionList, IconizedContextMenuRadio
} from "../context_menus/IconizedContextMenu";

interface IProps {
    room: Room;
    showMessagePreview: boolean;
    isMinimized: boolean;
    tag: TagID;
}

type PartialDOMRect = Pick<DOMRect, "left" | "bottom">;

interface IState {
    selected: boolean;
    notificationsMenuPosition: PartialDOMRect;
    generalMenuPosition: PartialDOMRect;
    messagePreview?: string;
}

const messagePreviewId = (roomId: string) => `mx_RoomTile_messagePreview_${roomId}`;

const contextMenuBelow = (elementRect: PartialDOMRect) => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.pageXOffset - 9;
    const top = elementRect.bottom + window.pageYOffset + 17;
    const chevronFace = ChevronFace.None;
    return {left, top, chevronFace};
};

export default class RoomTile extends React.PureComponent<IProps, IState> {
    private dispatcherRef: string;
    private roomTileRef = createRef<HTMLDivElement>();
    private notificationState: NotificationState;
    private roomProps: RoomEchoChamber;

    constructor(props: IProps) {
        super(props);

        this.state = {
            selected: ActiveRoomObserver.activeRoomId === this.props.room.roomId,
            notificationsMenuPosition: null,
            generalMenuPosition: null,

            // generatePreview() will return nothing if the user has previews disabled
            messagePreview: this.generatePreview(),
        };

        ActiveRoomObserver.addListener(this.props.room.roomId, this.onActiveRoomUpdate);
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        MessagePreviewStore.instance.on(ROOM_PREVIEW_CHANGED, this.onRoomPreviewChanged);
        this.notificationState = RoomNotificationStateStore.instance.getRoomState(this.props.room);
        this.notificationState.on(NOTIFICATION_STATE_UPDATE, this.onNotificationUpdate);
        this.roomProps = EchoChamber.forRoom(this.props.room);
        this.roomProps.on(PROPERTY_UPDATED, this.onRoomPropertyUpdate);
    }

    private onNotificationUpdate = () => {
        this.forceUpdate(); // notification state changed - update
    };

    private onRoomPropertyUpdate = (property: CachedRoomKey) => {
        if (property === CachedRoomKey.NotificationVolume) this.onNotificationUpdate();
        // else ignore - not important for this tile
    };

    private get showContextMenu(): boolean {
        return this.props.tag !== DefaultTagID.Invite;
    }

    private get showMessagePreview(): boolean {
        return !this.props.isMinimized && this.props.showMessagePreview;
    }

    public componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>) {
        if (prevProps.showMessagePreview !== this.props.showMessagePreview && this.showMessagePreview) {
            this.setState({messagePreview: this.generatePreview()});
        }
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
        MessagePreviewStore.instance.off(ROOM_PREVIEW_CHANGED, this.onRoomPreviewChanged);
        this.notificationState.off(NOTIFICATION_STATE_UPDATE, this.onNotificationUpdate);
    }

    private onAction = (payload: ActionPayload) => {
        if (payload.action === "view_room" && payload.room_id === this.props.room.roomId && payload.show_room_tile) {
            setImmediate(() => {
                this.scrollIntoView();
            });
        }
    };

    private onRoomPreviewChanged = (room: Room) => {
        if (this.props.room && room.roomId === this.props.room.roomId) {
            // generatePreview() will return nothing if the user has previews disabled
            this.setState({messagePreview: this.generatePreview()});
        }
    };

    private generatePreview(): string | null {
        if (!this.showMessagePreview) {
            return null;
        }

        return MessagePreviewStore.instance.getPreviewForRoom(this.props.room, this.props.tag);
    }

    private scrollIntoView = () => {
        if (!this.roomTileRef.current) return;
        this.roomTileRef.current.scrollIntoView({
            block: "nearest",
            behavior: "auto",
        });
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

        if (tagId === DefaultTagID.Favourite || tagId === DefaultTagID.LowPriority) {
            const inverseTag = tagId === DefaultTagID.Favourite ? DefaultTagID.LowPriority : DefaultTagID.Favourite;
            const isApplied = RoomListStore.instance.getTagsForRoom(this.props.room).includes(tagId);
            const removeTag = isApplied ? tagId : inverseTag;
            const addTag = isApplied ? null : tagId;
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

        this.roomProps.notificationVolume = newState;

        const key = (ev as React.KeyboardEvent).key;
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
        if (MatrixClientPeg.get().isGuest() || this.props.tag === DefaultTagID.Archived ||
            !this.showContextMenu || this.props.isMinimized
        ) {
            // the menu makes no sense in these cases so do not show one
            return null;
        }

        const state = this.roomProps.notificationVolume;

        let contextMenu = null;
        if (this.state.notificationsMenuPosition) {
            contextMenu = <IconizedContextMenu
                {...contextMenuBelow(this.state.notificationsMenuPosition)}
                onFinished={this.onCloseNotificationsMenu}
                className="mx_RoomTile_contextMenu"
                compact
            >
                <IconizedContextMenuOptionList first>
                    <IconizedContextMenuRadio
                        label={_t("Use default")}
                        active={state === ALL_MESSAGES}
                        iconClassName="mx_RoomTile_iconBell"
                        onClick={this.onClickAllNotifs}
                    />
                    <IconizedContextMenuRadio
                        label={_t("All messages")}
                        active={state === ALL_MESSAGES_LOUD}
                        iconClassName="mx_RoomTile_iconBellDot"
                        onClick={this.onClickAlertMe}
                    />
                    <IconizedContextMenuRadio
                        label={_t("Mentions & Keywords")}
                        active={state === MENTIONS_ONLY}
                        iconClassName="mx_RoomTile_iconBellMentions"
                        onClick={this.onClickMentions}
                    />
                    <IconizedContextMenuRadio
                        label={_t("None")}
                        active={state === MUTE}
                        iconClassName="mx_RoomTile_iconBellCrossed"
                        onClick={this.onClickMute}
                    />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>;
        }

        const classes = classNames("mx_RoomTile_notificationsButton", {
            // Show bell icon for the default case too.
            mx_RoomTile_iconBell: state === ALL_MESSAGES,
            mx_RoomTile_iconBellDot: state === ALL_MESSAGES_LOUD,
            mx_RoomTile_iconBellMentions: state === MENTIONS_ONLY,
            mx_RoomTile_iconBellCrossed: state === MUTE,

            // Only show the icon by default if the room is overridden to muted.
            // TODO: [FTUE Notifications] Probably need to detect global mute state
            mx_RoomTile_notificationsButton_show: state === MUTE,
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

        let contextMenu = null;
        if (this.state.generalMenuPosition && this.props.tag === DefaultTagID.Archived) {
            contextMenu = <IconizedContextMenu
                {...contextMenuBelow(this.state.generalMenuPosition)}
                onFinished={this.onCloseGeneralMenu}
                className="mx_RoomTile_contextMenu"
                compact
            >
                <IconizedContextMenuOptionList red>
                    <IconizedContextMenuOption
                        iconClassName="mx_RoomTile_iconSignOut"
                        label={_t("Forget Room")}
                        onClick={this.onForgetRoomClick}
                    />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>;
        } else if (this.state.generalMenuPosition) {
            const roomTags = RoomListStore.instance.getTagsForRoom(this.props.room);

            const isFavorite = roomTags.includes(DefaultTagID.Favourite);
            const favouriteLabel = isFavorite ? _t("Favourited") : _t("Favourite");

            const isLowPriority = roomTags.includes(DefaultTagID.LowPriority);
            const lowPriorityLabel = _t("Low Priority");

            contextMenu = <IconizedContextMenu
                {...contextMenuBelow(this.state.generalMenuPosition)}
                onFinished={this.onCloseGeneralMenu}
                className="mx_RoomTile_contextMenu"
                compact
            >
                <IconizedContextMenuOptionList>
                    <IconizedContextMenuCheckbox
                        onClick={(e) => this.onTagRoom(e, DefaultTagID.Favourite)}
                        active={isFavorite}
                        label={favouriteLabel}
                        iconClassName="mx_RoomTile_iconStar"
                    />
                    <IconizedContextMenuCheckbox
                        onClick={(e) => this.onTagRoom(e, DefaultTagID.LowPriority)}
                        active={isLowPriority}
                        label={lowPriorityLabel}
                        iconClassName="mx_RoomTile_iconArrowDown"
                    />

                    <IconizedContextMenuOption
                        onClick={this.onOpenRoomSettings}
                        label={_t("Settings")}
                        iconClassName="mx_RoomTile_iconSettings"
                    />
                </IconizedContextMenuOptionList>
                <IconizedContextMenuOptionList red>
                    <IconizedContextMenuOption
                        onClick={this.onLeaveRoomClick}
                        label={_t("Leave Room")}
                        iconClassName="mx_RoomTile_iconSignOut"
                    />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>;
        }

        return (
            <React.Fragment>
                <ContextMenuTooltipButton
                    className="mx_RoomTile_menuButton"
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
            'mx_RoomTile': true,
            'mx_RoomTile_selected': this.state.selected,
            'mx_RoomTile_hasMenuOpen': !!(this.state.generalMenuPosition || this.state.notificationsMenuPosition),
            'mx_RoomTile_minimized': this.props.isMinimized,
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
                <div className="mx_RoomTile_badgeContainer" aria-hidden="true">
                    <NotificationBadge
                        notification={this.notificationState}
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
        if (this.showMessagePreview && this.state.messagePreview) {
            messagePreview = (
                <div className="mx_RoomTile_messagePreview" id={messagePreviewId(this.props.room.roomId)}>
                    {this.state.messagePreview}
                </div>
            );
        }

        const nameClasses = classNames({
            "mx_RoomTile_name": true,
            "mx_RoomTile_nameWithPreview": !!messagePreview,
            "mx_RoomTile_nameHasUnreadEvents": this.notificationState.isUnread,
        });

        let nameContainer = (
            <div className="mx_RoomTile_nameContainer">
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
        } else if (this.notificationState.hasMentions) {
            ariaLabel += " " + _t("%(count)s unread messages including mentions.", {
                count: this.notificationState.count,
            });
        } else if (this.notificationState.hasUnreadCount) {
            ariaLabel += " " + _t("%(count)s unread messages.", {
                count: this.notificationState.count,
            });
        } else if (this.notificationState.isUnread) {
            ariaLabel += " " + _t("Unread messages.");
        }

        let ariaDescribedBy: string;
        if (this.showMessagePreview) {
            ariaDescribedBy = messagePreviewId(this.props.room.roomId);
        }

        const props: Partial<React.ComponentProps<typeof AccessibleTooltipButton>> = {};
        let Button: React.ComponentType<React.ComponentProps<typeof AccessibleButton>> = AccessibleButton;
        if (this.props.isMinimized) {
            Button = AccessibleTooltipButton;
            props.title = name;
            // force the tooltip to hide whilst we are showing the context menu
            props.forceHide = !!this.state.generalMenuPosition;
        }

        return (
            <React.Fragment>
                <RovingTabIndexWrapper inputRef={this.roomTileRef}>
                    {({onFocus, isActive, ref}) =>
                        <Button
                            {...props}
                            onFocus={onFocus}
                            tabIndex={isActive ? 0 : -1}
                            inputRef={ref}
                            className={classes}
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
                        </Button>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}
