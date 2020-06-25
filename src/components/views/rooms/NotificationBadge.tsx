/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import classNames from "classnames";
import { formatMinimalBadgeCount } from "../../../utils/FormattingUtils";
import { Room } from "matrix-js-sdk/src/models/room";
import * as RoomNotifs from '../../../RoomNotifs';
import { EffectiveMembership, getEffectiveMembership } from "../../../stores/room-list/membership";
import * as Unread from '../../../Unread';
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventEmitter } from "events";
import { arrayDiff } from "../../../utils/arrays";
import { IDestroyable } from "../../../utils/IDestroyable";
import SettingsStore from "../../../settings/SettingsStore";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import { readReceiptChangeIsFor } from "../../../utils/read-receipts";

export const NOTIFICATION_STATE_UPDATE = "update";

export enum NotificationColor {
    // Inverted (None -> Red) because we do integer comparisons on this
    None, // nothing special
    Bold, // no badge, show as unread // TODO: This goes away with new notification structures
    Grey, // unread notified messages
    Red,  // unread pings
}

export interface INotificationState extends EventEmitter {
    symbol?: string;
    count: number;
    color: NotificationColor;
}

interface IProps {
    notification: INotificationState;

    /**
     * If true, the badge will show a count if at all possible. This is typically
     * used to override the user's preference for things like room sublists.
     */
    forceCount: boolean;

    /**
     * The room ID, if any, the badge represents.
     */
    roomId?: string;
}

interface IState {
    showCounts: boolean; // whether or not to show counts. Independent of props.forceCount
}

export default class NotificationBadge extends React.PureComponent<IProps, IState> {
    private countWatcherRef: string;

    constructor(props: IProps) {
        super(props);
        this.props.notification.on(NOTIFICATION_STATE_UPDATE, this.onNotificationUpdate);

        this.state = {
            showCounts: SettingsStore.getValue("Notifications.alwaysShowBadgeCounts", this.roomId),
        };

        this.countWatcherRef = SettingsStore.watchSetting(
            "Notifications.alwaysShowBadgeCounts", this.roomId,
            this.countPreferenceChanged,
        );
    }

    private get roomId(): string {
        // We should convert this to null for safety with the SettingsStore
        return this.props.roomId || null;
    }

    public componentWillUnmount() {
        SettingsStore.unwatchSetting(this.countWatcherRef);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>) {
        if (prevProps.notification) {
            prevProps.notification.off(NOTIFICATION_STATE_UPDATE, this.onNotificationUpdate);
        }

        this.props.notification.on(NOTIFICATION_STATE_UPDATE, this.onNotificationUpdate);
    }

    private countPreferenceChanged = () => {
        this.setState({showCounts: SettingsStore.getValue("Notifications.alwaysShowBadgeCounts", this.roomId)});
    };

    private onNotificationUpdate = () => {
        this.forceUpdate(); // notification state changed - update
    };

    public render(): React.ReactElement {
        // Don't show a badge if we don't need to
        if (this.props.notification.color <= NotificationColor.None) return null;

        const hasNotif = this.props.notification.color >= NotificationColor.Red;
        const hasCount = this.props.notification.color >= NotificationColor.Grey;
        const hasUnread = this.props.notification.color >= NotificationColor.Bold;
        const couldBeEmpty = (!this.state.showCounts || hasUnread) && !hasNotif;
        let isEmptyBadge = couldBeEmpty && (!this.state.showCounts || !hasCount);
        if (this.props.forceCount) {
            isEmptyBadge = false;
            if (!hasCount) return null; // Can't render a badge
        }

        let symbol = this.props.notification.symbol || formatMinimalBadgeCount(this.props.notification.count);
        if (isEmptyBadge) symbol = "";

        const classes = classNames({
            'mx_NotificationBadge': true,
            'mx_NotificationBadge_visible': isEmptyBadge ? true : hasCount,
            'mx_NotificationBadge_highlighted': hasNotif,
            'mx_NotificationBadge_dot': isEmptyBadge,
            'mx_NotificationBadge_2char': symbol.length > 0 && symbol.length < 3,
            'mx_NotificationBadge_3char': symbol.length > 2,
        });

        return (
            <div className={classes}>
                <span className="mx_NotificationBadge_count">{symbol}</span>
            </div>
        );
    }
}

export class RoomNotificationState extends EventEmitter implements IDestroyable, INotificationState {
    private _symbol: string;
    private _count: number;
    private _color: NotificationColor;

    constructor(private room: Room) {
        super();
        this.room.on("Room.receipt", this.handleReadReceipt);
        this.room.on("Room.timeline", this.handleRoomEventUpdate);
        this.room.on("Room.redaction", this.handleRoomEventUpdate);
        MatrixClientPeg.get().on("Event.decrypted", this.handleRoomEventUpdate);
        this.updateNotificationState();
    }

    public get symbol(): string {
        return this._symbol;
    }

    public get count(): number {
        return this._count;
    }

    public get color(): NotificationColor {
        return this._color;
    }

    private get roomIsInvite(): boolean {
        return getEffectiveMembership(this.room.getMyMembership()) === EffectiveMembership.Invite;
    }

