/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import type { IWidget } from "matrix-widget-api";
import type { BLURHASH_FIELD } from "../utils/image-media";
import type { JitsiCallMemberEventType, JitsiCallMemberContent } from "../call-types";
import type { ILayoutStateEvent, WIDGET_LAYOUT_EVENT_TYPE } from "../stores/widgets/types";
import type { VoiceBroadcastInfoEventContent, VoiceBroadcastInfoEventType } from "../voice-broadcast/types";
import type { EncryptedFile } from "matrix-js-sdk/src/types";

// Extend Matrix JS SDK types via Typescript declaration merging to support unspecced event fields and types
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

    export interface TimelineEvents {
        "io.element.performance_metric": {
            "io.element.performance_metrics": {
                forEventId: string;
                responseTs: number;
                kind: "send_time";
            };
        };
    }

    export interface AudioContent {
        // MSC1767 + Ideals of MSC2516 as MSC3245
        // https://github.com/matrix-org/matrix-doc/pull/3245
        "org.matrix.msc1767.text"?: string;
        "org.matrix.msc1767.file"?: {
            url?: string;
            file?: EncryptedFile;
            name: string;
            mimetype: string;
            size: number;
        };
        "org.matrix.msc1767.audio"?: {
            duration: number;
            // https://github.com/matrix-org/matrix-doc/pull/3246
            waveform?: number[];
        };
        "org.matrix.msc3245.voice"?: {};

        "io.element.voice_broadcast_chunk"?: { sequence: number };
    }
}
