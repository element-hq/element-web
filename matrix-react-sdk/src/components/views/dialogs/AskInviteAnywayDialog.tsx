/*
Copyright 2019 New Vector Ltd
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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

    const description =
        descriptionProp ??
        _t("Unable to find profiles for the Matrix IDs listed below - would you like to invite them anyway?");

    return (
        <BaseDialog
            className="mx_RetryInvitesDialog"
            onFinished={onGiveUpClicked}
            title={_t("The following users may not exist")}
            contentId="mx_Dialog_content"
        >
            <div id="mx_Dialog_content">
                <p>{description}</p>
                <ul>{errorList}</ul>
            </div>

            <div className="mx_Dialog_buttons">
                <button onClick={onGiveUpClicked}>{_t("Close")}</button>
                <button onClick={onInviteNeverWarnClicked}>
                    {inviteNeverWarnLabel ?? _t("Invite anyway and never warn me again")}
                </button>
                <button onClick={onInviteClicked} autoFocus={true}>
                    {inviteLabel ?? _t("Invite anyway")}
                </button>
            </div>
        </BaseDialog>
    );
}
