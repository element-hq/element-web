/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import defaultDispatcher from "../dispatcher/dispatcher";
import LegacyCallHandler from "../LegacyCallHandler";
import { PosthogAnalytics } from "../PosthogAnalytics";
import { SlidingSyncManager } from "../SlidingSyncManager";
import { MemberListStore } from "../stores/MemberListStore";
import { RoomNotificationStateStore } from "../stores/notifications/RoomNotificationStateStore";
import RightPanelStore from "../stores/right-panel/RightPanelStore";
import { RoomViewStore } from "../stores/RoomViewStore";
import SpaceStore from "../stores/spaces/SpaceStore";
import TypingStore from "../stores/TypingStore";
import { UserProfilesStore } from "../stores/UserProfilesStore";
import { WidgetLayoutStore } from "../stores/widgets/WidgetLayoutStore";
import { WidgetPermissionStore } from "../stores/widgets/WidgetPermissionStore";
import WidgetStore from "../stores/WidgetStore";
import ResizeNotifier from "../utils/ResizeNotifier";
import { MultiRoomViewStore } from "../stores/MultiRoomViewStore";
import { type ActionPayload, isAction } from "../dispatcher/payloads.ts";
import { Action } from "../dispatcher/actions.ts";
import { type OnLoggedInPayload } from "../dispatcher/payloads/OnLoggedInPayload.ts";
import Notifier from "../Notifier.ts";
import SettingController from "../settings/controllers/SettingController.ts";
import { CallStore } from "../stores/CallStore";
import { LatestRtcNotificationEventStore } from "../stores/LatestRtcNotificationEventStore";

/**
 * A class which (mostly) lazily initialises stores as and when they are requested, ensuring they remain
 * as singletons scoped to this object.
 *
 * Since this does the actual construction of all stores, it is *very* heavy on imports and lives right near
 * the top of the import tree. If anything other than code to set up the app (or tests) are importing this file,
 * it's doing it wrong and should be accessing whatever it needs via the react context.
 */
export class SDKContextClass {
    /**
     * The global SDKContextClass instance. This is a temporary measure whilst so many stores remain global
     * as well. Over time, these stores should accept a `SDKContextClass` instance in their constructor.
     * When all stores do this, this static variable can be deleted.
     */
    public static readonly instance = new SDKContextClass();

    // Optional as we don't have a client on initial load if unregistered.
    // It is only safe to set this once, as updating this value will NOT notify components using
    // this Context.
    protected _client?: MatrixClient;
    public get client(): MatrixClient | undefined {
        return this._client;
    }

    // All protected fields to make it easier to derive test stores
    protected _WidgetPermissionStore?: WidgetPermissionStore;
    protected _MemberListStore?: MemberListStore;
    protected _RightPanelStore?: RightPanelStore;
    protected _RoomNotificationStateStore?: RoomNotificationStateStore;
    protected _RoomViewStore?: RoomViewStore;
    protected _WidgetLayoutStore?: WidgetLayoutStore;
    protected _WidgetStore?: WidgetStore;
    protected _PosthogAnalytics?: PosthogAnalytics;
    protected _SlidingSyncManager?: SlidingSyncManager;
    protected _SpaceStore?: SpaceStore;
    protected _LegacyCallHandler?: LegacyCallHandler;
    protected _TypingStore?: TypingStore;
    protected _UserProfilesStore?: UserProfilesStore;
    protected _ResizeNotifier?: ResizeNotifier;
    protected _MultiRoomViewStore?: MultiRoomViewStore;
    protected _Notifier?: Notifier;
    protected _CallStore?: CallStore;
    protected _LatestRtcNotificationEventStore?: LatestRtcNotificationEventStore;

    public constructor() {
        SettingController.sdkContext = this;

        defaultDispatcher.register(this.onDispatch);
    }

    private onDispatch = (payload: ActionPayload): void => {
        if (isAction<OnLoggedInPayload>(payload, Action.OnLoggedIn)) {
            this._client = payload.client;
        }
    };

    /**
     * Automatically construct stores which need to be created eagerly so they can register with
     * the dispatcher.
     */
    public constructEagerStores(): void {
        this._RoomViewStore = this.roomViewStore;
    }

