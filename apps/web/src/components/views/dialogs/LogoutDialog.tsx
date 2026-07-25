/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { Button, Text } from "@vector-im/compound-web";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";
import KeyIcon from "@vector-im/compound-design-tokens/assets/web/icons/key";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";
import SignOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/sign-out";

import dis from "../../../dispatcher/dispatcher";
import { type OpenToTabPayload } from "../../../dispatcher/payloads/OpenToTabPayload";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../../../components/views/dialogs/UserTab";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import QuestionDialog from "./QuestionDialog";
import BaseDialog from "./BaseDialog";
import Spinner from "../elements/Spinner";
import { BackupStatus, useKeyBackupStatus } from "../../../hooks/useKeyBackupStatus";
import { useHasOtherVerifiedDevices } from "../../../hooks/useHasOtherVerifiedDevices";
import { EncryptionCard } from "../settings/encryption/EncryptionCard";
import { EncryptionCardButtons } from "../settings/encryption/EncryptionCardButtons";
import { EncryptionCardEmphasisedContent } from "../settings/encryption/EncryptionCardEmphasisedContent";

interface IProps {
    onFinished: (success: boolean) => void;
}

/**
 * Checks if the `LogoutDialog` should be shown instead of the simple logout flow.
 * The `LogoutDialog` will check the crypto recovery status of the account and
 * help the user setup recovery properly if needed.
 */
export async function shouldShowLogoutDialog(cli: MatrixClient): Promise<boolean> {
    const crypto = cli?.getCrypto();
    return !!crypto;
}

export default function LogoutDialog(props: IProps): JSX.Element {
    const client = MatrixClientPeg.safeGet();
    const backupStatus = useKeyBackupStatus(client);
    const hasOtherVerifiedDevices = useHasOtherVerifiedDevices(client);

    const onFinished = (confirmed?: boolean): void => {
        if (confirmed) {
            dis.dispatch({ action: "logout" });
        }
        props.onFinished(!!confirmed);
    };

    const onLogoutConfirm = (): void => {
        dis.dispatch({ action: "logout" });

        // close dialog
        props.onFinished(true);
    };

    const onGoToSettings = (): void => {
        // Open the user settings dialog to the encryption tab and start the flow to get recovery key
        const payload: OpenToTabPayload = {
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Encryption,
            props: {
                initialEncryptionState: "set_recovery_key",
            },
        };
        dis.dispatch(payload);

        props.onFinished(false);
    };

    if (hasOtherVerifiedDevices === undefined) {
        return <Loading onFinished={onFinished} />;
    } else if (hasOtherVerifiedDevices) {
        return <ConfirmLogout onFinished={onFinished} />;
    }
    switch (backupStatus) {
        case BackupStatus.LOADING:
            return <Loading onFinished={onFinished} />;

        case BackupStatus.NO_CRYPTO:
        case BackupStatus.BACKUP_ACTIVE:
            return <ConfirmLogout onFinished={onFinished} />;

        case BackupStatus.NO_BACKUP:
        case BackupStatus.SERVER_BACKUP_BUT_DISABLED:
        case BackupStatus.ERROR:
        case BackupStatus.BACKUP_NO_RECOVERY: {
            return (
                <BaseDialog
                    contentId="mx_Dialog_content"
                    hasCancel={true}
                    onFinished={onFinished}
                    className="mx_LogoutDialog"
                >
                    <EncryptionCard
                        Icon={ErrorIcon}
                        destructive={true}
                        title={_t("auth|logout_dialog|setup_key_backup_title")}
                        className="mx_EncryptionCard_noBorder"
                    >
                        <EncryptionCardEmphasisedContent>
                            <Text>{_t("auth|logout_dialog|setup_secure_backup_description")}</Text>
                            <Text as="a" target="_blank" href="https://element.io/en/help#encryption16">
                                {_t("action|learn_more")} <PopOutIcon />
                            </Text>
                        </EncryptionCardEmphasisedContent>
                        <EncryptionCardButtons>
                            <Button onClick={onGoToSettings} Icon={KeyIcon}>
                                {_t("settings|encryption|recovery|set_up_recovery")}
                            </Button>
                            <Button kind="tertiary" destructive={true} onClick={onLogoutConfirm} Icon={SignOutIcon}>
                                {_t("auth|logout_dialog|skip_key_backup")}
                            </Button>
                        </EncryptionCardButtons>
                    </EncryptionCard>
                </BaseDialog>
            );
        }
    }
}

interface SubComponentProps {
    onFinished: (confirmed?: boolean) => void;
}

// Dialog contents to show a spinner while deciding whether to prompt the
// user to set up recovery
function Loading(props: SubComponentProps): JSX.Element {
    return (
        <BaseDialog
            title={_t("action|sign_out")}
            contentId="mx_Dialog_content"
            hasCancel={true}
            onFinished={props.onFinished}
        >
            <Spinner />
        </BaseDialog>
    );
}

// Dialog contents to confirm whether the user is sure if they want to log
// out.
function ConfirmLogout(props: SubComponentProps): JSX.Element {
    return (
        <QuestionDialog
            hasCancelButton={true}
            title={_t("action|sign_out")}
            description={_t("auth|logout_dialog|description")}
            button={_t("action|sign_out")}
            onFinished={props.onFinished}
        />
    );
}
