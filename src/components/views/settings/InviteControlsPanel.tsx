/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, type FC, useCallback } from "react";
import { ErrorMessage, InlineField, Label, Root, ToggleInput, Tooltip } from "@vector-im/compound-web";

import { SettingsSubsection } from "./shared/SettingsSubsection";
import { _t } from "../../../languageHandler";
import { useInviteControlsViewModel } from "../../viewmodels/settings/InviteControlsViewModel";

export const InviteControlsPanel: FC = () => {
    const { busy, globalInvitesEnabled, toggleGlobalInvites, isSupported, error } = useInviteControlsViewModel();

    const setValue = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (e) => {
            e.preventDefault();
            toggleGlobalInvites();
        },
        [toggleGlobalInvites],
    );

    let content;
    if (isSupported) {
        content = (
            <>
                <InlineField
                    name="default"
                    control={
                        <ToggleInput
                            id="mx_invite_controls_default"
                            disabled={busy}
                            onChange={setValue}
                            checked={globalInvitesEnabled}
                        />
                    }
                >
                    <Label htmlFor="mx_invite_controls_default">{_t("settings|invite_controls|default_label")}</Label>
                    {error && <ErrorMessage>{_t("settings|invite_controls|error_message")}</ErrorMessage>}
                </InlineField>
            </>
        );
    } else if (isSupported === false) {
        content = (
            <Tooltip description={_t("settings|invite_controls|not_supported")}>
                <InlineField
                    name="default"
                    control={
                        <ToggleInput id="mx_invite_controls_default" disabled={true} checked={globalInvitesEnabled} />
                    }
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
