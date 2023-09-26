/*
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

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

import { _t } from "../../../../../languageHandler";
import { Features } from "../../../../../settings/Settings";
import SettingsStore from "../../../../../settings/SettingsStore";
import Notifications from "../../Notifications";
import NotificationSettings2 from "../../notifications/NotificationSettings2";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsTab from "../SettingsTab";

export default class NotificationUserSettingsTab extends React.Component {
    public render(): React.ReactNode {
        const newNotificationSettingsEnabled = SettingsStore.getValue(Features.NotificationSettings2);

        return (
            <SettingsTab>
                {newNotificationSettingsEnabled ? (
                    <NotificationSettings2 />
                ) : (
                    <SettingsSection heading={_t("notifications|enable_prompt_toast_title")}>
                        <Notifications />
                    </SettingsSection>
                )}
            </SettingsTab>
        );
    }
}
