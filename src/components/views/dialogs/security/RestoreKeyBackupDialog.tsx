/*
Copyright 2018, 2019 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent } from "react";
import { MatrixClient, MatrixError, SecretStorage } from "matrix-js-sdk/src/matrix";
import { IKeyBackupInfo, IKeyBackupRestoreResult } from "matrix-js-sdk/src/crypto/keybackup";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { _t } from "../../../../languageHandler";
import { accessSecretStorage } from "../../../../SecurityManager";
import Spinner from "../../elements/Spinner";
import DialogButtons from "../../elements/DialogButtons";
import AccessibleButton from "../../elements/AccessibleButton";
import BaseDialog from "../BaseDialog";

enum RestoreType {
    Passphrase = "passphrase",
    RecoveryKey = "recovery_key",
    SecretStorage = "secret_storage",
}

enum ProgressState {
    PreFetch = "prefetch",
    Fetch = "fetch",
    LoadKeys = "load_keys",
}

interface IProps {
    // if false, will close the dialog as soon as the restore completes successfully
    // default: true
    showSummary?: boolean;
    // If specified, gather the key from the user but then call the function with the backup
    // key rather than actually (necessarily) restoring the backup.
    keyCallback?: (key: Uint8Array) => void;
    onFinished(done?: boolean): void;
}

interface IState {
    backupInfo: IKeyBackupInfo | null;
    backupKeyStored: Record<string, SecretStorage.SecretStorageKeyDescription> | null;
    loading: boolean;
    loadError: boolean | null;
    restoreError: unknown | null;
    recoveryKey: string;
    recoverInfo: IKeyBackupRestoreResult | null;
    recoveryKeyValid: boolean;
    forceRecoveryKey: boolean;
    passPhrase: string;
    restoreType: RestoreType | null;
    progress: {
        stage: ProgressState | string;
        total?: number;
        successes?: number;
        failures?: number;
    };
}

/*
 * Dialog for restoring e2e keys from a backup and the user's recovery key
 */
