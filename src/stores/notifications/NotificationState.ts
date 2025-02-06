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

    public get isIdle(): boolean {
        return this.level <= NotificationLevel.None;
    }

    public get isUnread(): boolean {
        if (this.level > NotificationLevel.Activity) {
            return true;
        } else {
            const hideBold = SettingsStore.getValue("feature_hidebold");
            return this.level === NotificationLevel.Activity && !hideBold;
        }
    }

    public get hasUnreadCount(): boolean {
        return this.level >= NotificationLevel.Notification && (!!this.count || !!this.symbol);
    }

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

    public constructor(state: INotificationStateSnapshotParams) {
        this.symbol = state.symbol;
        this.count = state.count;
        this.level = state.level;
        this.muted = state.muted;
        this.knocked = state.knocked;
    }

    public isDifferentFrom(other: INotificationStateSnapshotParams): boolean {
        const before = {
            count: this.count,
            symbol: this.symbol,
            level: this.level,
            muted: this.muted,
            knocked: this.knocked,
        };
        const after = {
            count: other.count,
            symbol: other.symbol,
            level: other.level,
            muted: other.muted,
            knocked: other.knocked,
        };
        return JSON.stringify(before) !== JSON.stringify(after);
    }
}
