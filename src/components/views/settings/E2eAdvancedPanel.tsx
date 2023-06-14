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

import React from "react";

import { _t } from "../../../languageHandler";
import { SettingLevel } from "../../../settings/SettingLevel";
import SettingsStore from "../../../settings/SettingsStore";
import SettingsFlag from "../elements/SettingsFlag";
import SettingsSubsection, { SettingsSubsectionText } from "./shared/SettingsSubsection";

const SETTING_MANUALLY_VERIFY_ALL_SESSIONS = "e2ee.manuallyVerifyAllSessions";

const E2eAdvancedPanel: React.FC = () => {
    return (
        <SettingsSubsection heading={_t("Encryption")}>
            <SettingsFlag name={SETTING_MANUALLY_VERIFY_ALL_SESSIONS} level={SettingLevel.DEVICE} />
            <SettingsSubsectionText>
                {_t(
                    "Individually verify each session used by a user to mark it as trusted, not trusting cross-signed devices.",
                )}
            </SettingsSubsectionText>
        </SettingsSubsection>
    );
};

export default E2eAdvancedPanel;

export function isE2eAdvancedPanelPossible(): boolean {
    return SettingsStore.isEnabled(SETTING_MANUALLY_VERIFY_ALL_SESSIONS);
}
