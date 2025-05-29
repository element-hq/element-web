/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, type FC, useCallback, useEffect, useMemo, useState } from "react";
import { type AccountDataEvents } from "matrix-js-sdk/src/types";
import { ErrorMessage, InlineField, Label, Root, ToggleInput } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

import { SettingsSubsection } from "./shared/SettingsSubsection";
import { _t } from "../../../languageHandler";
import { useAccountData } from "../../../hooks/useAccountData";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

export const InviteControlsPanel: FC = () => {
    const client = useMatrixClientContext();
    const [hasError, setHasError] = useState(false);
    const [busy, setBusy] = useState(false);
    const [canUse, setCanUse] = useState<boolean>(false);
    const inviteConfig = useAccountData<AccountDataEvents["org.matrix.msc4155.invite_permission_config"]>(
        client,
        "org.matrix.msc4155.invite_permission_config",
    );

    useEffect(() => {
        (async () => {
            setCanUse(await client.doesServerSupportUnstableFeature("org.matrix.msc4155"));
        })();
    }, [client]);

    const isBlockingAll = useMemo(() => {
        if (!inviteConfig) {
            return false;
        }
        return inviteConfig["blocked_users"]?.includes("*") === true;
    }, [inviteConfig]);

    const setValue = useCallback<ChangeEventHandler<HTMLInputElement>>(
        async (e) => {
            setHasError(false);
            setBusy(true);
            const newConfig = { ...inviteConfig };
            if (isBlockingAll) {
                newConfig.blocked_users = newConfig.blocked_users.filter((u) => u !== "*");
            } else {
                newConfig.blocked_users = [...new Set([...(newConfig.blocked_users ?? []), "*"])];
            }
            try {
                await client.setAccountData("org.matrix.msc4155.invite_permission_config", newConfig);
            } catch (ex) {
                logger.error("Could not change input config", ex);
                setHasError(true);
            } finally {
                setBusy(false);
            }
        },
        [client, inviteConfig, isBlockingAll],
    );

    if (!canUse) {
        return;
    }

    return (
        <>
            <SettingsSubsection heading={_t("settings|invite_controls|title")}>
                <Root>
                    <InlineField
                        name="default"
                        control={<ToggleInput disabled={busy} onChange={setValue} checked={!isBlockingAll} />}
                    >
                        <Label>{_t("settings|invite_controls|default_label")}</Label>
                        {hasError && <ErrorMessage>{_t("settings|invite_controls|error_message")}</ErrorMessage>}
                    </InlineField>
                </Root>
            </SettingsSubsection>
        </>
    );
};
