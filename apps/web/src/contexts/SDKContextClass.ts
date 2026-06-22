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
import { OidcClientStore } from "../stores/oidc/OidcClientStore";
import WidgetStore from "../stores/WidgetStore";
import ResizeNotifier from "../utils/ResizeNotifier";
import { MultiRoomViewStore } from "../stores/MultiRoomViewStore";
import RoomListStore from "../stores/room-list/RoomListStore.ts";
import SettingsStore from "../settings/SettingsStore.ts";
import RoomListStoreV3 from "../stores/room-list-v3/RoomListStoreV3.ts";
import Notifier from "../Notifier.ts";
import SettingController from "../settings/controllers/SettingController.ts";
import CallStore from "../stores/CallStore.ts";
import { ModuleRunner } from "../modules/ModuleRunner.ts";
import MediaDeviceHandler from "../MediaDeviceHandler.ts";
import { VoiceRecordingStore } from "../stores/VoiceRecordingStore.ts";
import { ModalWidgetStore } from "../stores/ModalWidgetStore.ts";

/**
 * A class which lazily initialises stores as and when they are requested, ensuring they remain
 * as singletons scoped to this object.
 */
export class SdkContextClass {
    /**
     * The global SdkContextClass instance. This is a temporary measure whilst so many stores remain global
     * as well. Over time, these stores should accept a `SdkContextClass` instance in their constructor.
     * When all stores do this, this static variable can be deleted.
     */
    public static readonly instance = new SdkContextClass();

    // Optional as we don't have a client on initial load if unregistered. This should be set
    // when the MatrixClient is first acquired in the dispatcher event Action.OnLoggedIn.
    // It is only safe to set this once, as updating this value will NOT notify components using
    // this Context.
    public client?: MatrixClient;

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
    protected _OidcClientStore?: OidcClientStore;
    protected _ResizeNotifier?: ResizeNotifier;
    protected _MultiRoomViewStore?: MultiRoomViewStore;
    protected _RoomListStore?: RoomListStore;
    protected _RoomListStoreV3?: RoomListStoreV3;
    protected _Notifier?: Notifier;
    protected _SettingsStore?: typeof SettingsStore;
    protected _CallStore?: CallStore;
    protected _ModuleRunner?: ModuleRunner;
    protected _MediaDeviceHandler?: MediaDeviceHandler;
    protected _VoiceRecordingStore?: VoiceRecordingStore;
    protected _ModalWidgetStore?: ModalWidgetStore;

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
            window.mxLegacyCallHandler = this._LegacyCallHandler;
        }
        return this._LegacyCallHandler;
    }
    public get rightPanelStore(): RightPanelStore {
        if (!this._RightPanelStore) {
            this._RightPanelStore = new RightPanelStore(this);
            window.mxRightPanelStore = this._RightPanelStore;
        }
        return this._RightPanelStore;
    }
    public get roomNotificationStateStore(): RoomNotificationStateStore {
        if (!this._RoomNotificationStateStore) {
            this._RoomNotificationStateStore = new RoomNotificationStateStore(defaultDispatcher, this);
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
            this._WidgetLayoutStore = new WidgetLayoutStore(defaultDispatcher, this);
            window.mxWidgetLayoutStore = this._WidgetLayoutStore;
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
            this._WidgetStore = new WidgetStore(defaultDispatcher);
            window.mxWidgetStore = this._WidgetStore;
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
            window.mxSpaceStore = this._SpaceStore;
        }
        return this._SpaceStore;
    }
    public get typingStore(): TypingStore {
        if (!this._TypingStore) {
            this._TypingStore = new TypingStore(this);
            window.mxTypingStore = this._TypingStore;
        }
        return this._TypingStore;
    }
    public get roomListStore(): RoomListStore {
        if (!this._RoomListStore) {
            this._RoomListStore = new RoomListStore(defaultDispatcher, this);
            this._RoomListStore.start();
            window.mxRoomListStore = this._RoomListStore;
        }
        return this._RoomListStore;
    }
    public get roomListStoreV3(): RoomListStoreV3 {
        if (!this._RoomListStoreV3) {
            this._RoomListStoreV3 = new RoomListStoreV3(defaultDispatcher, this);
            this._RoomListStoreV3.start();
            window.mxRoomListStoreV3 = this._RoomListStoreV3;
        }
        return this._RoomListStoreV3;
    }
    public get notifier(): Notifier {
        if (!this._Notifier) {
            this._Notifier = new Notifier(defaultDispatcher, this);
            window.mxNotifier = this._Notifier;
        }
        return this._Notifier;
    }
    public get callStore(): CallStore {
        if (!this._CallStore) {
            this._CallStore = new CallStore(defaultDispatcher, this);
        }
        return this._CallStore;
    }
    public get moduleRunner(): ModuleRunner {
        if (!this._ModuleRunner) {
            this._ModuleRunner = new ModuleRunner(this);
        }
        return this._ModuleRunner;
    }
    public get mediaDeviceHandler(): MediaDeviceHandler {
        if (!this._MediaDeviceHandler) {
            this._MediaDeviceHandler = new MediaDeviceHandler(this);
        }
        return this._MediaDeviceHandler;
    }
    public get voiceRecordingStore(): VoiceRecordingStore {
        if (!this._VoiceRecordingStore) {
            this._VoiceRecordingStore = new VoiceRecordingStore(defaultDispatcher, this);
            this._VoiceRecordingStore.start();
            window.mxVoiceRecordingStore = this._VoiceRecordingStore;
        }
        return this._VoiceRecordingStore;
    }
    public get modalWidgetStore(): ModalWidgetStore {
        if (!this._ModalWidgetStore) {
            this._ModalWidgetStore = new ModalWidgetStore(defaultDispatcher, this);
            this._ModalWidgetStore.start();
            window.mxModalWidgetStore = this._ModalWidgetStore;
        }
        return this._ModalWidgetStore;
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

    public get oidcClientStore(): OidcClientStore {
        if (!this.client) {
            throw new Error("Unable to create OidcClientStore without a client");
        }

        if (!this._OidcClientStore) {
            this._OidcClientStore = new OidcClientStore(this.client);
        }

        return this._OidcClientStore;
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

    public get settingsStore(): typeof SettingsStore {
        if (!this._SettingsStore) {
            this._SettingsStore = SettingsStore;
            SettingController.SdkContext = this;
            // For debugging purposes
            window.mxSettingsStore = SettingsStore;
        }
        return this._SettingsStore;
    }

    public onLoggedOut(): void {
        this._UserProfilesStore = undefined;
        this._OidcClientStore = undefined;
    }
}

window.mxSdkContext = SdkContextClass.instance;
