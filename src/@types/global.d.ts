/*
Copyright 2020-2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import "matrix-js-sdk/src/@types/global"; // load matrix-js-sdk's type extensions first
import "@types/modernizr";

import ContentMessages from "../ContentMessages";
import { IMatrixClientPeg } from "../MatrixClientPeg";
import ToastStore from "../stores/ToastStore";
import DeviceListener from "../DeviceListener";
import { RoomListStore } from "../stores/room-list/Interface";
import { PlatformPeg } from "../PlatformPeg";
import RoomListLayoutStore from "../stores/room-list/RoomListLayoutStore";
import { IntegrationManagers } from "../integrations/IntegrationManagers";
import { ModalManager } from "../Modal";
import SettingsStore from "../settings/SettingsStore";
import { Notifier } from "../Notifier";
import type { Renderer } from "react-dom";
import RightPanelStore from "../stores/right-panel/RightPanelStore";
import WidgetStore from "../stores/WidgetStore";
import LegacyCallHandler from "../LegacyCallHandler";
import UserActivity from "../UserActivity";
import { ModalWidgetStore } from "../stores/ModalWidgetStore";
import { WidgetLayoutStore } from "../stores/widgets/WidgetLayoutStore";
import VoipUserMapper from "../VoipUserMapper";
import { SpaceStoreClass } from "../stores/spaces/SpaceStore";
import TypingStore from "../stores/TypingStore";
import { EventIndexPeg } from "../indexing/EventIndexPeg";
import { VoiceRecordingStore } from "../stores/VoiceRecordingStore";
import PerformanceMonitor from "../performance";
import UIStore from "../stores/UIStore";
import { SetupEncryptionStore } from "../stores/SetupEncryptionStore";
import { RoomScrollStateStore } from "../stores/RoomScrollStateStore";
import { ConsoleLogger, IndexedDBLogStore } from "../rageshake/rageshake";
import ActiveWidgetStore from "../stores/ActiveWidgetStore";
import AutoRageshakeStore from "../stores/AutoRageshakeStore";
import { IConfigOptions } from "../IConfigOptions";
import { MatrixDispatcher } from "../dispatcher/dispatcher";
import { DeepReadonly } from "./common";

/* eslint-disable @typescript-eslint/naming-convention */

declare global {
    interface Window {
        matrixChat: ReturnType<Renderer>;
        mxMatrixClientPeg: IMatrixClientPeg;
        Olm: {
            init: () => Promise<void>;
        };
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
        mxRoomScrollStateStore?: RoomScrollStateStore;
        mxActiveWidgetStore?: ActiveWidgetStore;
        mxOnRecaptchaLoaded?: () => void;
        electron?: Electron;
        mxSendSentryReport: (userText: string, issueUrl: string, error: Error) => Promise<void>;
        mxLoginWithAccessToken: (hsUrl: string, accessToken: string) => Promise<void>;
        mxAutoRageshakeStore?: AutoRageshakeStore;
        mxDispatcher: MatrixDispatcher;
    }

    interface Electron {
        // will be extended by element-web downstream
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

    // https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
    interface OffscreenCanvas {
        convertToBlob(opts?: { type?: string; quality?: number }): Promise<Blob>;
    }

    interface HTMLAudioElement {
        type?: string;
        // sinkId & setSinkId are experimental and typescript doesn't know about them
        sinkId: string;
        setSinkId(outputId: string): void;
    }

    interface HTMLVideoElement {
        type?: string;
        // sinkId & setSinkId are experimental and typescript doesn't know about them
        sinkId: string;
        setSinkId(outputId: string): void;
    }

    // Add Chrome-specific `instant` ScrollBehaviour
    type _ScrollBehavior = ScrollBehavior | "instant";

    interface _ScrollOptions {
        behavior?: _ScrollBehavior;
    }

    interface _ScrollIntoViewOptions extends _ScrollOptions {
        block?: ScrollLogicalPosition;
        inline?: ScrollLogicalPosition;
    }

    interface Element {
        // Safari & IE11 only have this prefixed: we used prefixed versions
        // previously so let's continue to support them for now
        webkitRequestFullScreen(options?: FullscreenOptions): Promise<void>;
        msRequestFullscreen(options?: FullscreenOptions): Promise<void>;
        scrollIntoView(arg?: boolean | _ScrollIntoViewOptions): void;
    }

    interface Error {
        // Standard
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
        cause?: unknown;

        // Non-standard
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/fileName
        fileName?: string;
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/lineNumber
        lineNumber?: number;
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/columnNumber
        columnNumber?: number;
    }

    // We can remove these pieces if we ever update to `target: "es2022"` in our
    // TypeScript config which supports the new `cause` property, see
    // https://github.com/vector-im/element-web/issues/24913
    interface ErrorOptions {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
        cause?: unknown;
    }

    interface ErrorConstructor {
        new (message?: string, options?: ErrorOptions): Error;
        (message?: string, options?: ErrorOptions): Error;
    }

    // eslint-disable-next-line no-var
    var Error: ErrorConstructor;

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

/* eslint-enable @typescript-eslint/naming-convention */
