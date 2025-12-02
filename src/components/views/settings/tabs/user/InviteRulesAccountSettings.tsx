/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, useCallback, useState } from "react";
import { Root } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import { useSettingValue } from "../../../../../hooks/useSettings";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";

/**
 * A settings component which allows the user to enable/disable invite blocking.
 *
 * Uses whichever of MSC4155 and MSC4380 is available on the server; if neither is available, the toggle is disabled. If
 * both are available, the toggle will use MSC4380 to block invites.
 */
export const InviteRulesAccountSetting: FC = () => {
    const msc4155Rules = useSettingValue("inviteRules");
    const msc4380BlockInvites = useSettingValue("blockInvites");

    const msc4155Disabled = SettingsStore.disabledMessage("inviteRules");
    const msc4380Disabled = SettingsStore.disabledMessage("blockInvites");

    const [busy, setBusy] = useState(false);

    const onChange = useCallback(
        async (allowInvites: boolean) => {
            try {
                setBusy(true);
                if (allowInvites) {
                    // When allowing invites, clear the block setting on both bits of account data.
                    await SettingsStore.setValue("blockInvites", null, SettingLevel.ACCOUNT, false);
                    await SettingsStore.setValue("inviteRules", null, SettingLevel.ACCOUNT, { allBlocked: false });
                } else {
                    // When blocking invites, prefer MSC4380 over MSC4155.
                    if (!msc4380Disabled) {
                        await SettingsStore.setValue("blockInvites", null, SettingLevel.ACCOUNT, true);
                    } else if (!msc4155Disabled) {
                        await SettingsStore.setValue("inviteRules", null, SettingLevel.ACCOUNT, { allBlocked: true });
                    }
                }
            } catch (ex) {
                logger.error(`Unable to set invite rules`, ex);
            } finally {
                setBusy(false);
            }
        },
        [msc4155Disabled, msc4380Disabled, setBusy],
    );

    const disabledMessage = msc4155Disabled && msc4380Disabled;
    const invitesBlocked = (!msc4155Disabled && msc4155Rules.allBlocked) || (!msc4380Disabled && msc4380BlockInvites);
    return (
        <Root className="mx_MediaPreviewAccountSetting_Form">
            <LabelledToggleSwitch
                className="mx_MediaPreviewAccountSetting_ToggleSwitch"
                label={_t("settings|invite_controls|default_label")}
                value={!invitesBlocked}
                onChange={onChange}
                tooltip={disabledMessage}
                disabled={!!disabledMessage || busy}
            />
        </Root>
    );
};
