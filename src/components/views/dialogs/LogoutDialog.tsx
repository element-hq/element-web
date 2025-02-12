/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { lazy } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import Modal from "../../../Modal";
import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import RestoreKeyBackupDialog from "./security/RestoreKeyBackupDialog";
import QuestionDialog from "./QuestionDialog";
import BaseDialog from "./BaseDialog";
import Spinner from "../elements/Spinner";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    onFinished: (success: boolean) => void;
}

enum BackupStatus {
    /** we're trying to figure out if there is an active backup */
    LOADING,

    /** crypto is disabled in this client (so no need to back up) */
    NO_CRYPTO,

    /** Key backup is active and working */
    BACKUP_ACTIVE,

    /** there is a backup on the server but we are not backing up to it */
    SERVER_BACKUP_BUT_DISABLED,

    /** Key backup is set up but recovery (4s) is not */
    BACKUP_NO_RECOVERY,

    /** backup is not set up locally and there is no backup on the server */
    NO_BACKUP,

    /** there was an error fetching the state */
    ERROR,
}

interface IState {
    backupStatus: BackupStatus;
}

/**
 * Checks if the `LogoutDialog` should be shown instead of the simple logout flow.
 * The `LogoutDialog` will check the crypto recovery status of the account and
 * help the user setup recovery properly if needed.
 */
export async function shouldShowLogoutDialog(cli: MatrixClient): Promise<boolean> {
    const crypto = cli?.getCrypto();
    if (!crypto) return false;

    // If any room is encrypted, we need to show the advanced logout flow
    const allRooms = cli!.getRooms();
    for (const room of allRooms) {
        const isE2e = await crypto.isEncryptionEnabledInRoom(room.roomId);
        if (isE2e) return true;
    }

    return false;
}

