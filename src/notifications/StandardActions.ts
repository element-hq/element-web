/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { PushRuleAction } from "matrix-js-sdk/src/@types/PushRules";

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