    public get legacyCallHandler(): LegacyCallHandler {
        if (!this._LegacyCallHandler) {
            this._LegacyCallHandler = new LegacyCallHandler(this);
        }
        return this._LegacyCallHandler;
    }
    public get rightPanelStore(): RightPanelStore {
        if (!this._RightPanelStore) {
            this._RightPanelStore = RightPanelStore.instance;
        }
        return this._RightPanelStore;
    }
    public get roomNotificationStateStore(): RoomNotificationStateStore {
        if (!this._RoomNotificationStateStore) {
            this._RoomNotificationStateStore = RoomNotificationStateStore.instance;
        }
        return this._RoomNotificationStateStore;
    }
    public get roomViewStore(): RoomViewStore {
        if (!this._RoomViewStore) {
            this._RoomViewStore = new RoomViewStore(defaultDispatcher, this);
        }
        return this._RoomViewStore;
    }
    public get widgetLayoutStore(): WidgetLayoutStore {
        if (!this._WidgetLayoutStore) {
            this._WidgetLayoutStore = WidgetLayoutStore.instance;
        }
        return this._WidgetLayoutStore;
    }
    public get widgetPermissionStore(): WidgetPermissionStore {
        if (!this._WidgetPermissionStore) {
            this._WidgetPermissionStore = new WidgetPermissionStore(this);
        }
        return this._WidgetPermissionStore;
    }
    public get widgetStore(): WidgetStore {
        if (!this._WidgetStore) {
            this._WidgetStore = WidgetStore.instance;
        }
        return this._WidgetStore;
    }
    public get posthogAnalytics(): PosthogAnalytics {
        if (!this._PosthogAnalytics) {
            this._PosthogAnalytics = PosthogAnalytics.instance;
        }
        return this._PosthogAnalytics;
    }
    public get memberListStore(): MemberListStore {
        if (!this._MemberListStore) {
            this._MemberListStore = new MemberListStore(this);
        }
        return this._MemberListStore;
    }
    public get slidingSyncManager(): SlidingSyncManager {
        if (!this._SlidingSyncManager) {
            this._SlidingSyncManager = SlidingSyncManager.instance;
        }
        return this._SlidingSyncManager;
    }
    public get spaceStore(): SpaceStore {
        if (!this._SpaceStore) {
            this._SpaceStore = new SpaceStore(defaultDispatcher, this);
            this._SpaceStore.start();
        }
        return this._SpaceStore;
    }
    public get typingStore(): TypingStore {
        if (!this._TypingStore) {
            this._TypingStore = new TypingStore(this);
        }
        return this._TypingStore;
    }

    public get userProfilesStore(): UserProfilesStore {
        if (!this.client) {
            throw new Error("Unable to create UserProfilesStore without a client");
        }

        if (!this._UserProfilesStore) {
            this._UserProfilesStore = new UserProfilesStore(this.client);
        }

        return this._UserProfilesStore;
    }

    // This is getting increasingly tenuous to have here but we still have class components so it's
    // awkward to consume multiple contexts in them. This should be replaced with ResizeObservers
    // anyway really.
    public get resizeNotifier(): ResizeNotifier {
        if (!this._ResizeNotifier) {
            this._ResizeNotifier = new ResizeNotifier();
        }
        return this._ResizeNotifier;
    }

    public get multiRoomViewStore(): MultiRoomViewStore {
        if (!this._MultiRoomViewStore) {
            this._MultiRoomViewStore = new MultiRoomViewStore(defaultDispatcher, this);
        }
        return this._MultiRoomViewStore;
    }

    public get notifier(): Notifier {
        if (!this._Notifier) {
            this._Notifier = new Notifier(defaultDispatcher, this);
        }
        return this._Notifier;
    }

    public get callStore(): CallStore {
        this._CallStore ??= CallStore.instance;
        return this._CallStore;
    }

    public get latestRtcNotificationEventStore(): LatestRtcNotificationEventStore {
        if (!this._LatestRtcNotificationEventStore) {
            this._LatestRtcNotificationEventStore = new LatestRtcNotificationEventStore(this.callStore);
            this._LatestRtcNotificationEventStore.start();
        }
        return this._LatestRtcNotificationEventStore;
    }

    public onLoggedOut(): void {
        this._UserProfilesStore = undefined;
        this._client = undefined;
    }
}
