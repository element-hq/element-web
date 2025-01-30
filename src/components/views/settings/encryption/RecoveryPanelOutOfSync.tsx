/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX } from "react";
import { Button } from "@vector-im/compound-web";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";

import { SettingsSection } from "../shared/SettingsSection";
import { _t } from "../../../../languageHandler";
import { SettingsSubheader } from "../SettingsSubheader";
import { accessSecretStorage } from "../../../../SecurityManager";

interface RecoveryPanelOutOfSyncProps {
    /**
     * Callback for when the user has finished entering their recovery key.
     */
    onFinish: () => void;
}

/**
 * This component is shown when the user secrets are not cached and the recovery key needs to be entered.
 */
export function RecoveryPanelOutOfSync({ onFinish }: RecoveryPanelOutOfSyncProps): JSX.Element {
    return (
        <SettingsSection
            legacy={false}
            heading={_t("settings|encryption|recovery|title")}
            subHeading={
                <SettingsSubheader
                    label={_t("settings|encryption|recovery|description")}
                    state="error"
                    stateMessage={_t("settings|encryption|recovery|key_storage_warning")}
                />
            }
            data-testid="recoveryPanel"
        >
            <Button
                size="sm"
                kind="primary"
                Icon={KeyIcon}
                onClick={async () => {
                    await accessSecretStorage();
                    onFinish();
                }}
            >
                {_t("settings|encryption|recovery|enter_recovery_key")}
            </Button>
        </SettingsSection>
    );
}
