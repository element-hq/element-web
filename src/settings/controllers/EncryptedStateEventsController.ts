/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import PlatformPeg from "../../PlatformPeg";
import { type SettingLevel } from "../SettingLevel";
import SettingController from "./SettingController";

export default class EncryptedStateEventsController extends SettingController {
    public onChange(level: SettingLevel, roomId: string | null, newValue: boolean): void {
        PlatformPeg.get()?.reload();
    }
}
