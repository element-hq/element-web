/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import "../src/@types/global";
import "../src/@types/svg";
import "../src/@types/raw-loader";
import "matrix-js-sdk/src/@types/global";
import type {
    MatrixClient,
    ClientEvent,
    MatrixScheduler,
    MemoryCryptoStore,
    MemoryStore,
    Preset,
    RoomStateEvent,
    Visibility,
    RoomMemberEvent,
    ICreateClientOpts,
} from "matrix-js-sdk/src/matrix";
import type { MatrixDispatcher } from "../src/dispatcher/dispatcher";
import type PerformanceMonitor from "../src/performance";
import type SettingsStore from "../src/settings/SettingsStore";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface ApplicationWindow {
            mxSettingsStore: typeof SettingsStore;
            mxMatrixClientPeg: {
                matrixClient?: MatrixClient;
            };
            mxDispatcher: MatrixDispatcher;
            mxPerformanceMonitor: PerformanceMonitor;
            beforeReload?: boolean; // for detecting reloads
            // Partial type for the matrix-js-sdk module, exported by browser-matrix
            matrixcs: {
                MatrixClient: typeof MatrixClient;
                ClientEvent: typeof ClientEvent;
                RoomMemberEvent: typeof RoomMemberEvent;
                RoomStateEvent: typeof RoomStateEvent;
                MatrixScheduler: typeof MatrixScheduler;
                MemoryStore: typeof MemoryStore;
                MemoryCryptoStore: typeof MemoryCryptoStore;
                Visibility: typeof Visibility;
                Preset: typeof Preset;
                createClient(opts: ICreateClientOpts | string);
            };
        }
    }

    interface Window {
        // to appease the MatrixDispatcher import
        mxDispatcher: MatrixDispatcher;
        // to appease the PerformanceMonitor import
        mxPerformanceMonitor: PerformanceMonitor;
        mxPerformanceEntryNames: any;
    }
}

export { MatrixClient };
