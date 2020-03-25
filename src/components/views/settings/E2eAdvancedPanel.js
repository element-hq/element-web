/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';

import * as sdk from '../../../index';
import {_t} from "../../../languageHandler";
import {SettingLevel} from "../../../settings/SettingsStore";

const SETTING_MANUALLY_VERIFY_ALL_SESSIONS = "e2ee.manuallyVerifyAllSessions";

const E2eAdvancedPanel = props => {
    const SettingsFlag = sdk.getComponent('views.elements.SettingsFlag');
    return <div className="mx_SettingsTab_section">
        <span className="mx_SettingsTab_subheading">{_t("Advanced")}</span>

        <SettingsFlag name={SETTING_MANUALLY_VERIFY_ALL_SESSIONS}
            level={SettingLevel.DEVICE}
        />
        <div className="mx_E2eAdvancedPanel_settingLongDescription">{_t(
            "Individually verify each session used by a user to mark it as trusted, not trusting cross-signed devices.",
        )}</div>
    </div>;
};

export default E2eAdvancedPanel;
