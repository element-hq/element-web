/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, type FC, useCallback, useEffect, useMemo, useState } from "react";
import { type AccountDataEvents } from "matrix-js-sdk/src/types";
import { ErrorMessage, InlineField, Label, Root, ToggleInput, Tooltip } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

import { SettingsSubsection } from "./shared/SettingsSubsection";
import { _t } from "../../../languageHandler";
import { useAccountData } from "../../../hooks/useAccountData";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

export const InviteControlsPanel: FC = () => {
    const client = useMatrixClientContext();
    const [hasError, setHasError] = useState(false);
    const [busy, setBusy] = useState(false);
    const [canUse, setCanUse] = useState<boolean>();
    const inviteConfig = useAccountData<AccountDataEvents["org.matrix.msc4155.invite_permission_config"]>(
        client,
        "org.matrix.msc4155.invite_permission_config",
    );

    useEffect(() => {
        (async () => {
            setCanUse(await client.doesServerSupportUnstableFeature("org.matrix.msc4155"));
        })();
    }, [client]);

    // This implements a very basic version of MSC4155 that simply allows
    // or disallows all invites by setting a simple glob.
    // Keep in mind that users may configure more powerful rules on other
    // clients and we should keep those intact.
    const isBlockingAll = useMemo(() => {
        if (!inviteConfig) {
            return false;
        }
        return inviteConfig["blocked_users"]?.includes("*") === true;
    }, [inviteConfig]);

    const setValue = useCallback<ChangeEventHandler<HTMLInputElement>>(
        async (e) => {
            e.preventDefault();
            setHasError(false);
            setBusy(true);
            const newConfig = { ...inviteConfig };
            if (newConfig["blocked_users"]?.includes("*")) {
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
        [client, inviteConfig],
    );

    let content;
    if (canUse) {
        content = (
            <>
                <InlineField
                    name="default"
                    control={
                        <ToggleInput
                            id="mx_invite_controls_default"
                            disabled={busy || !canUse}
                            onChange={setValue}
                            checked={!isBlockingAll}
                        />
                    }
                >
                    <Label htmlFor="mx_invite_controls_default">{_t("settings|invite_controls|default_label")}</Label>
                    {hasError && <ErrorMessage>{_t("settings|invite_controls|error_message")}</ErrorMessage>}
                </InlineField>
            </>
        );
    } else if (canUse === false) {
        content = (
            <Tooltip description={_t("settings|invite_controls|not_supported")}>
                <InlineField
                    name="default"
                    control={<ToggleInput id="mx_invite_controls_default" disabled={true} checked={!isBlockingAll} />}
                >
                    <Label htmlFor="mx_invite_controls_default">{_t("settings|invite_controls|default_label")}</Label>
                </InlineField>
            </Tooltip>
        );
    } else {
        return;
    }

    return (
        <SettingsSubsection heading={_t("settings|invite_controls|title")}>
            <Root>{content}</Root>
        </SettingsSubsection>
    );
};
