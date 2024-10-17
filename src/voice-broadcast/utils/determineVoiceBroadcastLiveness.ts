/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { VoiceBroadcastInfoState, VoiceBroadcastLiveness } from "..";

const stateLivenessMap: Map<VoiceBroadcastInfoState, VoiceBroadcastLiveness> = new Map([
    ["started", "live"],
    ["resumed", "live"],
    ["paused", "grey"],
    ["stopped", "not-live"],
] as Array<[VoiceBroadcastInfoState, VoiceBroadcastLiveness]>);

export const determineVoiceBroadcastLiveness = (infoState: VoiceBroadcastInfoState): VoiceBroadcastLiveness => {
    return stateLivenessMap.get(infoState) ?? "not-live";
};
