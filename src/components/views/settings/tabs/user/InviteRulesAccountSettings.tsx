/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, type FC, useCallback, useState } from "react";
import { Root, SettingsToggleInput } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import { useSettingValue } from "../../../../../hooks/useSettings";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";

export const InviteRulesAccountSetting: FC = () => {
    const rules = useSettingValue("inviteRules");
    const settingsDisabled = SettingsStore.disabledMessage("inviteRules");
    const [busy, setBusy] = useState(false);

    const onChange = useCallback<ChangeEventHandler<HTMLInputElement>>(async (evt) => {
        try {
            setBusy(true);
            await SettingsStore.setValue("inviteRules", null, SettingLevel.ACCOUNT, {
                allBlocked: !evt.target.checked,
            });
        } catch (ex) {
            logger.error(`Unable to set invite rules`, ex);
        } finally {
            setBusy(false);
        }
    }, []);
    return (
        <Root className="mx_MediaPreviewAccountSetting_Form" onSubmit={(evt) => {evt.preventDefault(); evt.stopPropagation();}}>
            <SettingsToggleInput
                className="mx_MediaPreviewAccountSetting_ToggleSwitch"
                name="invite_control_blocked"
                label={_t("settings|invite_controls|default_label")}
                checked={!rules.allBlocked}
                onChange={onChange}
                disabledMessage={settingsDisabled}
                disabled={!!settingsDisabled || busy}
            />
        </Root>
    );
};
