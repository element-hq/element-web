/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { expect } from "vitest";

import { SDKContextClass } from "../../contexts/SDKContextClass";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type PosthogAnalytics } from "../../PosthogAnalytics";
import { type SlidingSyncManager } from "../../SlidingSyncManager";
import { type RoomNotificationStateStore } from "../../stores/notifications/RoomNotificationStateStore";
import type RightPanelStore from "../../stores/right-panel/RightPanelStore";
import { type RoomViewStore } from "../../stores/RoomViewStore";
import type SpaceStore from "../../stores/spaces/SpaceStore";
import { type WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import { type WidgetPermissionStore } from "../../stores/widgets/WidgetPermissionStore";
import type WidgetStore from "../../stores/WidgetStore";
import type LegacyCallHandler from "../../LegacyCallHandler.tsx";
import { type DocumentPipStore } from "../../stores/DocumentPipStore";
import { tearDownAfterTest } from "./teardown";

/**
 * A class which provides the same API as SDKContextClass but adds additional unsafe setters which can
 * replace individual stores. This is useful for tests which need to mock out stores.
 *
 * A context created while a test runs, including in its `beforeEach`, is destroyed when that test finishes.
 */
export class TestSDKContext extends SDKContextClass {
    public constructor() {
        super();
        // A context created outside a test, such as in `beforeAll`, is shared by the tests that follow
        if (expect.getState().currentTestName !== undefined) tearDownAfterTest(this);
    }

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
    declare public _DocumentPipStore?: DocumentPipStore;

    /**
     * Stops this context listening to the dispatcher, and tears down the stores it holds, including any a
     * test assigned.
     */
    public destroy(): void {
        defaultDispatcher.unregister(this.dispatcherRef);
        this.dispatcherRef = undefined;
        this._RoomViewStore?.destroy();
        this._RoomViewStore = undefined;
        this._SpaceStore?.destroy();
        this._SpaceStore = undefined;
        this._LatestRtcNotificationEventStore?.destroy();
        this._LatestRtcNotificationEventStore = undefined;
        this._MultiRoomViewStore?.dispose();
    }
}
