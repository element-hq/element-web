/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import { NotificationLevel } from "./NotificationLevel";
import { type IDestroyable } from "../../utils/IDestroyable";
import SettingsStore from "../../settings/SettingsStore";

export interface INotificationStateSnapshotParams {
    symbol: string | null;
    count: number;
    level: NotificationLevel;
    muted: boolean;
    knocked: boolean;
    invited: boolean;
}

export enum NotificationStateEvents {
    Update = "update",
}

type EventHandlerMap = {
    [NotificationStateEvents.Update]: () => void;
};

export abstract class NotificationState
    extends TypedEventEmitter<NotificationStateEvents, EventHandlerMap>
    implements INotificationStateSnapshotParams, IDestroyable
{
    //
    protected _symbol: string | null = null;
    protected _count = 0;
    protected _level: NotificationLevel = NotificationLevel.None;
    protected _muted = false;
    protected _knocked = false;
    protected _invited = false;

    private watcherReferences: string[] = [];

    public constructor() {
        super();
        this.watcherReferences.push(
            SettingsStore.watchSetting("feature_hidebold", null, () => {
                this.emit(NotificationStateEvents.Update);
            }),
        );
    }

    public get symbol(): string | null {
        return this._symbol;
    }

    public get count(): number {
        return this._count;
    }

    public get level(): NotificationLevel {
        return this._level;
    }

    public get muted(): boolean {
        return this._muted;
    }

    public get knocked(): boolean {
        return this._knocked;
    }

    /**
     * True if the notification is an invitation notification.
     * Invite notifications are a special case of highlight notifications
     */
    public get invited(): boolean {
        return this._invited;
    }

    public get isIdle(): boolean {
        return this.level <= NotificationLevel.None;
    }

    /**
     * True if the notification is higher than an activity notification or if the feature_hidebold is disabled with an activity notification.
     * The "unread" term used here is different from the "Unread" in the UI. Unread in the UI doesn't include activity notifications even with feature_hidebold disabled.
     */
    public get isUnread(): boolean {
        if (this.level > NotificationLevel.Activity) {
            return true;
        } else {
            const hideBold = SettingsStore.getValue("feature_hidebold");
            return this.level === NotificationLevel.Activity && !hideBold;
        }
    }

    /**
     * True if the notification has a count or a symbol and is equal or greater than an NotificationLevel.Notification.
     */
    public get hasUnreadCount(): boolean {
        return this.level >= NotificationLevel.Notification && (!!this.count || !!this.symbol);
    }

    /**
     * True if the notification is a mention, an invitation, a knock or a unset message.
     *
     * @deprecated because the name is confusing. A mention is not an invitation, a knock or an unsent message.
     * In case of a {@link RoomNotificationState}, use {@link RoomNotificationState.isMention} instead.
     */
    public get hasMentions(): boolean {
        return this.level >= NotificationLevel.Highlight;
    }

    protected emitIfUpdated(snapshot: NotificationStateSnapshot): void {
        if (snapshot.isDifferentFrom(this)) {
            this.emit(NotificationStateEvents.Update);
        }
    }

    protected snapshot(): NotificationStateSnapshot {
        return new NotificationStateSnapshot(this);
    }

    public destroy(): void {
        this.removeAllListeners(NotificationStateEvents.Update);
        for (const watcherReference of this.watcherReferences) {
            SettingsStore.unwatchSetting(watcherReference);
        }
        this.watcherReferences = [];
    }
}

export class NotificationStateSnapshot {
    private readonly symbol: string | null;
    private readonly count: number;
    private readonly level: NotificationLevel;
    private readonly muted: boolean;
    private readonly knocked: boolean;
    private readonly isInvitation: boolean;

    public constructor(state: INotificationStateSnapshotParams) {
        this.symbol = state.symbol;
        this.count = state.count;
        this.level = state.level;
        this.muted = state.muted;
        this.knocked = state.knocked;
        this.isInvitation = state.invited;
    }

    /**
     * Whether the given state differs from the one captured by this snapshot.
     *
     * @param other - the state to compare this snapshot against
     * @returns true if any of the snapshotted fields has changed
     */
    public isDifferentFrom(other: INotificationStateSnapshotParams): boolean {
        // Compare the fields directly rather than serialising two object literals. Keeping those
        // literals in step by hand is what let the invited flag be captured on one side only, and
        // an unpaired key makes the two serialisations differ for every possible input.
        return (
            this.count !== other.count ||
            this.symbol !== other.symbol ||
            this.level !== other.level ||
            this.muted !== other.muted ||
            this.knocked !== other.knocked ||
            this.isInvitation !== other.invited
        );
    }
}
