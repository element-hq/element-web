/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType } from "matrix-js-sdk/src/matrix";

import { type SettingLevel } from "../SettingLevel.ts";
import { _td } from "../../languageHandler";
import ServerSupportUnstableFeatureController from "./ServerSupportUnstableFeatureController.ts";
import { type SettingKey } from "../Settings.tsx";
import type { WatchManager } from "../WatchManager.ts";

/**
 * Handles invite filtering rules provided by MSC4380.
 * This handler does not make use of the roomId parameter.
 */
export default class BlockInvitesConfigController extends ServerSupportUnstableFeatureController {
    public constructor(settingName: SettingKey, watchers: WatchManager) {
        super(settingName, watchers, [["org.matrix.msc4380.stable"]], "v1.18", _td("settings|not_supported"));
    }

    public getValueOverride(_level: SettingLevel): boolean {
        const accountData = this.client?.getAccountData(EventType.InvitePermissionConfig)?.getContent();
        return accountData?.default_action == "block";
    }

    public async beforeChange(_level: SettingLevel, _roomId: string | null, newValue: boolean): Promise<boolean> {
        if (!this.client) {
            return false;
        }

        await this.client.setAccountData(EventType.InvitePermissionConfig, newValue ? { default_action: "block" } : {});
        return true;
    }
}
