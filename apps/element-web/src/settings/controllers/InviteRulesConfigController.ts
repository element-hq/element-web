/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type IContent } from "matrix-js-sdk/src/matrix";

import { type SettingLevel } from "../SettingLevel.ts";
import MatrixClientBackedController from "./MatrixClientBackedController.ts";
import {
    type ComputedInviteConfig as ComputedInviteRules,
    INVITE_RULES_ACCOUNT_DATA_TYPE,
    type InviteConfigAccountData,
} from "../../@types/invite-rules.ts";
import { _t } from "../../languageHandler.tsx";

/**
 * Handles invite filtering rules provided by MSC4155.
 * This handler does not make use of the roomId parameter.
 */
export default class InviteRulesConfigController extends MatrixClientBackedController {
    public static readonly default: ComputedInviteRules = {
        allBlocked: false,
    };

    private static getValidSettingData(content: IContent): ComputedInviteRules {
        const expectedConfig = content as InviteConfigAccountData;
        return {
            allBlocked: !!expectedConfig.blocked_users?.includes("*"),
        };
    }

    public initMatrixClient(newClient: MatrixClient): void {
        newClient.doesServerSupportUnstableFeature("org.matrix.msc4155").then((result) => {
            this.featureSupported = result;
        });
    }

    public featureSupported?: boolean;

    public constructor() {
        super();
        this.featureSupported = false;
    }

    private getValue = (): ComputedInviteRules => {
        const accountData =
            this.client?.getAccountData(INVITE_RULES_ACCOUNT_DATA_TYPE)?.getContent<InviteConfigAccountData>() ?? {};
        return InviteRulesConfigController.getValidSettingData(accountData);
    };

    public getValueOverride(_level: SettingLevel): ComputedInviteRules {
        return this.getValue();
    }

    public get settingDisabled(): true | string {
        return this.featureSupported ? true : _t("settings|not_supported");
    }

    public async beforeChange(
        _level: SettingLevel,
        _roomId: string | null,
        newValue: ComputedInviteRules,
    ): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        const existingContent = this.client
            .getAccountData(INVITE_RULES_ACCOUNT_DATA_TYPE)
            ?.getContent<InviteConfigAccountData>();
        const newContent: InviteConfigAccountData = {
            ...existingContent,
            blocked_users: [...(existingContent?.blocked_users ?? [])],
        };
        if (newValue.allBlocked && !newContent.blocked_users!.includes("*")) {
            newContent.blocked_users!.push("*");
        } else if (!newValue.allBlocked && newContent.blocked_users?.includes("*")) {
            newContent.blocked_users = newContent.blocked_users.filter((u) => u !== "*");
        } else {
            // No changes required.
            return false;
        }
        await this.client.setAccountData(INVITE_RULES_ACCOUNT_DATA_TYPE, newContent);
        return true;
    }
}
