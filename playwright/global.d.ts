/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
