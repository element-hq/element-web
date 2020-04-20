/*
Copyright 2018 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import SdkConfig from "../../../SdkConfig";
import {getCurrentLanguage} from "../../../languageHandler";
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";
import PlatformPeg from "../../../PlatformPeg";
import * as sdk from '../../../index';
import React from 'react';

function onChange(newLang) {
    if (getCurrentLanguage() !== newLang) {
        SettingsStore.setValue("language", null, SettingLevel.DEVICE, newLang);
        PlatformPeg.get().reload();
    }
}

export default function LanguageSelector({disabled}) {
    if (SdkConfig.get()['disable_login_language_selector']) return <div />;

    const LanguageDropdown = sdk.getComponent('views.elements.LanguageDropdown');
    return <LanguageDropdown
        className="mx_AuthBody_language"
        onOptionChange={onChange}
        value={getCurrentLanguage()}
        disabled={disabled}
    />;
}
