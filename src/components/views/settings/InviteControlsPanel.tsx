/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, type FC, useCallback, useState } from "react";
import { type AccountDataEvents } from "matrix-js-sdk/src/types";
import { ErrorMessage, InlineField, Label, Root, ToggleInput } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

import { SettingsSubsection } from "./shared/SettingsSubsection";
import { _t } from "../../../languageHandler";
import { useAccountData } from "../../../hooks/useAccountData";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

export const InviteControlsPanel: FC = () => {
    const client = useMatrixClientContext();
    const inviteState = useAccountData<AccountDataEvents["org.matrix.msc4155.invite_permission_config"]>(
        client,
        "org.matrix.msc4155.invite_permission_config",
    );
    const isOn = inviteState.default !== "block";
    const [hasError, setHasError] = useState(false);
    const [busy, setBusy] = useState(false);

    const setValue = useCallback<ChangeEventHandler<HTMLInputElement>>(
        async (e) => {
            setHasError(false);
            setBusy(true);
            try {
                await client.setAccountData("org.matrix.msc4155.invite_permission_config", {
                    // Don't remove any other state set by other clients.
                    ...inviteState,
                    default: e.target.checked ? "allow" : "block",
                });
            } catch (ex) {
                logger.error("Could not change input config", ex);
                setHasError(true);
            } finally {
                setBusy(false);
            }
        },
        [client, inviteState, isOn],
    );

    return (
        <SettingsSubsection heading={_t("settings|invite_controls|title")}>
            <Root>
                <InlineField
                    name="default"
                    control={<ToggleInput disabled={busy} onChange={setValue} checked={isOn} />}
                >
                    <Label>{_t("settings|invite_controls|default_label")}</Label>
                    {hasError && <ErrorMessage>{_t("settings|invite_controls|error_message")}</ErrorMessage>}
                </InlineField>
            </Root>
        </SettingsSubsection>
    );
};
