/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type PushRuleAction } from "matrix-js-sdk/src/matrix";

import { NotificationUtils } from "./NotificationUtils";

const encodeActions = NotificationUtils.encodeActions;

export class StandardActions {
    public static ACTION_NOTIFY = encodeActions({ notify: true });
    public static ACTION_NOTIFY_DEFAULT_SOUND = encodeActions({ notify: true, sound: "default" });
    public static ACTION_NOTIFY_RING_SOUND = encodeActions({ notify: true, sound: "ring" });
    public static ACTION_HIGHLIGHT = encodeActions({ notify: true, highlight: true });
    public static ACTION_HIGHLIGHT_DEFAULT_SOUND = encodeActions({ notify: true, sound: "default", highlight: true });
    public static ACTION_DONT_NOTIFY = encodeActions({ notify: false });
    public static ACTION_DISABLED: PushRuleAction[] | undefined = undefined;
}
