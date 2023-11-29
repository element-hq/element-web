/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import {
    ICreateClientOpts,
    type MatrixClient,
    MatrixScheduler,
    MemoryCryptoStore,
    MemoryStore,
} from "matrix-js-sdk/src/matrix";

import { type SettingLevel } from "../src/settings/SettingLevel";

declare global {
    interface Window {
        mxMatrixClientPeg: {
            get(): MatrixClient;
        };
        mxSettingsStore: {
            setValue(settingName: string, roomId: string | null, level: SettingLevel, value: any): Promise<void>;
        };
        // Partial type for the matrix-js-sdk module, exported by browser-matrix
        matrixcs: {
            MatrixClient: typeof MatrixClient;
            MatrixScheduler: typeof MatrixScheduler;
            MemoryStore: typeof MemoryStore;
            MemoryCryptoStore: typeof MemoryCryptoStore;
            createClient(opts: ICreateClientOpts | string);
        };
    }
}
