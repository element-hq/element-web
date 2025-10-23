/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useId, useState } from "react";
import { _t } from "@element-hq/web-shared-components";

import SettingsStore from "../../../settings/SettingsStore";
import { type SettingLevel } from "../../../settings/SettingLevel";
import { SETTINGS, type StringSettingKey } from "../../../settings/Settings";
import { useSettingValueAt } from "../../../hooks/useSettings.ts";
import Dropdown, { type DropdownProps } from "./Dropdown.tsx";

interface Props {
    settingKey: StringSettingKey;
    level: SettingLevel;
    roomId?: string; // for per-room settings
    label?: string;
    isExplicit?: boolean;
    hideIfCannotSet?: boolean;
    onChange?(option: string): void;
}

const SettingsDropdown = ({
    settingKey,
    roomId,
    level,
    label: specificLabel,
    isExplicit,
    hideIfCannotSet,
    onChange,
}: Props): JSX.Element => {
    const id = useId();
    const settingValue = useSettingValueAt(level, settingKey, roomId ?? null, isExplicit);
    const [value, setValue] = useState(settingValue);
    const setting = SETTINGS[settingKey];

    const onOptionChange = useCallback(
        (value: string): void => {
            setValue(value); // local echo
            SettingsStore.setValue(settingKey, roomId ?? null, level, value);
            onChange?.(value);
        },
        [settingKey, roomId, level, onChange],
    );

    const disabled = !SettingsStore.canSetValue(settingKey, roomId ?? null, level);
    if (disabled && hideIfCannotSet) return <></>;
    if (!setting.options) {
        console.error("SettingsDropdown used for a setting with no `options`");
        return <></>;
    }

    const label = specificLabel ?? SettingsStore.getDisplayName(settingKey, level)!;
    const options = setting.options.map((option) => {
        return <div key={option.value}>{_t(option.label)}</div>;
    }) as DropdownProps["children"];

    return (
        <div className="mx_SettingsDropdown">
            <label className="mx_SettingsDropdown_label" htmlFor={id}>
                <span className="mx_SettingsDropdown_labelText">{label}</span>
            </label>
            <Dropdown
                id={id}
                onOptionChange={onOptionChange}
                menuWidth={360} // matches CSS width
                value={value}
                disabled={disabled}
                label={label}
            >
                {options}
            </Dropdown>
        </div>
    );
};

export default SettingsDropdown;
