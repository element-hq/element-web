/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SdkConfig from "../SdkConfig";
import SettingsStore from "../settings/SettingsStore";
import { UIFeature } from "../settings/UIFeature";

export function shouldShowFeedback(): boolean {
    return !!SdkConfig.get().bug_report_endpoint_url && SettingsStore.getValue(UIFeature.Feedback);
}
