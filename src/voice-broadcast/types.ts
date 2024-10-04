/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { RelationType } from "matrix-js-sdk/src/matrix";

export const VoiceBroadcastInfoEventType = "io.element.voice_broadcast_info";
export const VoiceBroadcastChunkEventType = "io.element.voice_broadcast_chunk";

export type VoiceBroadcastLiveness = "live" | "not-live" | "grey";

export enum VoiceBroadcastInfoState {
    Started = "started",
    Paused = "paused",
    Resumed = "resumed",
    Stopped = "stopped",
}

export interface VoiceBroadcastInfoEventContent {
    device_id: string;
    state: VoiceBroadcastInfoState;
    chunk_length?: number;
    last_chunk_sequence?: number;
    ["m.relates_to"]?: {
        rel_type: RelationType;
        event_id: string;
    };
}
