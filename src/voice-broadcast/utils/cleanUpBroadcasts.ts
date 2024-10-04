/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { SdkContextClass } from "../../contexts/SDKContext";

export const cleanUpBroadcasts = async (stores: SdkContextClass): Promise<void> => {
    stores.voiceBroadcastPlaybacksStore.getCurrent()?.stop();
    stores.voiceBroadcastPlaybacksStore.clearCurrent();

    await stores.voiceBroadcastRecordingsStore.getCurrent()?.stop();
    stores.voiceBroadcastRecordingsStore.clearCurrent();

    stores.voiceBroadcastPreRecordingStore.getCurrent()?.cancel();
    stores.voiceBroadcastPreRecordingStore.clearCurrent();
};
