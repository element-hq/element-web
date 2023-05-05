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

import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import { NotificationColor } from "./NotificationColor";
import { IDestroyable } from "../../utils/IDestroyable";
import SettingsStore from "../../settings/SettingsStore";

export interface INotificationStateSnapshotParams {
    symbol: string | null;
    count: number;
    color: NotificationColor;
    muted: boolean;
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
    protected _color: NotificationColor = NotificationColor.None;
    protected _muted = false;

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

    public get color(): NotificationColor {
        return this._color;
    }

    public get muted(): boolean {
        return this._muted;
    }

    public get isIdle(): boolean {
        return this.color <= NotificationColor.None;
    }

    public get isUnread(): boolean {
        if (this.color > NotificationColor.Bold) {
            return true;
        } else {
            const hideBold = SettingsStore.getValue("feature_hidebold");
            return this.color === NotificationColor.Bold && !hideBold;
        }
    }

    public get hasUnreadCount(): boolean {
        return this.color >= NotificationColor.Grey && (!!this.count || !!this.symbol);
    }

    public get hasMentions(): boolean {
        return this.color >= NotificationColor.Red;
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
    private readonly color: NotificationColor;
    private readonly muted: boolean;

    public constructor(state: INotificationStateSnapshotParams) {
        this.symbol = state.symbol;
        this.count = state.count;
        this.color = state.color;
        this.muted = state.muted;
    }

    public isDifferentFrom(other: INotificationStateSnapshotParams): boolean {
        const before = { count: this.count, symbol: this.symbol, color: this.color, muted: this.muted };
        const after = { count: other.count, symbol: other.symbol, color: other.color, muted: other.muted };
        return JSON.stringify(before) !== JSON.stringify(after);
    }
}
