/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { NotificationLevel } from "./NotificationLevel";
import { NotificationState } from "./NotificationState";

export class StaticNotificationState extends NotificationState {
    public static readonly RED_EXCLAMATION = StaticNotificationState.forSymbol("!", NotificationLevel.Highlight);

    public constructor(symbol: string | null, count: number, level: NotificationLevel) {
        super();
        this._symbol = symbol;
        this._count = count;
        this._level = level;
    }

    public static forCount(count: number, level: NotificationLevel): StaticNotificationState {
        return new StaticNotificationState(null, count, level);
    }

    public static forSymbol(symbol: string, level: NotificationLevel): StaticNotificationState {
        return new StaticNotificationState(symbol, 0, level);
    }
}
