/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { SDKContextClass } from "../../src/contexts/SDKContextClass";
import { type PosthogAnalytics } from "../../src/PosthogAnalytics";
import { type SlidingSyncManager } from "../../src/SlidingSyncManager";
import { type RoomNotificationStateStore } from "../../src/stores/notifications/RoomNotificationStateStore";
import type RightPanelStore from "../../src/stores/right-panel/RightPanelStore";
import { type RoomViewStore } from "../../src/stores/RoomViewStore";
import type SpaceStore from "../../src/stores/spaces/SpaceStore";
import { type WidgetLayoutStore } from "../../src/stores/widgets/WidgetLayoutStore";
import { type WidgetPermissionStore } from "../../src/stores/widgets/WidgetPermissionStore";
import type WidgetStore from "../../src/stores/WidgetStore";
import type LegacyCallHandler from "../../src/LegacyCallHandler.tsx";

/**
 * A class which provides the same API as SDKContextClass but adds additional unsafe setters which can
 * replace individual stores. This is useful for tests which need to mock out stores.
 */
export class TestSDKContext extends SDKContextClass {
    declare public _client?: MatrixClient;
    declare public _RightPanelStore?: RightPanelStore;
    declare public _RoomNotificationStateStore?: RoomNotificationStateStore;
    declare public _RoomViewStore?: RoomViewStore;
    declare public _WidgetPermissionStore?: WidgetPermissionStore;
    declare public _WidgetLayoutStore?: WidgetLayoutStore;
    declare public _WidgetStore?: WidgetStore;
    declare public _PosthogAnalytics?: PosthogAnalytics;
    declare public _SlidingSyncManager?: SlidingSyncManager;
    declare public _SpaceStore?: SpaceStore;
    declare public _LegacyCallHandler?: LegacyCallHandler;

    constructor() {
        super();
    }
}
