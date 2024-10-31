/*
Copyright 2024 New Vector Ltd.
Copyright 2024 Ed Geraghty <ed@geraghty.family>
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import SettingController from "./SettingController";
import PlatformPeg from "../../PlatformPeg";
import SettingsStore from "../SettingsStore";
import { _t } from "../../languageHandler";

export default class SlidingSyncController extends SettingController {
    public static serverSupportsSlidingSync: boolean;

    public async onChange(): Promise<void> {
        PlatformPeg.get()?.reload();
    }

    public get settingDisabled(): boolean | string {
        // Cannot be disabled once enabled, user has been warned and must log out and back in.
        if (SettingsStore.getValue("feature_sliding_sync")) {
            return _t("labs|sliding_sync_disabled_notice");
        }
        if (!SlidingSyncController.serverSupportsSlidingSync) {
            return _t("labs|sliding_sync_server_no_support");
        }

        return false;
    }
}
