/*
Copyright 2020-2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// eslint-disable-next-line no-restricted-imports
import "matrix-js-sdk/src/@types/global"; // load matrix-js-sdk's type extensions first
import "@types/modernizr";

import type { ModuleLoader } from "@element-hq/element-web-module-api";
import type { logger } from "matrix-js-sdk/src/logger";
import type ContentMessages from "../ContentMessages";
import { type IMatrixClientPeg } from "../MatrixClientPeg";
import type ToastStore from "../stores/ToastStore";
import type DeviceListener from "../DeviceListener";
import { type RoomListStore } from "../stores/room-list/Interface";
import { type PlatformPeg } from "../PlatformPeg";
import type RoomListLayoutStore from "../stores/room-list/RoomListLayoutStore";
import { type IntegrationManagers } from "../integrations/IntegrationManagers";
import { type ModalManager } from "../Modal";
import type SettingsStore from "../settings/SettingsStore";
import { type Notifier } from "../Notifier";
import type RightPanelStore from "../stores/right-panel/RightPanelStore";
import type WidgetStore from "../stores/WidgetStore";
import type LegacyCallHandler from "../LegacyCallHandler";
import type UserActivity from "../UserActivity";
import { type ModalWidgetStore } from "../stores/ModalWidgetStore";
import { type WidgetLayoutStore } from "../stores/widgets/WidgetLayoutStore";
import type VoipUserMapper from "../VoipUserMapper";
import { type SpaceStoreClass } from "../stores/spaces/SpaceStore";
import type TypingStore from "../stores/TypingStore";
import { type EventIndexPeg } from "../indexing/EventIndexPeg";
import { type VoiceRecordingStore } from "../stores/VoiceRecordingStore";
import type PerformanceMonitor from "../performance";
import type UIStore from "../stores/UIStore";
import { type SetupEncryptionStore } from "../stores/SetupEncryptionStore";
import { type RoomScrollStateStore } from "../stores/RoomScrollStateStore";
import { type ConsoleLogger, type IndexedDBLogStore } from "../rageshake/rageshake";
import type ActiveWidgetStore from "../stores/ActiveWidgetStore";
import type AutoRageshakeStore from "../stores/AutoRageshakeStore";
import { type IConfigOptions } from "../IConfigOptions";
import { type MatrixDispatcher } from "../dispatcher/dispatcher";
import { type DeepReadonly } from "./common";
import type MatrixChat from "../components/structures/MatrixChat";
import { type InitialCryptoSetupStore } from "../stores/InitialCryptoSetupStore";
import { type ModuleApiType } from "../modules/Api.ts";

/* eslint-disable @typescript-eslint/naming-convention */

type ElectronChannel =
    | "app_onAction"
    | "before-quit"
    | "check_updates"
    | "install_update"
    | "ipcCall"
    | "ipcReply"
    | "loudNotification"
    | "preferences"
    | "seshat"
    | "seshatReply"
    | "setBadgeCount"
    | "update-downloaded"
    | "userDownloadCompleted"
    | "userDownloadAction"
    | "openDesktopCapturerSourcePicker"
    | "userAccessToken"
    | "homeserverUrl"
    | "serverSupportedVersions";

