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

import { NotificationColor } from "./NotificationColor";
import { NotificationState } from "./NotificationState";

/**
 * Summarizes a number of states into a unique snapshot. To populate, call
 * the add() function with the notification states to be included.
 *
 * Useful for community notification counts, global notification counts, etc.
 */
export class SummarizedNotificationState extends NotificationState {
    private totalStatesWithUnread = 0;

    constructor() {
        super();
        this._symbol = null;
        this._count = 0;
        this._color = NotificationColor.None;
    }

    public get numUnreadStates(): number {
        return this.totalStatesWithUnread;
    }

    /**
     * Append a notification state to this snapshot, taking the loudest NotificationColor
     * of the two. By default this will not adopt the symbol of the other notification
     * state to prevent the count from being lost in typical usage.
     * @param other The other notification state to append.
     * @param includeSymbol If true, the notification state's symbol will be taken if one
     * is present.
     */
    public add(other: NotificationState, includeSymbol = false) {
        if (other.symbol && includeSymbol) {
            this._symbol = other.symbol;
        }
        if (other.count) {
            this._count += other.count;
        }
        if (other.color > this.color) {
            this._color = other.color;
        }
        if (other.hasUnreadCount) {
            this.totalStatesWithUnread++;
        }
    }
}
