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

import type * as Matrix from "matrix-js-sdk/src/matrix";
import { type SettingLevel } from "../src/settings/SettingLevel";

declare global {
    interface Window {
        mxMatrixClientPeg: {
            get(): Matrix.MatrixClient;
        };
        mxSettingsStore: {
            setValue(settingName: string, roomId: string | null, level: SettingLevel, value: any): Promise<void>;
        };
        mxActiveWidgetStore: {
            setWidgetPersistence(widgetId: string, roomId: string | null, val: boolean): void;
        };
        matrixcs: typeof Matrix;
    }
}

// Workaround for lack of strict mode not resolving complex types correctly
declare module "matrix-js-sdk/src/http-api/index.ts" {
    interface UploadResponse {
        json(): Promise<object>;
    }
}
