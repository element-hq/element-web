/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type JSX, useCallback, useState } from "react";
import { EditInPlace } from "@vector-im/compound-web";

import SettingsStore from "../../../settings/SettingsStore";
import { _t } from "../../../languageHandler";
import { type SettingLevel } from "../../../settings/SettingLevel";
import { type StringSettingKey } from "../../../settings/Settings";

interface Props {
    settingKey: StringSettingKey;
    level: SettingLevel;
    roomId?: string; // for per-room settings
    label?: string;
    isExplicit?: boolean;
    onChange?(value: string): void;
}

const SettingsField = ({ settingKey, level, roomId, isExplicit, label, onChange: _onSave }: Props): JSX.Element => {
    const settingsValue = SettingsStore.getValueAt(level, settingKey, roomId, isExplicit);
    const [value, setValue] = useState(settingsValue);
    const [busy, setBusy] = useState(false);

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    }, []);
    const onCancel = useCallback(() => {
        setValue(settingsValue);
    }, [settingsValue]);
    const onSave = useCallback(async () => {
        setBusy(true);
        await SettingsStore.setValue(settingKey, roomId ?? null, level, value);
        setBusy(false);
        _onSave?.(value);
    }, [level, roomId, settingKey, value, _onSave]);

    return (
        <EditInPlace
            label={label ?? SettingsStore.getDisplayName(settingKey, level) ?? ""}
            value={value}
            saveButtonLabel={_t("common|save")}
            cancelButtonLabel={_t("common|cancel")}
            savedLabel={_t("common|saved")}
            savingLabel={_t("common|updating")}
            onChange={onChange}
            onCancel={onCancel}
            onSave={onSave}
            disabled={busy}
        />
    );
};

export default SettingsField;