export default class LogoutDialog extends React.Component<IProps, IState> {
    public static defaultProps = {
        onFinished: function () {},
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            backupStatus: BackupStatus.LOADING,
        };
    }

    public componentDidMount(): void {
        this.startLoadBackupStatus();
    }

    /** kick off the asynchronous calls to populate `state.backupStatus` in the background */
    private startLoadBackupStatus(): void {
        this.loadBackupStatus().catch((e) => {
            logger.log("Unable to fetch key backup status", e);
            this.setState({
                backupStatus: BackupStatus.ERROR,
            });
        });
    }

    private async loadBackupStatus(): Promise<void> {
        const client = MatrixClientPeg.safeGet();
        const crypto = client.getCrypto();
        if (!crypto) {
            this.setState({ backupStatus: BackupStatus.NO_CRYPTO });
            return;
        }

        if ((await crypto.getActiveSessionBackupVersion()) !== null) {
            if (await crypto.isSecretStorageReady()) {
                this.setState({ backupStatus: BackupStatus.BACKUP_ACTIVE });
            } else {
                this.setState({ backupStatus: BackupStatus.BACKUP_NO_RECOVERY });
            }
            return;
        }

        // backup is not active. see if there is a backup version on the server we ought to back up to.
        const backupInfo = await crypto.getKeyBackupInfo();
        this.setState({ backupStatus: backupInfo ? BackupStatus.SERVER_BACKUP_BUT_DISABLED : BackupStatus.NO_BACKUP });
    }

    private onExportE2eKeysClicked = (): void => {
        Modal.createDialog(
            lazy(() => import("../../../async-components/views/dialogs/security/ExportE2eKeysDialog")),
            {
                matrixClient: MatrixClientPeg.safeGet(),
            },
        );
    };

    private onFinished = (confirmed?: boolean): void => {
        if (confirmed) {
            dis.dispatch({ action: "logout" });
        }
        // close dialog
        this.props.onFinished(!!confirmed);
    };

    private onSetRecoveryMethodClick = (): void => {
        if (this.state.backupStatus === BackupStatus.SERVER_BACKUP_BUT_DISABLED) {
            // A key backup exists for this account, but the creating device is not
            // verified, so restore the backup which will give us the keys from it and
            // allow us to trust it (ie. upload keys to it)
            Modal.createDialog(
                RestoreKeyBackupDialog,
                undefined,
                undefined,
                /* priority = */ false,
                /* static = */ true,
            );
        } else {
            Modal.createDialog(
                lazy(() => import("../../../async-components/views/dialogs/security/CreateKeyBackupDialog")),
                undefined,
                undefined,
                /* priority = */ false,
                /* static = */ true,
            );
        }

        // close dialog
        this.props.onFinished(true);
    };

    private onLogoutConfirm = (): void => {
        dis.dispatch({ action: "logout" });

        // close dialog
        this.props.onFinished(true);
    };

    /**
     * Show a dialog prompting the user to set up their recovery method.
     *
     * Either:
     *  * There is no backup at all ({@link BackupStatus.NO_BACKUP})
     *  * There is a backup set up but recovery (4s) is not ({@link BackupStatus.BACKUP_NO_RECOVERY})
     *  * There is a backup on the server but we are not connected to it ({@link BackupStatus.SERVER_BACKUP_BUT_DISABLED})
     *  * We were unable to pull the backup data ({@link BackupStatus.ERROR}).
     *
     * In all four cases, we should prompt the user to set up a method of recovery.
     */
    private renderSetupRecoveryMethod(): React.ReactNode {
        const description = (
            <div>
                <p>{_t("auth|logout_dialog|setup_secure_backup_description_1")}</p>
                <p>{_t("auth|logout_dialog|setup_secure_backup_description_2")}</p>
                <p>{_t("encryption|setup_secure_backup|explainer")}</p>
            </div>
        );

        let setupButtonCaption;
        if (this.state.backupStatus === BackupStatus.SERVER_BACKUP_BUT_DISABLED) {
            setupButtonCaption = _t("settings|security|key_backup_connect");
        } else {
            // if there's an error fetching the backup info, we'll just assume there's
            // no backup for the purpose of the button caption
            setupButtonCaption = _t("auth|logout_dialog|use_key_backup");
        }

        const dialogContent = (
            <div>
                <div className="mx_Dialog_content" id="mx_Dialog_content">
                    {description}
                </div>
                <DialogButtons
                    primaryButton={setupButtonCaption}
                    hasCancel={false}
                    onPrimaryButtonClick={this.onSetRecoveryMethodClick}
                    focus={true}
                >
                    <button onClick={this.onLogoutConfirm}>{_t("auth|logout_dialog|skip_key_backup")}</button>
                </DialogButtons>
                <details>
                    <summary className="mx_LogoutDialog_ExportKeyAdvanced">{_t("common|advanced")}</summary>
                    <p>
                        <button onClick={this.onExportE2eKeysClicked}>{_t("auth|logout_dialog|megolm_export")}</button>
                    </p>
                </details>
            </div>
        );
        // Not quite a standard question dialog as the primary button cancels
        // the action and does something else instead, whilst non-default button
        // confirms the action.
        return (
            <BaseDialog
                title={_t("auth|logout_dialog|setup_key_backup_title")}
                contentId="mx_Dialog_content"
                hasCancel={true}
                onFinished={this.onFinished}
            >
                {dialogContent}
            </BaseDialog>
        );
    }

    public render(): React.ReactNode {
        switch (this.state.backupStatus) {
            case BackupStatus.LOADING:
                // while we're deciding if we have backups, show a spinner
                return (
                    <BaseDialog
                        title={_t("action|sign_out")}
                        contentId="mx_Dialog_content"
                        hasCancel={true}
                        onFinished={this.onFinished}
                    >
                        <Spinner />
                    </BaseDialog>
                );

            case BackupStatus.NO_CRYPTO:
            case BackupStatus.BACKUP_ACTIVE:
                return (
                    <QuestionDialog
                        hasCancelButton={true}
                        title={_t("action|sign_out")}
                        description={_t("auth|logout_dialog|description")}
                        button={_t("action|sign_out")}
                        onFinished={this.onFinished}
                    />
                );

            case BackupStatus.NO_BACKUP:
            case BackupStatus.SERVER_BACKUP_BUT_DISABLED:
            case BackupStatus.ERROR:
            case BackupStatus.BACKUP_NO_RECOVERY:
                return this.renderSetupRecoveryMethod();
        }
    }
}
