/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { JSX, lazy, MouseEventHandler } from "react";
import { Button, InlineSpinner } from "@vector-im/compound-web";
import DownloadIcon from "@vector-im/compound-design-tokens/assets/web/icons/download";
import ShareIcon from "@vector-im/compound-design-tokens/assets/web/icons/share";

import { _t } from "../../../../languageHandler";
import { SettingsSection } from "../shared/SettingsSection";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import Modal from "../../../../Modal";

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
    const keys = useAsyncMemo(
        () => {
            const crypto = matrixClient.getCrypto();
            return crypto ? crypto.getOwnDeviceKeys() : Promise.resolve(null);
        },
        [matrixClient],
        null,
    );

    return (
        <div className="mx_AdvancedPanel_Details">
            <div className="mx_AdvancedPanel_Details_content">
                <span>{_t("settings|encryption|advanced|details_title")}</span>
                <div>
                    <span>{_t("settings|encryption|advanced|session_id")}</span>
                    <span>{matrixClient.deviceId}</span>
                </div>
                <div>
                    <span>{_t("settings|encryption|advanced|session_key")}</span>
                    <span>{keys ? keys.ed25519 : <InlineSpinner />}</span>
                </div>
            </div>
            <div className="mx_AdvancedPanel_buttons">
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
