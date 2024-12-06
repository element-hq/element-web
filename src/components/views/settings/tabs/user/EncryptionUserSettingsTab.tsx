/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX } from "react";

import SettingsTab from "../SettingsTab";
import { RecoveryPanel } from "../../encryption/RecoveryPanel";

export function EncryptionUserSettingsTab(): JSX.Element {
    return (
        <SettingsTab className="mx_EncryptionUserSettingsTab">
            <RecoveryPanel />
        </SettingsTab>
    );
}
