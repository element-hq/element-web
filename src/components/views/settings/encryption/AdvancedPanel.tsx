/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, lazy, type MouseEventHandler } from "react";
import { Button, HelpMessage, InlineField, InlineSpinner, Label, Root, ToggleControl } from "@vector-im/compound-web";
import DownloadIcon from "@vector-im/compound-design-tokens/assets/web/icons/download";
import ShareIcon from "@vector-im/compound-design-tokens/assets/web/icons/share";

import { _t } from "../../../../languageHandler";
import { SettingsSection } from "../shared/SettingsSection";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import Modal from "../../../../Modal";
import { SettingLevel } from "../../../../settings/SettingLevel";
import { useSettingValueAt } from "../../../../hooks/useSettings";
import SettingsStore from "../../../../settings/SettingsStore";

interface AdvancedPanelProps {
    /**
     * Callback for when the user clicks the button to reset their identity.
     */
    onResetIdentityClick: MouseEventHandler<HTMLButtonElement>;
}

/**
 * The advanced panel of the encryption settings.
 */
export function AdvancedPanel({ onResetIdentityClick }: AdvancedPanelProps): JSX.Element {
    return (
        <SettingsSection heading={_t("settings|encryption|advanced|title")} legacy={false}>
            <EncryptionDetails onResetIdentityClick={onResetIdentityClick} />
            <OtherSettings />
        </SettingsSection>
    );
}

interface EncryptionDetails {
    /**
     * Callback for when the user clicks the button to reset their identity.
     */
    onResetIdentityClick: MouseEventHandler<HTMLButtonElement>;
}

/**
 * The encryption details section of the advanced panel.
 */
function EncryptionDetails({ onResetIdentityClick }: EncryptionDetails): JSX.Element {
    const matrixClient = useMatrixClientContext();
    // Null when the keys are not loaded yet
    const keys = useAsyncMemo(() => matrixClient.getCrypto()!.getOwnDeviceKeys(), [matrixClient], null);

    return (
        <div className="mx_EncryptionDetails" data-testid="encryptionDetails">
            <div className="mx_EncryptionDetails_session">
                <h3 className="mx_EncryptionDetails_session_title">
                    {_t("settings|encryption|advanced|details_title")}
                </h3>
                <div>
                    <span>{_t("settings|encryption|advanced|session_id")}</span>
                    <span data-testid="deviceId">{matrixClient.deviceId}</span>
                </div>
                <div>
                    <span>{_t("settings|encryption|advanced|session_key")}</span>
                    <span data-testid="sessionKey">
                        {keys ? keys.ed25519 : <InlineSpinner aria-label={_t("common|loading")} />}
                    </span>
                </div>
            </div>
            <div className="mx_EncryptionDetails_buttons">
                <Button
                    size="sm"
                    kind="secondary"
                    Icon={ShareIcon}
                    onClick={() =>
                        Modal.createDialog(
                            lazy(
                                () => import("../../../../async-components/views/dialogs/security/ExportE2eKeysDialog"),
                            ),
                            { matrixClient },
                        )
                    }
                >
                    {_t("settings|encryption|advanced|export_keys")}
                </Button>
                <Button
                    size="sm"
                    kind="secondary"
                    Icon={DownloadIcon}
                    onClick={() =>
                        Modal.createDialog(
                            lazy(
                                () => import("../../../../async-components/views/dialogs/security/ImportE2eKeysDialog"),
                            ),
                            { matrixClient },
                        )
                    }
                >
                    {_t("settings|encryption|advanced|import_keys")}
                </Button>
            </div>
            <Button size="sm" kind="tertiary" destructive={true} onClick={onResetIdentityClick}>
                {_t("settings|encryption|advanced|reset_identity")}
            </Button>
        </div>
    );
}

/**
 * Display the never send encrypted message to unverified devices setting.
 */
function OtherSettings(): JSX.Element | null {
    const blacklistUnverifiedDevices = useSettingValueAt(SettingLevel.DEVICE, "blacklistUnverifiedDevices");
    const canSetValue = SettingsStore.canSetValue("blacklistUnverifiedDevices", null, SettingLevel.DEVICE);
    if (!canSetValue) return null;

    return (
        <Root
            data-testid="otherSettings"
            className="mx_OtherSettings"
            onChange={async (evt) => {
                const checked = new FormData(evt.currentTarget).get("neverSendEncrypted") === "on";
                await SettingsStore.setValue("blacklistUnverifiedDevices", null, SettingLevel.DEVICE, checked);
            }}
        >
            <h3 className="mx_OtherSettings_title">{_t("settings|encryption|advanced|other_people_device_title")}</h3>
            <InlineField
                name="neverSendEncrypted"
                control={<ToggleControl name="neverSendEncrypted" defaultChecked={blacklistUnverifiedDevices} />}
            >
                <Label>{_t("settings|encryption|advanced|other_people_device_label")}</Label>
                <HelpMessage>{_t("settings|encryption|advanced|other_people_device_description")}</HelpMessage>
            </InlineField>
        </Root>
    );
}
