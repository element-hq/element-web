/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { SdkContextClass } from "../src/contexts/SDKContext";
import { PosthogAnalytics } from "../src/PosthogAnalytics";
import { SlidingSyncManager } from "../src/SlidingSyncManager";
import { RoomNotificationStateStore } from "../src/stores/notifications/RoomNotificationStateStore";
import RightPanelStore from "../src/stores/right-panel/RightPanelStore";
import { RoomViewStore } from "../src/stores/RoomViewStore";
import { SpaceStoreClass } from "../src/stores/spaces/SpaceStore";
import { WidgetLayoutStore } from "../src/stores/widgets/WidgetLayoutStore";
import { WidgetPermissionStore } from "../src/stores/widgets/WidgetPermissionStore";
import WidgetStore from "../src/stores/WidgetStore";
import {
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPreRecordingStore,
    VoiceBroadcastRecordingsStore,
} from "../src/voice-broadcast";

/**
 * A class which provides the same API as SdkContextClass but adds additional unsafe setters which can
 * replace individual stores. This is useful for tests which need to mock out stores.
 */
export class TestSdkContext extends SdkContextClass {
    public declare _RightPanelStore?: RightPanelStore;
    public declare _RoomNotificationStateStore?: RoomNotificationStateStore;
    public declare _RoomViewStore?: RoomViewStore;
    public declare _WidgetPermissionStore?: WidgetPermissionStore;
    public declare _WidgetLayoutStore?: WidgetLayoutStore;
    public declare _WidgetStore?: WidgetStore;
    public declare _PosthogAnalytics?: PosthogAnalytics;
    public declare _SlidingSyncManager?: SlidingSyncManager;
    public declare _SpaceStore?: SpaceStoreClass;
    public declare _VoiceBroadcastRecordingsStore?: VoiceBroadcastRecordingsStore;
    public declare _VoiceBroadcastPreRecordingStore?: VoiceBroadcastPreRecordingStore;
    public declare _VoiceBroadcastPlaybacksStore?: VoiceBroadcastPlaybacksStore;

    constructor() {
        super();
    }
}
