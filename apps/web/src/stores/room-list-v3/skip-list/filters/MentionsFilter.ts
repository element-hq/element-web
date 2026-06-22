/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { type Filter, FilterEnum } from ".";
import { type SdkContextClass } from "../../../../contexts/SDKContextClass.ts";

export class MentionsFilter implements Filter {
    public constructor(private readonly sdkContext: SdkContextClass) {}

    public matches(room: Room): boolean {
        return this.sdkContext.roomNotificationStateStore.getRoomState(room).isMention;
    }

    public get key(): FilterEnum.MentionsFilter {
        return FilterEnum.MentionsFilter;
    }
}
