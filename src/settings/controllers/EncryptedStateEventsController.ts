/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import PlatformPeg from "../../PlatformPeg";
import { SettingLevel } from "../SettingLevel";
import SettingsStore from "../SettingsStore";
import SettingController from "./SettingController";

export default class EncryptedStateEventsController extends SettingController {
    public async onChange(): Promise<void> {
        SettingsStore.setValue("feature_share_history_on_invite", null, SettingLevel.CONFIG, true);
        PlatformPeg.get()?.reload();
    }
}
