/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SdkContextClass } from "../../src/contexts/SDKContext";
import { PosthogAnalytics } from "../../src/PosthogAnalytics";
import { SlidingSyncManager } from "../../src/SlidingSyncManager";
import { RoomNotificationStateStore } from "../../src/stores/notifications/RoomNotificationStateStore";
import RightPanelStore from "../../src/stores/right-panel/RightPanelStore";
import { RoomViewStore } from "../../src/stores/RoomViewStore";
import { SpaceStoreClass } from "../../src/stores/spaces/SpaceStore";
import { WidgetLayoutStore } from "../../src/stores/widgets/WidgetLayoutStore";
import { WidgetPermissionStore } from "../../src/stores/widgets/WidgetPermissionStore";
import WidgetStore from "../../src/stores/WidgetStore";

/**
 * A class which provides the same API as SdkContextClass but adds additional unsafe setters which can
 * replace individual stores. This is useful for tests which need to mock out stores.
 */
export class TestSdkContext extends SdkContextClass {
    declare public _RightPanelStore?: RightPanelStore;
    declare public _RoomNotificationStateStore?: RoomNotificationStateStore;
    declare public _RoomViewStore?: RoomViewStore;
    declare public _WidgetPermissionStore?: WidgetPermissionStore;
    declare public _WidgetLayoutStore?: WidgetLayoutStore;
    declare public _WidgetStore?: WidgetStore;
    declare public _PosthogAnalytics?: PosthogAnalytics;
    declare public _SlidingSyncManager?: SlidingSyncManager;
    declare public _SpaceStore?: SpaceStoreClass;

    constructor() {
        super();
    }
}
