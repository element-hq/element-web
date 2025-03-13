/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback } from "react";

import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import BaseDialog from "./BaseDialog";

export interface UnknownProfile {
    userId: string;
    errorText: string;
}

export type UnknownProfiles = UnknownProfile[];

export interface AskInviteAnywayDialogProps {
    unknownProfileUsers: UnknownProfiles;
    onInviteAnyways: () => void;
    onGiveUp: () => void;
    onFinished: (success: boolean) => void;
    description?: string;
    inviteNeverWarnLabel?: string;
    inviteLabel?: string;
}

export default function AskInviteAnywayDialog({
    onFinished,
    onGiveUp,
    onInviteAnyways,
    unknownProfileUsers,
    description: descriptionProp,
    inviteNeverWarnLabel,
    inviteLabel,
}: AskInviteAnywayDialogProps): JSX.Element {
    const onInviteClicked = useCallback((): void => {
        onInviteAnyways();
        onFinished(true);
    }, [onInviteAnyways, onFinished]);

    const onInviteNeverWarnClicked = useCallback((): void => {
        SettingsStore.setValue("promptBeforeInviteUnknownUsers", null, SettingLevel.ACCOUNT, false);
        onInviteAnyways();
        onFinished(true);
    }, [onInviteAnyways, onFinished]);

    const onGiveUpClicked = useCallback((): void => {
        onGiveUp();
        onFinished(false);
    }, [onGiveUp, onFinished]);

    const errorList = unknownProfileUsers.map((address) => (
        <li key={address.userId}>
            {address.userId}: {address.errorText}
        </li>
    ));

    const description = descriptionProp ?? _t("invite|unable_find_profiles_description_default");

    return (
        <BaseDialog
            className="mx_RetryInvitesDialog"
            onFinished={onGiveUpClicked}
            title={_t("invite|unable_find_profiles_title")}
            contentId="mx_Dialog_content"
        >
            <div id="mx_Dialog_content">
                <p>{description}</p>
                <ul>{errorList}</ul>
            </div>

            <div className="mx_Dialog_buttons">
                <button onClick={onGiveUpClicked}>{_t("action|close")}</button>
                <button onClick={onInviteNeverWarnClicked}>
                    {inviteNeverWarnLabel ?? _t("invite|unable_find_profiles_invite_never_warn_label_default")}
                </button>
                <button onClick={onInviteClicked} autoFocus={true}>
                    {inviteLabel ?? _t("invite|unable_find_profiles_invite_label_default")}
                </button>
            </div>
        </BaseDialog>
    );
}
