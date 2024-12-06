/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX, useState } from "react";

import SettingsTab from "../SettingsTab";
import { RecoveryPanel } from "../../encryption/RecoveryPanel";
import { ChangeRecoveryKey } from "../../encryption/ChangeRecoveryKey";

type Panel = "main" | "change_recovery_key" | "set_recovery_key";

export function EncryptionUserSettingsTab(): JSX.Element {
    const [panel, setPanel] = useState<Panel>("main");

    let content: JSX.Element;
    switch (panel) {
        case "main":
            content = (
                <RecoveryPanel
                    onChangingRecoveryKeyClick={() => setPanel("change_recovery_key")}
                    onSetUpRecoveryClick={() => setPanel("set_recovery_key")}
                />
            );
            break;
        case "set_recovery_key":
            content = (
                <ChangeRecoveryKey
                    isSetupFlow={true}
                    onCancelClick={() => setPanel("main")}
                    onFinish={() => setPanel("main")}
                />
            );
            break;
        case "change_recovery_key":
            content = (
                <ChangeRecoveryKey
                    isSetupFlow={false}
                    onCancelClick={() => setPanel("main")}
                    onFinish={() => setPanel("main")}
                />
            );
            break;
    }

    return <SettingsTab className="mx_EncryptionUserSettingsTab">{content}</SettingsTab>;
}
