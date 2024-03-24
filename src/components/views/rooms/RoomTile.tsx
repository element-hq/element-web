/*
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015-2017, 2019-2021 The Matrix.org Foundation C.I.C.

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

import classNames from "classnames";
import { Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import React, { ReactElement, createRef } from "react";
import { getKeyBindingsManager } from "matrix-react-sdk/src/KeyBindingsManager";
import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";
import PosthogTrackers from "matrix-react-sdk/src/PosthogTrackers";
import { RoomNotifState } from "matrix-react-sdk/src/RoomNotifs";
import { KeyBindingAction } from "matrix-react-sdk/src/accessibility/KeyboardShortcuts";
import { RovingTabIndexWrapper } from "matrix-react-sdk/src/accessibility/RovingTabIndex";
import {
    ChevronFace,
    ContextMenuTooltipButton,
    MenuProps,
} from "matrix-react-sdk/src/components/structures/ContextMenu";
import DecoratedRoomAvatar from "matrix-react-sdk/src/components/views/avatars/DecoratedRoomAvatar";
import { RoomGeneralContextMenu } from "matrix-react-sdk/src/components/views/context_menus/RoomGeneralContextMenu";
import { RoomNotificationContextMenu } from "matrix-react-sdk/src/components/views/context_menus/RoomNotificationContextMenu";
import AccessibleButton, { ButtonEvent } from "matrix-react-sdk/src/components/views/elements/AccessibleButton";
import AccessibleTooltipButton from "matrix-react-sdk/src/components/views/elements/AccessibleTooltipButton";
import NotificationBadge from "matrix-react-sdk/src/components/views/rooms/NotificationBadge";
import { RoomTileSubtitle } from "matrix-react-sdk/src/components/views/rooms/RoomTileSubtitle";
import { SdkContextClass } from "matrix-react-sdk/src/contexts/SDKContext";
import { shouldShowComponent } from "matrix-react-sdk/src/customisations/helpers/UIComponents";
import { Action } from "matrix-react-sdk/src/dispatcher/actions";
import defaultDispatcher from "matrix-react-sdk/src/dispatcher/dispatcher";
import { ActionPayload } from "matrix-react-sdk/src/dispatcher/payloads";
import { ViewRoomPayload } from "matrix-react-sdk/src/dispatcher/payloads/ViewRoomPayload";
import { _t } from "matrix-react-sdk/src/languageHandler";
import SettingsStore from "matrix-react-sdk/src/settings/SettingsStore";
import { UIComponent } from "matrix-react-sdk/src/settings/UIFeature";
import { CallStore, CallStoreEvent } from "matrix-react-sdk/src/stores/CallStore";
import { EchoChamber } from "matrix-react-sdk/src/stores/local-echo/EchoChamber";
import { PROPERTY_UPDATED } from "matrix-react-sdk/src/stores/local-echo/GenericEchoChamber";
import { CachedRoomKey, RoomEchoChamber } from "matrix-react-sdk/src/stores/local-echo/RoomEchoChamber";
import {
    NotificationState,
    NotificationStateEvents,
} from "matrix-react-sdk/src/stores/notifications/NotificationState";
import { RoomNotificationStateStore } from "matrix-react-sdk/src/stores/notifications/RoomNotificationStateStore";
import { MessagePreview, MessagePreviewStore } from "matrix-react-sdk/src/stores/room-list/MessagePreviewStore";
import { DefaultTagID, TagID } from "matrix-react-sdk/src/stores/room-list/models";
import { isKnockDenied } from "matrix-react-sdk/src/utils/membership";
import { useHasRoomLiveVoiceBroadcast } from "matrix-react-sdk/src/voice-broadcast";

import type { Call } from "matrix-react-sdk/src/models/Call";
import { RoomName } from "../elements/RoomName";
import { getRoomName } from "../../../hooks/useRoomName";

interface Props {
    room: Room;
    showMessagePreview: boolean;
    isMinimized: boolean;
    tag: TagID;
}

interface ClassProps extends Props {
    hasLiveVoiceBroadcast: boolean;
}

type PartialDOMRect = Pick<DOMRect, "left" | "bottom">;

interface State {
    selected: boolean;
    notificationsMenuPosition: PartialDOMRect | null;
    generalMenuPosition: PartialDOMRect | null;
    call: Call | null;
    messagePreview: MessagePreview | null;
}

const messagePreviewId = (roomId: string): string => `mx_RoomTile_messagePreview_${roomId}`;

export const contextMenuBelow = (elementRect: PartialDOMRect): MenuProps => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.scrollX - 9;
    const top = elementRect.bottom + window.scrollY + 17;
    const chevronFace = ChevronFace.None;
    return { left, top, chevronFace };
};

export class RoomTile extends React.PureComponent<ClassProps, State> {
    private dispatcherRef?: string;
    private roomTileRef = createRef<HTMLDivElement>();
    private notificationState: NotificationState;
    private roomProps: RoomEchoChamber;

    public constructor(props: ClassProps) {
        super(props);

        this.state = {
            selected: SdkContextClass.instance.roomViewStore.getRoomId() === this.props.room.roomId,
            notificationsMenuPosition: null,
            generalMenuPosition: null,
            call: CallStore.instance.getCall(this.props.room.roomId),
            // generatePreview() will return nothing if the user has previews disabled
            messagePreview: null,
        };
        this.generatePreview();

        this.notificationState = RoomNotificationStateStore.instance.getRoomState(this.props.room);
        this.roomProps = EchoChamber.forRoom(this.props.room);
    }

    private onRoomNameUpdate = (room: Room): void => {
        this.forceUpdate();
    };

    private onNotificationUpdate = (): void => {
        this.forceUpdate(); // notification state changed - update
    };

    private onRoomPropertyUpdate = (property: CachedRoomKey): void => {
        if (property === CachedRoomKey.NotificationVolume) this.onNotificationUpdate();
        // else ignore - not important for this tile
    };

    private get showContextMenu(): boolean {
        return (
            this.props.tag !== DefaultTagID.Invite &&
            this.props.room.getMyMembership() !== "knock" &&
            !isKnockDenied(this.props.room) &&
            shouldShowComponent(UIComponent.RoomOptionsMenu)
        );
    }

    private get showMessagePreview(): boolean {
        return !this.props.isMinimized && this.props.showMessagePreview;
    }

    public componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>): void {
        const showMessageChanged = prevProps.showMessagePreview !== this.props.showMessagePreview;
        const minimizedChanged = prevProps.isMinimized !== this.props.isMinimized;
        if (showMessageChanged || minimizedChanged) {
            this.generatePreview();
        }
        if (prevProps.room?.roomId !== this.props.room?.roomId) {
            MessagePreviewStore.instance.off(
                MessagePreviewStore.getPreviewChangedEventName(prevProps.room),
                this.onRoomPreviewChanged,
            );
            MessagePreviewStore.instance.on(
                MessagePreviewStore.getPreviewChangedEventName(this.props.room),
                this.onRoomPreviewChanged,
            );
            prevProps.room?.off(RoomEvent.Name, this.onRoomNameUpdate);
            this.props.room?.on(RoomEvent.Name, this.onRoomNameUpdate);
        }
    }

    public componentDidMount(): void {
        // when we're first rendered (or our sublist is expanded) make sure we are visible if we're active
        if (this.state.selected) {
            this.scrollIntoView();
        }

        SdkContextClass.instance.roomViewStore.addRoomListener(this.props.room.roomId, this.onActiveRoomUpdate);
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        MessagePreviewStore.instance.on(
            MessagePreviewStore.getPreviewChangedEventName(this.props.room),
            this.onRoomPreviewChanged,
        );
        this.notificationState.on(NotificationStateEvents.Update, this.onNotificationUpdate);
        this.roomProps.on(PROPERTY_UPDATED, this.onRoomPropertyUpdate);
        this.props.room.on(RoomEvent.Name, this.onRoomNameUpdate);
        CallStore.instance.on(CallStoreEvent.Call, this.onCallChanged);

        // Recalculate the call for this room, since it could've changed between
        // construction and mounting
        this.setState({ call: CallStore.instance.getCall(this.props.room.roomId) });
    }

    public componentWillUnmount(): void {
        SdkContextClass.instance.roomViewStore.removeRoomListener(this.props.room.roomId, this.onActiveRoomUpdate);
        MessagePreviewStore.instance.off(
            MessagePreviewStore.getPreviewChangedEventName(this.props.room),
            this.onRoomPreviewChanged,
        );
        this.props.room.off(RoomEvent.Name, this.onRoomNameUpdate);
        if (this.dispatcherRef) defaultDispatcher.unregister(this.dispatcherRef);
        this.notificationState.off(NotificationStateEvents.Update, this.onNotificationUpdate);
        this.roomProps.off(PROPERTY_UPDATED, this.onRoomPropertyUpdate);
        CallStore.instance.off(CallStoreEvent.Call, this.onCallChanged);
    }

    private onAction = (payload: ActionPayload): void => {
        if (
            payload.action === Action.ViewRoom &&
            payload.room_id === this.props.room.roomId &&
            payload.show_room_tile
        ) {
            setImmediate(() => {
                this.scrollIntoView();
            });
        }
    };

    private onRoomPreviewChanged = (room: Room): void => {
        if (this.props.room && room.roomId === this.props.room.roomId) {
            this.generatePreview();
        }
    };

    private onCallChanged = (call: Call, roomId: string): void => {
        if (roomId === this.props.room?.roomId) this.setState({ call });
    };

    private async generatePreview(): Promise<void> {
        if (!this.showMessagePreview) {
            return;
        }

        const messagePreview =
            (await MessagePreviewStore.instance.getPreviewForRoom(this.props.room, this.props.tag)) ?? null;
        this.setState({ messagePreview });
    }

    private scrollIntoView = (): void => {
        if (!this.roomTileRef.current) return;
        this.roomTileRef.current.scrollIntoView({
            block: "nearest",
            behavior: "auto",
        });
    };

    private onTileClick = async (ev: ButtonEvent): Promise<void> => {
        ev.preventDefault();
        ev.stopPropagation();

        const action = getKeyBindingsManager().getAccessibilityAction(ev as React.KeyboardEvent);
        const clearSearch = ([KeyBindingAction.Enter, KeyBindingAction.Space] as Array<string | undefined>).includes(
            action,
        );

        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            show_room_tile: true, // make sure the room is visible in the list
            room_id: this.props.room.roomId,
            clear_search: clearSearch,
            metricsTrigger: "RoomList",
            metricsViaKeyboard: ev.type !== "click",
        });
    };

    private onActiveRoomUpdate = (isActive: boolean): void => {
        this.setState({ selected: isActive });
    };

    private onNotificationsMenuOpenClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({ notificationsMenuPosition: target.getBoundingClientRect() });

        PosthogTrackers.trackInteraction("WebRoomListRoomTileNotificationsMenu", ev);
    };

    private onCloseNotificationsMenu = (): void => {
        this.setState({ notificationsMenuPosition: null });
    };

    private onGeneralMenuOpenClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({ generalMenuPosition: target.getBoundingClientRect() });
    };

    private onContextMenu = (ev: React.MouseEvent): void => {
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

    private onCloseGeneralMenu = (): void => {
        this.setState({ generalMenuPosition: null });
    };

    private renderNotificationsMenu(isActive: boolean): React.ReactElement | null {
        if (
            MatrixClientPeg.safeGet().isGuest() ||
            this.props.tag === DefaultTagID.Archived ||
            !this.showContextMenu ||
            this.props.isMinimized
        ) {
            // the menu makes no sense in these cases so do not show one
            return null;
        }

        const state = this.roomProps.notificationVolume;

        const classes = classNames("mx_RoomTile_notificationsButton", {
            // Show bell icon for the default case too.
            mx_RoomNotificationContextMenu_iconBell: state === RoomNotifState.AllMessages,
            mx_RoomNotificationContextMenu_iconBellDot: state === RoomNotifState.AllMessagesLoud,
            mx_RoomNotificationContextMenu_iconBellMentions: state === RoomNotifState.MentionsOnly,
            mx_RoomNotificationContextMenu_iconBellCrossed: state === RoomNotifState.Mute,

            // Only show the icon by default if the room is overridden to muted.
            // TODO: [FTUE Notifications] Probably need to detect global mute state
            mx_RoomTile_notificationsButton_show: state === RoomNotifState.Mute,
        });

        return (
            <React.Fragment>
                <ContextMenuTooltipButton
                    className={classes}
                    onClick={this.onNotificationsMenuOpenClick}
                    title={_t("room_list|notification_options")}
                    isExpanded={!!this.state.notificationsMenuPosition}
                    tabIndex={isActive ? 0 : -1}
                />
                {this.state.notificationsMenuPosition && (
                    <RoomNotificationContextMenu
                        {...contextMenuBelow(this.state.notificationsMenuPosition)}
                        onFinished={this.onCloseNotificationsMenu}
                        room={this.props.room}
                    />
                )}
            </React.Fragment>
        );
    }

    private renderGeneralMenu(): React.ReactElement | null {
        if (!this.showContextMenu) return null; // no menu to show
        return (
            <React.Fragment>
                <ContextMenuTooltipButton
                    className="mx_RoomTile_menuButton"
                    onClick={this.onGeneralMenuOpenClick}
                    title={_t("room|context_menu|title")}
                    isExpanded={!!this.state.generalMenuPosition}
                />
                {this.state.generalMenuPosition && (
                    <RoomGeneralContextMenu
                        {...contextMenuBelow(this.state.generalMenuPosition)}
                        onFinished={this.onCloseGeneralMenu}
                        room={this.props.room}
                        onPostFavoriteClick={(ev: ButtonEvent): void =>
                            PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuFavouriteToggle", ev)
                        }
                        onPostInviteClick={(ev: ButtonEvent): void =>
                            PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuInviteItem", ev)
                        }
                        onPostSettingsClick={(ev: ButtonEvent): void =>
                            PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuSettingsItem", ev)
                        }
                        onPostLeaveClick={(ev: ButtonEvent): void =>
                            PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuLeaveItem", ev)
                        }
                    />
                )}
            </React.Fragment>
        );
    }

    /**
     * RoomTile has a subtile if one of the following applies:
     * - there is a call
     * - there is a live voice broadcast
     * - message previews are enabled and there is a previewable message
     */
    private get shouldRenderSubtitle(): boolean {
        return (
            !!this.state.call ||
            this.props.hasLiveVoiceBroadcast ||
            (this.props.showMessagePreview && !!this.state.messagePreview)
        );
    }

    public render(): React.ReactElement {
        const classes = classNames({
            mx_RoomTile: true,
            mx_RoomTile_sticky:
                SettingsStore.getValue("feature_ask_to_join") &&
                (this.props.room.getMyMembership() === "knock" || isKnockDenied(this.props.room)),
            mx_RoomTile_selected: this.state.selected,
            mx_RoomTile_hasMenuOpen: !!(this.state.generalMenuPosition || this.state.notificationsMenuPosition),
            mx_RoomTile_minimized: this.props.isMinimized,
        });

        const name = getRoomName(this.props.room);
        let badge: React.ReactNode;
        if (!this.props.isMinimized && this.notificationState) {
            // aria-hidden because we summarise the unread count/highlight status in a manual aria-label below
            badge = (
                <div className="mx_RoomTile_badgeContainer" aria-hidden="true">
                    <NotificationBadge notification={this.notificationState} roomId={this.props.room.roomId} />
                </div>
            );
        }

        const subtitle = this.shouldRenderSubtitle ? (
            <RoomTileSubtitle
                call={this.state.call}
                hasLiveVoiceBroadcast={this.props.hasLiveVoiceBroadcast}
                messagePreview={this.state.messagePreview}
                roomId={this.props.room.roomId}
                showMessagePreview={this.props.showMessagePreview}
            />
        ) : null;

        const titleClasses = classNames({
            mx_RoomTile_title: true,
            mx_RoomTile_titleWithSubtitle: !!subtitle,
            mx_RoomTile_titleHasUnreadEvents: this.notificationState.isUnread,
        });

        const titleContainer = this.props.isMinimized ? null : (
            <div className="mx_RoomTile_titleContainer">
                <div title={name} className={titleClasses} tabIndex={-1}>
                    <RoomName room={this.props.room} />
                </div>
                {subtitle}
            </div>
        );

        let ariaLabel = name;
        // The following labels are written in such a fashion to increase screen reader efficiency (speed).
        if (this.props.tag === DefaultTagID.Invite) {
            // append nothing
        } else if (this.notificationState.hasMentions) {
            ariaLabel +=
                " " +
                _t("a11y|n_unread_messages_mentions", {
                    count: this.notificationState.count,
                });
        } else if (this.notificationState.hasUnreadCount) {
            ariaLabel +=
                " " +
                _t("a11y|n_unread_messages", {
                    count: this.notificationState.count,
                });
        } else if (this.notificationState.isUnread) {
            ariaLabel += " " + _t("a11y|unread_messages");
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
                    {({ onFocus, isActive, ref }): ReactElement<any, any> => (
                        <Button
                            {...props}
                            onFocus={onFocus}
                            tabIndex={isActive ? 0 : -1}
                            ref={ref}
                            className={classes}
                            onClick={this.onTileClick}
                            onContextMenu={this.onContextMenu}
                            role="treeitem"
                            aria-label={ariaLabel}
                            aria-selected={this.state.selected}
                            aria-describedby={ariaDescribedBy}
                        >
                            <DecoratedRoomAvatar
                                room={this.props.room}
                                size="32px"
                                displayBadge={this.props.isMinimized}
                                tooltipProps={{ tabIndex: isActive ? 0 : -1 }}
                            />
                            {titleContainer}
                            {badge}
                            {this.renderGeneralMenu()}
                            {this.renderNotificationsMenu(isActive)}
                        </Button>
                    )}
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}

const RoomTileHOC: React.FC<Props> = (props: Props) => {
    const hasLiveVoiceBroadcast = useHasRoomLiveVoiceBroadcast(props.room);
    return <RoomTile {...props} hasLiveVoiceBroadcast={hasLiveVoiceBroadcast} />;
};

export default RoomTileHOC;
