/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import PlatformPeg from "../../PlatformPeg";
import { type SettingLevel } from "../SettingLevel";

export default class ReloadOnChangeController extends SettingController {
    public onChange(level: SettingLevel, roomId: string, newValue: any): void {
        PlatformPeg.get()?.reload();
    }
}
