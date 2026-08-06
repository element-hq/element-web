/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import dis from "../../dispatcher/dispatcher";
import { type UpdateFontSizeDeltaPayload } from "../../dispatcher/payloads/UpdateFontSizeDeltaPayload";
import { Action } from "../../dispatcher/actions";
import { type SettingLevel } from "../SettingLevel";

export default class FontSizeController extends SettingController {
    public constructor() {
        super();
    }

    public onChange(level: SettingLevel, roomId: string, newValue: any): void {
        if (newValue !== "") {
            // Dispatch font size change so that everything open responds to the change.
            dis.dispatch<UpdateFontSizeDeltaPayload>({
                action: Action.UpdateFontSizeDelta,
                delta: newValue,
            });
        }
    }
}
