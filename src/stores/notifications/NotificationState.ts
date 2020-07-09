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

import { EventEmitter } from "events";
import { NotificationColor } from "./NotificationColor";
import { IDestroyable } from "../../utils/IDestroyable";

export const NOTIFICATION_STATE_UPDATE = "update";

export abstract class NotificationState extends EventEmitter implements IDestroyable {
    protected _symbol: string;
    protected _count: number;
    protected _color: NotificationColor;

    public get symbol(): string {
        return this._symbol;
    }

    public get count(): number {
        return this._count;
    }

    public get color(): NotificationColor {
        return this._color;
    }

    public get isIdle(): boolean {
        return this.color <= NotificationColor.None;
    }

    public get isUnread(): boolean {
        return this.color >= NotificationColor.Bold;
    }

    public get hasUnreadCount(): boolean {
        return this.color >= NotificationColor.Grey && (!!this.count || !!this.symbol);
    }

    public get hasMentions(): boolean {
        return this.color >= NotificationColor.Red;
    }

    protected emitIfUpdated(snapshot: NotificationStateSnapshot) {
        if (snapshot.isDifferentFrom(this)) {
            this.emit(NOTIFICATION_STATE_UPDATE);
        }
    }

    protected snapshot(): NotificationStateSnapshot {
        return new NotificationStateSnapshot(this);
    }

    public destroy(): void {
        this.removeAllListeners(NOTIFICATION_STATE_UPDATE);
    }
}

export class NotificationStateSnapshot {
    private readonly symbol: string;
    private readonly count: number;
    private readonly color: NotificationColor;

    constructor(state: NotificationState) {
        this.symbol = state.symbol;
        this.count = state.count;
        this.color = state.color;
    }

    public isDifferentFrom(other: NotificationState): boolean {
        const before = {count: this.count, symbol: this.symbol, color: this.color};
        const after = {count: other.count, symbol: other.symbol, color: other.color};
        return JSON.stringify(before) !== JSON.stringify(after);
    }
}
