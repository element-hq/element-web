/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type SettingLevel } from "../SettingLevel.ts";
import { MSC4380_INVITE_RULES_ACCOUNT_DATA_TYPE } from "../../@types/invite-rules.ts";
import { _td } from "../../languageHandler.tsx";
import ServerSupportUnstableFeatureController from "./ServerSupportUnstableFeatureController.ts";
import { defaultWatchManager, type SettingKey } from "../Settings.tsx";

/**
 * Handles invite filtering rules provided by MSC4380.
 * This handler does not make use of the roomId parameter.
 */
export default class BlockInvitesConfigController extends ServerSupportUnstableFeatureController {
    public constructor(settingName: SettingKey) {
        super(settingName, defaultWatchManager, [["org.matrix.msc4380"]], undefined, _td("settings|not_supported"));
    }

    public getValueOverride(_level: SettingLevel): boolean {
        const accountData = this.client?.getAccountData(MSC4380_INVITE_RULES_ACCOUNT_DATA_TYPE)?.getContent();
        return accountData?.default_action == "block";
    }

    public async beforeChange(_level: SettingLevel, _roomId: string | null, newValue: boolean): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        const newDefault = newValue ? "block" : "allow";
        await this.client.setAccountData(MSC4380_INVITE_RULES_ACCOUNT_DATA_TYPE, { default_action: newDefault });
        return true;
    }
}
