/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastInfoEventContent, VoiceBroadcastInfoState } from "..";

export const shouldDisplayAsVoiceBroadcastRecordingTile = (
    state: VoiceBroadcastInfoState,
    client: MatrixClient,
    event: MatrixEvent,
): boolean => {
    const userId = client.getUserId();
    return (
        !!userId &&
        userId === event.getSender() &&
        client.getDeviceId() === event.getContent<VoiceBroadcastInfoEventContent>()?.device_id &&
        state !== VoiceBroadcastInfoState.Stopped
    );
};
