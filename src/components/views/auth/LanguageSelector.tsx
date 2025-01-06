/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import SdkConfig from "../../../SdkConfig";
import { getCurrentLanguage } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import PlatformPeg from "../../../PlatformPeg";
import { SettingLevel } from "../../../settings/SettingLevel";
import LanguageDropdown from "../elements/LanguageDropdown";

function onChange(newLang: string): void {
    if (getCurrentLanguage() !== newLang) {
        SettingsStore.setValue("language", null, SettingLevel.DEVICE, newLang);
        PlatformPeg.get()?.reload();
    }
}

interface IProps {
    disabled?: boolean;
}

export default function LanguageSelector({ disabled }: IProps): JSX.Element {
    if (SdkConfig.get("disable_login_language_selector")) return <div />;
    return (
        <LanguageDropdown
            className="mx_AuthBody_language"
            onOptionChange={onChange}
            value={getCurrentLanguage()}
            disabled={disabled}
        />
    );
}