declare global {
    interface Window {
        mxSendRageshake: (text: string, withLogs?: boolean) => void;
        matrixLogger: typeof logger;
        matrixChat?: MatrixChat;
        mxSendSentryReport: (userText: string, issueUrl: string, error: Error) => Promise<void>;
        mxLoginWithAccessToken: (hsUrl: string, accessToken: string) => Promise<void>;
        mxAutoRageshakeStore?: AutoRageshakeStore;
        mxDispatcher: MatrixDispatcher;
        mxMatrixClientPeg: IMatrixClientPeg;
        mxReactSdkConfig: DeepReadonly<IConfigOptions>;

        // Needed for Safari, unknown to TypeScript
        webkitAudioContext: typeof AudioContext;

        // https://docs.microsoft.com/en-us/previous-versions/hh772328(v=vs.85)
        // we only ever check for its existence, so we can ignore its actual type
        MSStream?: unknown;

        // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1029#issuecomment-869224737
        // https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
        OffscreenCanvas?: {
            new (width: number, height: number): OffscreenCanvas;
        };

        mxContentMessages: ContentMessages;
        mxToastStore: ToastStore;
        mxDeviceListener: DeviceListener;
        mxRoomListStore: RoomListStore;
        mxRoomListLayoutStore: RoomListLayoutStore;
        mxPlatformPeg: PlatformPeg;
        mxIntegrationManagers: typeof IntegrationManagers;
        singletonModalManager: ModalManager;
        mxSettingsStore: SettingsStore;
        mxNotifier: typeof Notifier;
        mxRightPanelStore: RightPanelStore;
        mxWidgetStore: WidgetStore;
        mxWidgetLayoutStore: WidgetLayoutStore;
        mxLegacyCallHandler: LegacyCallHandler;
        mxUserActivity: UserActivity;
        mxModalWidgetStore: ModalWidgetStore;
        mxVoipUserMapper: VoipUserMapper;
        mxSpaceStore: SpaceStoreClass;
        mxVoiceRecordingStore: VoiceRecordingStore;
        mxTypingStore: TypingStore;
        mxEventIndexPeg: EventIndexPeg;
        mxPerformanceMonitor: PerformanceMonitor;
        mxPerformanceEntryNames: any;
        mxUIStore: UIStore;
        mxSetupEncryptionStore?: SetupEncryptionStore;
        mxInitialCryptoStore?: InitialCryptoSetupStore;
        mxRoomScrollStateStore?: RoomScrollStateStore;
        mxActiveWidgetStore?: ActiveWidgetStore;
        mxOnRecaptchaLoaded?: () => void;
        mxModuleLoader: ModuleLoader;
        mxModuleApi: ModuleApiType;

        // electron-only
        electron?: Electron;
        // opera-only
        opera?: any;

        // https://developer.mozilla.org/en-US/docs/Web/API/InstallTrigger
        InstallTrigger: any;
    }

    interface Electron {
        on(channel: ElectronChannel, listener: (event: Event, ...args: any[]) => void): void;
        send(channel: ElectronChannel, ...args: any[]): void;
    }

    interface DesktopCapturerSource {
        id: string;
        name: string;
        thumbnailURL: string;
    }

    interface GetSourcesOptions {
        types: Array<string>;
        thumbnailSize?: {
            height: number;
            width: number;
        };
        fetchWindowIcons?: boolean;
    }

    interface Document {
        // Safari & IE11 only have this prefixed: we used prefixed versions
        // previously so let's continue to support them for now
        webkitExitFullscreen(): Promise<void>;
        msExitFullscreen(): Promise<void>;
        readonly webkitFullscreenElement: Element | null;
        readonly msFullscreenElement: Element | null;
    }

    interface Navigator {
        userLanguage?: string;
    }

    interface StorageEstimate {
        usageDetails?: { [key: string]: number };
    }

    interface Element {
        // Safari & IE11 only have this prefixed: we used prefixed versions
        // previously so let's continue to support them for now
        webkitRequestFullScreen(options?: FullscreenOptions): Promise<void>;
        msRequestFullscreen(options?: FullscreenOptions): Promise<void>;
        // scrollIntoView(arg?: boolean | _ScrollIntoViewOptions): void;
    }

    // https://github.com/microsoft/TypeScript/issues/28308#issuecomment-650802278
    interface AudioWorkletProcessor {
        readonly port: MessagePort;
        process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
    }

    // https://github.com/microsoft/TypeScript/issues/28308#issuecomment-650802278
    const AudioWorkletProcessor: {
        prototype: AudioWorkletProcessor;
        new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
    };

    // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1029#issuecomment-881509595
    interface AudioParamDescriptor {
        readonly port: MessagePort;
    }

    /**
     * In future, browsers will support focusVisible option.
     * See https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#focusvisible
     */
    interface FocusOptions {
        focusVisible: boolean;
    }

    // https://github.com/microsoft/TypeScript/issues/28308#issuecomment-650802278
    function registerProcessor(
        name: string,
        processorCtor: (new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor) & {
            parameterDescriptors?: AudioParamDescriptor[];
        },
    ): void;

    // eslint-disable-next-line no-var
    var grecaptcha:
        | undefined
        | {
              reset: (id: string) => void;
              render: (
                  divId: string,
                  options: {
                      sitekey: string;
                      callback: (response: string) => void;
                  },
              ) => string;
              isReady: () => boolean;
          };

    // eslint-disable-next-line no-var, camelcase
    var mx_rage_logger: ConsoleLogger;
    // eslint-disable-next-line no-var, camelcase
    var mx_rage_initPromise: Promise<void>;
    // eslint-disable-next-line no-var, camelcase
    var mx_rage_initStoragePromise: Promise<void>;
    // eslint-disable-next-line no-var, camelcase
    var mx_rage_store: IndexedDBLogStore;
}

// add method which is missing from the node typing
declare module "url" {
    interface Url {
        format(): string;
    }
}

/* eslint-enable @typescript-eslint/naming-convention */
