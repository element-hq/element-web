/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

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
                    <SettingsSection>
                        <Notifications />
                    </SettingsSection>
                )}
            </SettingsTab>
        );
    }
}
