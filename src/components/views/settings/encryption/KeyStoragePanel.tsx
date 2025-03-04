/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback } from "react";
import { InlineField, InlineSpinner, Label, Root, ToggleControl } from "@vector-im/compound-web";

import type { FormEvent } from "react";
import { SettingsSection } from "../shared/SettingsSection";
import { _t } from "../../../../languageHandler";
import { SettingsHeader } from "../SettingsHeader";
import { useKeyStoragePanelViewModel } from "../../../viewmodels/settings/encryption/KeyStoragePanelViewModel";

interface Props {
    /**
     * Called when the user turns off the "allow key storage" toggle
     */
    onKeyStorageDisableClick: () => void;
}

/**
 * This component allows the user to set up or change their recovery key.
 *
 * It is used within the "Encryption" settings tab.
 */
export const KeyStoragePanel: React.FC<Props> = ({ onKeyStorageDisableClick }) => {
    const { isEnabled, setEnabled, loading, busy } = useKeyStoragePanelViewModel();

    const onKeyBackupChange = useCallback(
        (e: FormEvent<HTMLInputElement>) => {
            if (e.currentTarget.checked) {
                setEnabled(true);
            } else {
                onKeyStorageDisableClick();
            }
        },
        [setEnabled, onKeyStorageDisableClick],
    );

    if (loading) {
        return <InlineSpinner aria-label={_t("common|loading")} />;
    }

    return (
        <SettingsSection
            legacy={false}
            heading={
                <SettingsHeader
                    hasRecommendedTag={isEnabled === false}
                    label={_t("settings|encryption|key_storage|title")}
                />
            }
            subHeading={_t("settings|encryption|key_storage|description", undefined, {
                a: (sub) => (
                    <a href="https://element.io/help#encryption5" target="_blank" rel="noreferrer noopener">
                        {sub}
                    </a>
                ),
            })}
        >
            <Root className="mx_KeyStoragePanel_toggleRow">
                <InlineField
                    name="keyStorage"
                    control={<ToggleControl name="keyStorage" checked={isEnabled} onChange={onKeyBackupChange} />}
                >
                    <Label>{_t("settings|encryption|key_storage|allow_key_storage")}</Label>
                </InlineField>
                {busy && <InlineSpinner />}
            </Root>
        </SettingsSection>
    );
};