export default class RestoreKeyBackupDialog extends React.PureComponent<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        showSummary: true,
    };

    public constructor(props: IProps) {
        super(props);
        this.state = {
            backupInfo: null,
            backupKeyStored: null,
            loading: false,
            loadError: null,
            restoreError: null,
            recoveryKey: "",
            recoverInfo: null,
            recoveryKeyValid: false,
            forceRecoveryKey: false,
            passPhrase: "",
            restoreType: null,
            progress: { stage: ProgressState.PreFetch },
        };
    }

    public componentDidMount(): void {
        this.loadBackupStatus();
    }

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private onDone = (): void => {
        this.props.onFinished(true);
    };

    private onUseRecoveryKeyClick = (): void => {
        this.setState({
            forceRecoveryKey: true,
        });
    };

    private progressCallback = (data: IState["progress"]): void => {
        this.setState({
            progress: data,
        });
    };

    private onResetRecoveryClick = (): void => {
        this.props.onFinished(false);
        accessSecretStorage(async (): Promise<void> => {}, /* forceReset = */ true);
    };

    private onRecoveryKeyChange = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            recoveryKey: e.target.value,
            recoveryKeyValid: MatrixClientPeg.safeGet().isValidRecoveryKey(e.target.value),
        });
    };

    private onPassPhraseNext = async (): Promise<void> => {
        if (!this.state.backupInfo) return;
        this.setState({
            loading: true,
            restoreError: null,
            restoreType: RestoreType.Passphrase,
        });
        try {
            // We do still restore the key backup: we must ensure that the key backup key
            // is the right one and restoring it is currently the only way we can do this.
            const recoverInfo = await MatrixClientPeg.safeGet().restoreKeyBackupWithPassword(
                this.state.passPhrase,
                undefined,
                undefined,
                this.state.backupInfo,
                { progressCallback: this.progressCallback },
            );
            if (this.props.keyCallback) {
                const key = await MatrixClientPeg.safeGet().keyBackupKeyFromPassword(
                    this.state.passPhrase,
                    this.state.backupInfo,
                );
                this.props.keyCallback(key);
            }

            if (!this.props.showSummary) {
                this.props.onFinished(true);
                return;
            }
            this.setState({
                loading: false,
                recoverInfo,
            });
        } catch (e) {
            logger.log("Error restoring backup", e);
            this.setState({
                loading: false,
                restoreError: e,
            });
        }
    };

    private onRecoveryKeyNext = async (): Promise<void> => {
        if (!this.state.recoveryKeyValid || !this.state.backupInfo) return;

        this.setState({
            loading: true,
            restoreError: null,
            restoreType: RestoreType.RecoveryKey,
        });
        try {
            const recoverInfo = await MatrixClientPeg.safeGet().restoreKeyBackupWithRecoveryKey(
                this.state.recoveryKey,
                undefined,
                undefined,
                this.state.backupInfo,
                { progressCallback: this.progressCallback },
            );
            if (this.props.keyCallback) {
                const key = MatrixClientPeg.safeGet().keyBackupKeyFromRecoveryKey(this.state.recoveryKey);
                this.props.keyCallback(key);
            }
            if (!this.props.showSummary) {
                this.props.onFinished(true);
                return;
            }
            this.setState({
                loading: false,
                recoverInfo,
            });
        } catch (e) {
            logger.log("Error restoring backup", e);
            this.setState({
                loading: false,
                restoreError: e,
            });
        }
    };

    private onPassPhraseChange = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            passPhrase: e.target.value,
        });
    };

    private async restoreWithSecretStorage(): Promise<void> {
        this.setState({
            loading: true,
            restoreError: null,
            restoreType: RestoreType.SecretStorage,
        });
        try {
            // `accessSecretStorage` may prompt for storage access as needed.
            await accessSecretStorage(async (): Promise<void> => {
                if (!this.state.backupInfo) return;
                await MatrixClientPeg.safeGet().restoreKeyBackupWithSecretStorage(
                    this.state.backupInfo,
                    undefined,
                    undefined,
                    { progressCallback: this.progressCallback },
                );
            });
            this.setState({
                loading: false,
            });
        } catch (e) {
            logger.log("Error restoring backup", e);
            this.setState({
                restoreError: e,
                loading: false,
            });
        }
    }

    private async restoreWithCachedKey(backupInfo: IKeyBackupInfo | null): Promise<boolean> {
        if (!backupInfo) return false;
        try {
            const recoverInfo = await MatrixClientPeg.safeGet().restoreKeyBackupWithCache(
                undefined /* targetRoomId */,
                undefined /* targetSessionId */,
                backupInfo,
                { progressCallback: this.progressCallback },
            );
            this.setState({
                recoverInfo,
            });
            return true;
        } catch (e) {
            logger.log("restoreWithCachedKey failed:", e);
            return false;
        }
    }

    private async loadBackupStatus(): Promise<void> {
        this.setState({
            loading: true,
            loadError: null,
        });
        try {
            const cli = MatrixClientPeg.safeGet();
            const backupInfo = await cli.getKeyBackupVersion();
            const has4S = await cli.hasSecretStorageKey();
            const backupKeyStored = has4S ? await cli.isKeyBackupKeyStored() : null;
            this.setState({
                backupInfo,
                backupKeyStored,
            });

            const gotCache = await this.restoreWithCachedKey(backupInfo);
            if (gotCache) {
                logger.log("RestoreKeyBackupDialog: found cached backup key");
                this.setState({
                    loading: false,
                });
                return;
            }

            // If the backup key is stored, we can proceed directly to restore.
            if (backupKeyStored) {
                return this.restoreWithSecretStorage();
            }

            this.setState({
                loadError: null,
                loading: false,
            });
        } catch (e) {
            logger.log("Error loading backup status", e);
            this.setState({
                loadError: true,
                loading: false,
            });
        }
    }

    public render(): React.ReactNode {
        const backupHasPassphrase =
            this.state.backupInfo &&
            this.state.backupInfo.auth_data &&
            this.state.backupInfo.auth_data.private_key_salt &&
            this.state.backupInfo.auth_data.private_key_iterations;

        let content;
        let title;
        if (this.state.loading) {
            title = _t("encryption|access_secret_storage_dialog|restoring");
            let details;
            if (this.state.progress.stage === ProgressState.Fetch) {
                details = _t("restore_key_backup_dialog|key_fetch_in_progress");
            } else if (this.state.progress.stage === ProgressState.LoadKeys) {
                const { total, successes, failures } = this.state.progress;
                details = _t("restore_key_backup_dialog|load_keys_progress", {
                    total,
                    completed: (successes ?? 0) + (failures ?? 0),
                });
            } else if (this.state.progress.stage === ProgressState.PreFetch) {
                details = _t("restore_key_backup_dialog|key_fetch_in_progress");
            }
            content = (
                <div>
                    <div>{details}</div>
                    <Spinner />
                </div>
            );
        } else if (this.state.loadError) {
            title = _t("common|error");
            content = _t("restore_key_backup_dialog|load_error_content");
        } else if (this.state.restoreError) {
            if (
                this.state.restoreError instanceof MatrixError &&
                this.state.restoreError.errcode === MatrixClient.RESTORE_BACKUP_ERROR_BAD_KEY
            ) {
                if (this.state.restoreType === RestoreType.RecoveryKey) {
                    title = _t("restore_key_backup_dialog|recovery_key_mismatch_title");
                    content = (
                        <div>
                            <p>{_t("restore_key_backup_dialog|recovery_key_mismatch_description")}</p>
                        </div>
                    );
                } else {
                    title = _t("restore_key_backup_dialog|incorrect_security_phrase_title");
                    content = (
                        <div>
                            <p>{_t("restore_key_backup_dialog|incorrect_security_phrase_dialog")}</p>
                        </div>
                    );
                }
            } else {
                title = _t("common|error");
                content = _t("restore_key_backup_dialog|restore_failed_error");
            }
        } else if (this.state.backupInfo === null) {
            title = _t("common|error");
            content = _t("restore_key_backup_dialog|no_backup_error");
        } else if (this.state.recoverInfo) {
            title = _t("restore_key_backup_dialog|keys_restored_title");
            let failedToDecrypt;
            if (this.state.recoverInfo.total > this.state.recoverInfo.imported) {
                failedToDecrypt = (
                    <p>
                        {_t("restore_key_backup_dialog|count_of_decryption_failures", {
                            failedCount: this.state.recoverInfo.total - this.state.recoverInfo.imported,
                        })}
                    </p>
                );
            }
            content = (
                <div>
                    <p>
                        {_t("restore_key_backup_dialog|count_of_successfully_restored_keys", {
                            sessionCount: this.state.recoverInfo.imported,
                        })}
                    </p>
                    {failedToDecrypt}
                    <DialogButtons
                        primaryButton={_t("action|ok")}
                        onPrimaryButtonClick={this.onDone}
                        hasCancel={false}
                        focus={true}
                    />
                </div>
            );
        } else if (backupHasPassphrase && !this.state.forceRecoveryKey) {
            title = _t("restore_key_backup_dialog|enter_phrase_title");
            content = (
                <div>
                    <p>{_t("restore_key_backup_dialog|key_backup_warning", {}, { b: (sub) => <b>{sub}</b> })}</p>
                    <p>{_t("restore_key_backup_dialog|enter_phrase_description")}</p>

                    <form className="mx_RestoreKeyBackupDialog_primaryContainer">
                        <input
                            type="password"
                            className="mx_RestoreKeyBackupDialog_passPhraseInput"
                            onChange={this.onPassPhraseChange}
                            value={this.state.passPhrase}
                            autoFocus={true}
                        />
                        <DialogButtons
                            primaryButton={_t("action|next")}
                            onPrimaryButtonClick={this.onPassPhraseNext}
                            primaryIsSubmit={true}
                            hasCancel={true}
                            onCancel={this.onCancel}
                            focus={false}
                        />
                    </form>
                    {_t(
                        "restore_key_backup_dialog|phrase_forgotten_text",
                        {},
                        {
                            button1: (s) => (
                                <AccessibleButton kind="link_inline" onClick={this.onUseRecoveryKeyClick}>
                                    {s}
                                </AccessibleButton>
                            ),
                            button2: (s) => (
                                <AccessibleButton kind="link_inline" onClick={this.onResetRecoveryClick}>
                                    {s}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </div>
            );
        } else {
            title = _t("restore_key_backup_dialog|enter_key_title");

            let keyStatus;
            if (this.state.recoveryKey.length === 0) {
                keyStatus = <div className="mx_RestoreKeyBackupDialog_keyStatus" />;
            } else if (this.state.recoveryKeyValid) {
                keyStatus = (
                    <div className="mx_RestoreKeyBackupDialog_keyStatus">
                        {"\uD83D\uDC4D "}
                        {_t("restore_key_backup_dialog|key_is_valid")}
                    </div>
                );
            } else {
                keyStatus = (
                    <div className="mx_RestoreKeyBackupDialog_keyStatus">
                        {"\uD83D\uDC4E "}
                        {_t("restore_key_backup_dialog|key_is_invalid")}
                    </div>
                );
            }

            content = (
                <div>
                    <p>{_t("restore_key_backup_dialog|key_backup_warning", {}, { b: (sub) => <b>{sub}</b> })}</p>
                    <p>{_t("restore_key_backup_dialog|enter_key_description")}</p>

                    <div className="mx_RestoreKeyBackupDialog_primaryContainer">
                        <input
                            className="mx_RestoreKeyBackupDialog_recoveryKeyInput"
                            onChange={this.onRecoveryKeyChange}
                            value={this.state.recoveryKey}
                            autoFocus={true}
                        />
                        {keyStatus}
                        <DialogButtons
                            primaryButton={_t("action|next")}
                            onPrimaryButtonClick={this.onRecoveryKeyNext}
                            hasCancel={true}
                            onCancel={this.onCancel}
                            focus={false}
                            primaryDisabled={!this.state.recoveryKeyValid}
                        />
                    </div>
                    {_t(
                        "restore_key_backup_dialog|key_forgotten_text",
                        {},
                        {
                            button: (s) => (
                                <AccessibleButton kind="link_inline" onClick={this.onResetRecoveryClick}>
                                    {s}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </div>
            );
        }

        return (
            <BaseDialog className="mx_RestoreKeyBackupDialog" onFinished={this.props.onFinished} title={title}>
                <div className="mx_RestoreKeyBackupDialog_content">{content}</div>
            </BaseDialog>
        );
    }
}
