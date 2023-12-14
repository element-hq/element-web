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

// eslint-disable-next-line no-restricted-imports
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
import type { SettingLevel } from "../src/settings/SettingLevel";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface ApplicationWindow {
            // XXX: Importing SettingsStore causes a bunch of type lint errors
            mxSettingsStore: {
                setValue(settingName: string, roomId: string | null, level: SettingLevel, value: any): Promise<void>;
            };
            mxMatrixClientPeg: {
                matrixClient?: MatrixClient;
            };
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
}

export { MatrixClient };
