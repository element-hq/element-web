/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, useCallback, useState } from "react";
import { ErrorMessage, Root } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import { useSettingValue } from "../../../../../hooks/useSettings";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";

export const InviteRulesAccountSetting: FC = () => {
    const rules = useSettingValue("inviteRules");
    const settingsDisabled = SettingsStore.disabledMessage("inviteRules");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);

    const onChange = useCallback((checked: boolean) => {
        (async () => {
            console.log("Checked", checked);
            try {
                setError(false);
                setBusy(true);
                await SettingsStore.setValue("inviteRules", null, SettingLevel.ACCOUNT, {
                    allBlocked: !checked,
                });
            } catch (ex) {
                logger.error(`Unable to set invite rules`, ex);
                setError(true);
            } finally {
                setBusy(false);
            }
        })();
    }, []);
    return (
        <Root className="mx_MediaPreviewAccountSetting_Form">
            <LabelledToggleSwitch
                className="mx_MediaPreviewAccountSetting_ToggleSwitch"
                label={_t("settings|invite_controls|default_label")}
                value={!rules.allBlocked}
                onChange={onChange}
                tooltip={settingsDisabled}
                disabled={!!settingsDisabled || busy}
            />
            {error && <ErrorMessage>{_t("settings|invite_controls|error_message")}</ErrorMessage>}
        </Root>
    );
};
