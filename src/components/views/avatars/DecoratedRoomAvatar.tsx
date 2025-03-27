/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import classNames from "classnames";
import {
    EventType,
    JoinRule,
    type MatrixEvent,
    type Room,
    RoomEvent,
    type User,
    UserEvent,
} from "matrix-js-sdk/src/matrix";
import { UnstableValue } from "matrix-js-sdk/src/NamespacedValue";
import { Tooltip } from "@vector-im/compound-web";

import RoomAvatar from "./RoomAvatar";
import NotificationBadge from "../rooms/NotificationBadge";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { type NotificationState } from "../../../stores/notifications/NotificationState";
import { isPresenceEnabled } from "../../../utils/presence";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";
import { type IOOBData } from "../../../stores/ThreepidInviteStore";
import { getJoinedNonFunctionalMembers } from "../../../utils/room/getJoinedNonFunctionalMembers";

interface IProps {
    room: Room;
    size: string;
    displayBadge?: boolean;
    /**
     * If true, show nothing if the notification would only cause a dot to be shown rather than
     * a badge. That is: only display badges and not dots. Default: false.
     */
    hideIfDot?: boolean;
    oobData?: IOOBData;
    viewAvatarOnClick?: boolean;
    tooltipProps?: {
        tabIndex?: number;
    };
}

interface IState {
    notificationState?: NotificationState;
    icon: Icon;
}

const BUSY_PRESENCE_NAME = new UnstableValue("busy", "org.matrix.msc3026.busy");

enum Icon {
    // Note: the names here are used in CSS class names
    None = "NONE", // ... except this one
    Globe = "GLOBE",
    PresenceOnline = "ONLINE",
    PresenceAway = "AWAY",
    PresenceOffline = "OFFLINE",
    PresenceBusy = "BUSY",
}

function tooltipText(variant: Icon): string | undefined {
    switch (variant) {
        case Icon.Globe:
            return _t("room|header|room_is_public");
        case Icon.PresenceOnline:
            return _t("presence|online");
        case Icon.PresenceAway:
            return _t("presence|away");
        case Icon.PresenceOffline:
            return _t("presence|offline");
        case Icon.PresenceBusy:
            return _t("presence|busy");
    }
}

export default class DecoratedRoomAvatar extends React.PureComponent<IProps, IState> {
    private _dmUser: User | null = null;
    private isUnmounted = false;
    private isWatchingTimeline = false;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            notificationState: RoomNotificationStateStore.instance.getRoomState(this.props.room),
            icon: this.calculateIcon(),
        };
    }

    public componentWillUnmount(): void {
        this.isUnmounted = true;
        if (this.isWatchingTimeline) this.props.room.off(RoomEvent.Timeline, this.onRoomTimeline);
        this.dmUser = null; // clear listeners, if any
    }

    private get isPublicRoom(): boolean {
        return this.props.room.getJoinRule() === JoinRule.Public;
    }

    private get dmUser(): User | null {
        return this._dmUser;
    }

    private set dmUser(val: User | null) {
        const oldUser = this._dmUser;
        this._dmUser = val;
        if (oldUser && oldUser !== this._dmUser) {
            oldUser.off(UserEvent.CurrentlyActive, this.onPresenceUpdate);
            oldUser.off(UserEvent.Presence, this.onPresenceUpdate);
        }
        if (this._dmUser && oldUser !== this._dmUser) {
            this._dmUser.on(UserEvent.CurrentlyActive, this.onPresenceUpdate);
            this._dmUser.on(UserEvent.Presence, this.onPresenceUpdate);
        }
    }

    private onRoomTimeline = (ev: MatrixEvent, room?: Room): void => {
        if (this.isUnmounted) return;
        if (this.props.room.roomId !== room?.roomId) return;

        if (ev.getType() === EventType.RoomJoinRules || ev.getType() === EventType.RoomMember) {
            const newIcon = this.calculateIcon();
            if (newIcon !== this.state.icon) {
                this.setState({ icon: newIcon });
            }
        }
    };

    private onPresenceUpdate = (): void => {
        if (this.isUnmounted) return;

        const newIcon = this.getPresenceIcon();
        if (newIcon !== this.state.icon) this.setState({ icon: newIcon });
    };

    private getPresenceIcon(): Icon {
        if (!this.dmUser) return Icon.None;

        let icon = Icon.None;

        const isOnline = this.dmUser.currentlyActive || this.dmUser.presence === "online";
        if (BUSY_PRESENCE_NAME.matches(this.dmUser.presence)) {
            icon = Icon.PresenceBusy;
        } else if (isOnline) {
            icon = Icon.PresenceOnline;
        } else if (this.dmUser.presence === "offline") {
            icon = Icon.PresenceOffline;
        } else if (this.dmUser.presence === "unavailable") {
            icon = Icon.PresenceAway;
        }

        return icon;
    }

    private calculateIcon(): Icon {
        let icon = Icon.None;

        // We look at the DMRoomMap and not the tag here so that we don't exclude DMs in Favourites
        const otherUserId = DMRoomMap.shared().getUserIdForRoomId(this.props.room.roomId);
        if (otherUserId && getJoinedNonFunctionalMembers(this.props.room).length === 2) {
            // Track presence, if available
            if (isPresenceEnabled(this.props.room.client)) {
                this.dmUser = MatrixClientPeg.safeGet().getUser(otherUserId);
                icon = this.getPresenceIcon();
            }
        } else {
            // Track publicity
            icon = this.isPublicRoom ? Icon.Globe : Icon.None;
            if (!this.isWatchingTimeline) {
                this.props.room.on(RoomEvent.Timeline, this.onRoomTimeline);
                this.isWatchingTimeline = true;
            }
        }
        return icon;
    }

    public render(): React.ReactNode {
        // Spread the remaining props to make it work with compound component
        const { room, size, displayBadge, hideIfDot, oobData, viewAvatarOnClick, tooltipProps, ...props } = this.props;

        let badge: React.ReactNode;
        if (this.props.displayBadge && this.state.notificationState) {
            badge = (
                <NotificationBadge
                    notification={this.state.notificationState}
                    hideIfDot={this.props.hideIfDot}
                    roomId={this.props.room.roomId}
                />
            );
        }

        let icon: JSX.Element | undefined;
        if (this.state.icon !== Icon.None) {
            icon = (
                <div
                    tabIndex={this.props.tooltipProps?.tabIndex ?? 0}
                    className={`mx_DecoratedRoomAvatar_icon mx_DecoratedRoomAvatar_icon_${this.state.icon.toLowerCase()}`}
                />
            );
        }

        const classes = classNames("mx_DecoratedRoomAvatar", {
            mx_DecoratedRoomAvatar_cutout: icon,
        });

        return (
            <div className={classes} {...props}>
                <RoomAvatar
                    room={this.props.room}
                    size={this.props.size}
                    oobData={this.props.oobData}
                    viewAvatarOnClick={this.props.viewAvatarOnClick}
                />
                {icon && (
                    <Tooltip label={tooltipText(this.state.icon)!} placement="bottom">
                        {icon}
                    </Tooltip>
                )}
                {badge}
            </div>
        );
    }
}
