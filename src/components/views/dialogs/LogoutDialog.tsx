/*
Copyright 2018, 2019 New Vector Ltd
Copyright 2020 - 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { IKeyBackupInfo } from "matrix-js-sdk/src/crypto/keybackup";
import { logger } from "matrix-js-sdk/src/logger";

import type CreateKeyBackupDialog from "../../../async-components/views/dialogs/security/CreateKeyBackupDialog";
import type ExportE2eKeysDialog from "../../../async-components/views/dialogs/security/ExportE2eKeysDialog";
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

interface IState {
    shouldLoadBackupStatus: boolean;
    loading: boolean;
    backupInfo: IKeyBackupInfo | null;
    error?: string;
}

export default class LogoutDialog extends React.Component<IProps, IState> {
    public static defaultProps = {
        onFinished: function () {},
    };

    public constructor(props: IProps) {
        super(props);

        const cli = MatrixClientPeg.get();
        const shouldLoadBackupStatus = cli.isCryptoEnabled() && !cli.getKeyBackupEnabled();

        this.state = {
            shouldLoadBackupStatus: shouldLoadBackupStatus,
            loading: shouldLoadBackupStatus,
            backupInfo: null,
        };

        if (shouldLoadBackupStatus) {
            this.loadBackupStatus();
        }
    }

    private async loadBackupStatus(): Promise<void> {
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            this.setState({
                loading: false,
                backupInfo,
            });
        } catch (e) {
            logger.log("Unable to fetch key backup status", e);
            this.setState({
                loading: false,
                error: e,
            });
        }
    }

    private onExportE2eKeysClicked = (): void => {
        Modal.createDialogAsync(
            import("../../../async-components/views/dialogs/security/ExportE2eKeysDialog") as unknown as Promise<
                typeof ExportE2eKeysDialog
            >,
            {
                matrixClient: MatrixClientPeg.get(),
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
        if (this.state.backupInfo) {
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
            Modal.createDialogAsync(
                import("../../../async-components/views/dialogs/security/CreateKeyBackupDialog") as unknown as Promise<
                    typeof CreateKeyBackupDialog
                >,
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

    public render(): React.ReactNode {
        if (this.state.shouldLoadBackupStatus) {
            const description = (
                <div>
                    <p>
                        {_t(
                            "Encrypted messages are secured with end-to-end encryption. " +
                                "Only you and the recipient(s) have the keys to read these messages.",
                        )}
                    </p>
                    <p>
                        {_t(
                            "When you sign out, these keys will be deleted from this device, " +
                                "which means you won't be able to read encrypted messages unless you " +
                                "have the keys for them on your other devices, or backed them up to the " +
                                "server.",
                        )}
                    </p>
                    <p>{_t("Back up your keys before signing out to avoid losing them.")}</p>
                </div>
            );

            let dialogContent;
            if (this.state.loading) {
                dialogContent = <Spinner />;
            } else {
                let setupButtonCaption;
                if (this.state.backupInfo) {
                    setupButtonCaption = _t("Connect this session to Key Backup");
                } else {
                    // if there's an error fetching the backup info, we'll just assume there's
                    // no backup for the purpose of the button caption
                    setupButtonCaption = _t("Start using Key Backup");
                }

                dialogContent = (
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
                            <button onClick={this.onLogoutConfirm}>{_t("I don't want my encrypted messages")}</button>
                        </DialogButtons>
                        <details>
                            <summary>{_t("Advanced")}</summary>
                            <p>
                                <button onClick={this.onExportE2eKeysClicked}>{_t("Manually export keys")}</button>
                            </p>
                        </details>
                    </div>
                );
            }
            // Not quite a standard question dialog as the primary button cancels
            // the action and does something else instead, whilst non-default button
            // confirms the action.
            return (
                <BaseDialog
                    title={_t("You'll lose access to your encrypted messages")}
                    contentId="mx_Dialog_content"
                    hasCancel={true}
                    onFinished={this.onFinished}
                >
                    {dialogContent}
                </BaseDialog>
            );
        } else {
            return (
                <QuestionDialog
                    hasCancelButton={true}
                    title={_t("Sign out")}
                    description={_t("Are you sure you want to sign out?")}
                    button={_t("Sign out")}
                    onFinished={this.onFinished}
                />
            );
        }
    }
}
