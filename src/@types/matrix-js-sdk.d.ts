/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import type { IWidget } from "matrix-widget-api";
import type { BLURHASH_FIELD } from "../utils/image-media";
import type { JitsiCallMemberEventType, JitsiCallMemberContent } from "../call-types";
import type { ILayoutStateEvent, WIDGET_LAYOUT_EVENT_TYPE } from "../stores/widgets/types";
import type { VoiceBroadcastInfoEventContent, VoiceBroadcastInfoEventType } from "../voice-broadcast/types";

// Matrix JS SDK extensions
declare module "matrix-js-sdk/src/types" {
    export interface FileInfo {
        /**
         * @see https://github.com/matrix-org/matrix-spec-proposals/pull/2448
         */
        [BLURHASH_FIELD]?: string;
    }

    export interface StateEvents {
        // Jitsi-backed video room state events
        [JitsiCallMemberEventType]: JitsiCallMemberContent;

        // Unstable widgets state events
        "im.vector.modular.widgets": IWidget | {};
        [WIDGET_LAYOUT_EVENT_TYPE]: ILayoutStateEvent;

        // Unstable voice broadcast state events
        [VoiceBroadcastInfoEventType]: VoiceBroadcastInfoEventContent;

        // Element custom state events
        "im.vector.web.settings": Record<string, any>;
        "org.matrix.room.preview_urls": { disable: boolean };

        // XXX unspecced usages of `m.room.*` events
        "m.room.plumbing": {
            status: string;
        };
        "m.room.bot.options": unknown;
    }
}