    public destroy(): void {
        this.room.removeListener("Room.receipt", this.handleReadReceipt);
        this.room.removeListener("Room.timeline", this.handleRoomEventUpdate);
        this.room.removeListener("Room.redaction", this.handleRoomEventUpdate);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Event.decrypted", this.handleRoomEventUpdate);
        }
    }

    private handleReadReceipt = (event: MatrixEvent, room: Room) => {
        if (!readReceiptChangeIsFor(event, MatrixClientPeg.get())) return; // not our own - ignore
        if (room.roomId !== this.room.roomId) return; // not for us - ignore
        this.updateNotificationState();
    };

    private handleRoomEventUpdate = (event: MatrixEvent) => {
        const roomId = event.getRoomId();

        if (roomId !== this.room.roomId) return; // ignore - not for us
        this.updateNotificationState();
    };

    private updateNotificationState() {
        const before = {count: this.count, symbol: this.symbol, color: this.color};

        if (this.roomIsInvite) {
            this._color = NotificationColor.Red;
            this._symbol = "!";
            this._count = 1; // not used, technically
        } else {
            const redNotifs = RoomNotifs.getUnreadNotificationCount(this.room, 'highlight');
            const greyNotifs = RoomNotifs.getUnreadNotificationCount(this.room, 'total');

            // For a 'true count' we pick the grey notifications first because they include the
            // red notifications. If we don't have a grey count for some reason we use the red
            // count. If that count is broken for some reason, assume zero. This avoids us showing
            // a badge for 'NaN' (which formats as 'NaNB' for NaN Billion).
            const trueCount = greyNotifs ? greyNotifs : (redNotifs ? redNotifs : 0);

            // Note: we only set the symbol if we have an actual count. We don't want to show
            // zero on badges.

            if (redNotifs > 0) {
                this._color = NotificationColor.Red;
                this._count = trueCount;
                this._symbol = null; // symbol calculated by component
            } else if (greyNotifs > 0) {
                this._color = NotificationColor.Grey;
                this._count = trueCount;
                this._symbol = null; // symbol calculated by component
            } else {
                // We don't have any notified messages, but we might have unread messages. Let's
                // find out.
                const hasUnread = Unread.doesRoomHaveUnreadMessages(this.room);
                if (hasUnread) {
                    this._color = NotificationColor.Bold;
                } else {
                    this._color = NotificationColor.None;
                }

                // no symbol or count for this state
                this._count = 0;
                this._symbol = null;
            }
        }

        // finally, publish an update if needed
        const after = {count: this.count, symbol: this.symbol, color: this.color};
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            this.emit(NOTIFICATION_STATE_UPDATE);
        }
    }
}

export class TagSpecificNotificationState extends RoomNotificationState {
    private static TAG_TO_COLOR: {
        // @ts-ignore - TS wants this to be a string key, but we know better
        [tagId: TagID]: NotificationColor,
    } = {
        [DefaultTagID.DM]: NotificationColor.Red,
    };

    private readonly colorWhenNotIdle?: NotificationColor;

    constructor(room: Room, tagId: TagID) {
        super(room);

        const specificColor = TagSpecificNotificationState.TAG_TO_COLOR[tagId];
        if (specificColor) this.colorWhenNotIdle = specificColor;
    }

    public get color(): NotificationColor {
        if (!this.colorWhenNotIdle) return super.color;

        if (super.color !== NotificationColor.None) return this.colorWhenNotIdle;
        return super.color;
    }
}

export class ListNotificationState extends EventEmitter implements IDestroyable, INotificationState {
    private _count: number;
    private _color: NotificationColor;
    private rooms: Room[] = [];
    private states: { [roomId: string]: RoomNotificationState } = {};

    constructor(private byTileCount = false, private tagId: TagID) {
        super();
    }

    public get symbol(): string {
        return null; // This notification state doesn't support symbols
    }

    public get count(): number {
        return this._count;
    }

    public get color(): NotificationColor {
        return this._color;
    }

    public setRooms(rooms: Room[]) {
        // If we're only concerned about the tile count, don't bother setting up listeners.
        if (this.byTileCount) {
            this.rooms = rooms;
            this.calculateTotalState();
            return;
        }

        const oldRooms = this.rooms;
        const diff = arrayDiff(oldRooms, rooms);
        this.rooms = rooms;
        for (const oldRoom of diff.removed) {
            const state = this.states[oldRoom.roomId];
            if (!state) continue; // We likely just didn't have a badge (race condition)
            delete this.states[oldRoom.roomId];
            state.off(NOTIFICATION_STATE_UPDATE, this.onRoomNotificationStateUpdate);
            state.destroy();
        }
        for (const newRoom of diff.added) {
            const state = new TagSpecificNotificationState(newRoom, this.tagId);
            state.on(NOTIFICATION_STATE_UPDATE, this.onRoomNotificationStateUpdate);
            if (this.states[newRoom.roomId]) {
                // "Should never happen" disclaimer.
                console.warn("Overwriting notification state for room:", newRoom.roomId);
                this.states[newRoom.roomId].destroy();
            }
            this.states[newRoom.roomId] = state;
        }

        this.calculateTotalState();
    }

    public getForRoom(room: Room) {
        const state = this.states[room.roomId];
        if (!state) throw new Error("Unknown room for notification state");
        return state;
    }

    public destroy() {
        for (const state of Object.values(this.states)) {
            state.destroy();
        }
        this.states = {};
    }

    private onRoomNotificationStateUpdate = () => {
        this.calculateTotalState();
    };

    private calculateTotalState() {
        const before = {count: this.count, symbol: this.symbol, color: this.color};

        if (this.byTileCount) {
            this._color = NotificationColor.Red;
            this._count = this.rooms.length;
        } else {
            this._count = 0;
            this._color = NotificationColor.None;
            for (const state of Object.values(this.states)) {
                this._count += state.count;
                this._color = Math.max(this.color, state.color);
            }
        }

        // finally, publish an update if needed
        const after = {count: this.count, symbol: this.symbol, color: this.color};
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            this.emit(NOTIFICATION_STATE_UPDATE);
        }
    }
}
