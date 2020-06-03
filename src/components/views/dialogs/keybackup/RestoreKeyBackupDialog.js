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

import React from 'react';
import PropTypes from 'prop-types';
import * as sdk from '../../../../index';
import {MatrixClientPeg} from '../../../../MatrixClientPeg';
import { MatrixClient } from 'matrix-js-sdk';
import { _t } from '../../../../languageHandler';
import { accessSecretStorage } from '../../../../CrossSigningManager';

const RESTORE_TYPE_PASSPHRASE = 0;
const RESTORE_TYPE_RECOVERYKEY = 1;
const RESTORE_TYPE_SECRET_STORAGE = 2;

/*
 * Dialog for restoring e2e keys from a backup and the user's recovery key
 */
export default class RestoreKeyBackupDialog extends React.PureComponent {
    static propTypes = {
        // if false, will close the dialog as soon as the restore completes succesfully
        // default: true
        showSummary: PropTypes.bool,
        // If specified, gather the key from the user but then call the function with the backup
        // key rather than actually (necessarily) restoring the backup.
        keyCallback: PropTypes.func,
    };

    static defaultProps = {
        showSummary: true,
    };

    constructor(props) {
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
            passPhrase: '',
            restoreType: null,
            progress: { stage: "prefetch" },
        };
    }

    componentDidMount() {
        this._loadBackupStatus();
    }

    _onCancel = () => {
        this.props.onFinished(false);
    }

    _onDone = () => {
        this.props.onFinished(true);
    }

    _onUseRecoveryKeyClick = () => {
        this.setState({
            forceRecoveryKey: true,
        });
    }

    _progressCallback = (data) => {
        this.setState({
            progress: data,
        });
    }

    _onResetRecoveryClick = () => {
        this.props.onFinished(false);
        accessSecretStorage(() => {}, /* forceReset = */ true);
    }

    _onRecoveryKeyChange = (e) => {
        this.setState({
            recoveryKey: e.target.value,
            recoveryKeyValid: MatrixClientPeg.get().isValidRecoveryKey(e.target.value),
        });
    }

    _onPassPhraseNext = async () => {
        this.setState({
            loading: true,
            restoreError: null,
            restoreType: RESTORE_TYPE_PASSPHRASE,
        });
        try {
            // We do still restore the key backup: we must ensure that the key backup key
            // is the right one and restoring it is currently the only way we can do this.
            const recoverInfo = await MatrixClientPeg.get().restoreKeyBackupWithPassword(
                this.state.passPhrase, undefined, undefined, this.state.backupInfo,
                { progressCallback: this._progressCallback },
            );
            if (this.props.keyCallback) {
                const key = await MatrixClientPeg.get().keyBackupKeyFromPassword(
                    this.state.passPhrase, this.state.backupInfo,
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
            console.log("Error restoring backup", e);
            this.setState({
                loading: false,
                restoreError: e,
            });
        }
    }

    _onRecoveryKeyNext = async () => {
        if (!this.state.recoveryKeyValid) return;

        this.setState({
            loading: true,
            restoreError: null,
            restoreType: RESTORE_TYPE_RECOVERYKEY,
        });
        try {
            const recoverInfo = await MatrixClientPeg.get().restoreKeyBackupWithRecoveryKey(
                this.state.recoveryKey, undefined, undefined, this.state.backupInfo,
                { progressCallback: this._progressCallback },
            );
            if (this.props.keyCallback) {
                const key = MatrixClientPeg.get().keyBackupKeyFromRecoveryKey(this.state.recoveryKey);
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
            console.log("Error restoring backup", e);
            this.setState({
                loading: false,
                restoreError: e,
            });
        }
    }

    _onPassPhraseChange = (e) => {
        this.setState({
            passPhrase: e.target.value,
        });
    }

    async _restoreWithSecretStorage() {
        this.setState({
            loading: true,
            restoreError: null,
            restoreType: RESTORE_TYPE_SECRET_STORAGE,
        });
        try {
            // `accessSecretStorage` may prompt for storage access as needed.
            const recoverInfo = await accessSecretStorage(async () => {
                return MatrixClientPeg.get().restoreKeyBackupWithSecretStorage(
                    this.state.backupInfo, undefined, undefined,
                    { progressCallback: this._progressCallback },
                );
            });
            this.setState({
                loading: false,
                recoverInfo,
            });
        } catch (e) {
            console.log("Error restoring backup", e);
            this.setState({
                restoreError: e,
                loading: false,
            });
        }
    }

    async _restoreWithCachedKey(backupInfo) {
        if (!backupInfo) return false;
        try {
            const recoverInfo = await MatrixClientPeg.get().restoreKeyBackupWithCache(
                undefined, /* targetRoomId */
                undefined, /* targetSessionId */
                backupInfo,
                { progressCallback: this._progressCallback },
            );
            this.setState({
                recoverInfo,
            });
            return true;
        } catch (e) {
            console.log("restoreWithCachedKey failed:", e);
            return false;
        }
    }

    async _loadBackupStatus() {
        this.setState({
            loading: true,
            loadError: null,
        });
        try {
            const backupInfo = await MatrixClientPeg.get().getKeyBackupVersion();
            const backupKeyStored = await MatrixClientPeg.get().isKeyBackupKeyStored();
            this.setState({
                backupInfo,
                backupKeyStored,
            });

            const gotCache = await this._restoreWithCachedKey(backupInfo);
            if (gotCache) {
                console.log("RestoreKeyBackupDialog: found cached backup key");
                this.setState({
                    loading: false,
                });
                return;
            }

            // If the backup key is stored, we can proceed directly to restore.
            if (backupKeyStored) {
                return this._restoreWithSecretStorage();
            }

            this.setState({
                loadError: null,
                loading: false,
            });
        } catch (e) {
            console.log("Error loading backup status", e);
            this.setState({
                loadError: e,
                loading: false,
            });
        }
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const Spinner = sdk.getComponent("elements.Spinner");

        const backupHasPassphrase = (
            this.state.backupInfo &&
            this.state.backupInfo.auth_data &&
            this.state.backupInfo.auth_data.private_key_salt &&
            this.state.backupInfo.auth_data.private_key_iterations
        );

        let content;
        let title;
        if (this.state.loading) {
            title = _t("Restoring keys from backup");
            let details;
            if (this.state.progress.stage === "fetch") {
                details = _t("Fetching keys from server...");
            } else if (this.state.progress.stage === "load_keys") {
                const { total, successes, failures } = this.state.progress;
                details = _t("%(completed)s of %(total)s keys restored", { total, completed: successes + failures });
            } else if (this.state.progress.stage === "prefetch") {
                details = _t("Fetching keys from server...");
            }
            content = <div>
                <div>{details}</div>
                <Spinner />
            </div>;
        } else if (this.state.loadError) {
            title = _t("Error");
            content = _t("Unable to load backup status");
        } else if (this.state.restoreError) {
            if (this.state.restoreError.errcode === MatrixClient.RESTORE_BACKUP_ERROR_BAD_KEY) {
                if (this.state.restoreType === RESTORE_TYPE_RECOVERYKEY) {
                    title = _t("Recovery key mismatch");
                    content = <div>
                        <p>{_t(
                            "Backup could not be decrypted with this recovery key: " +
                            "please verify that you entered the correct recovery key.",
                        )}</p>
                    </div>;
                } else {
                    title = _t("Incorrect recovery passphrase");
                    content = <div>
                        <p>{_t(
                            "Backup could not be decrypted with this recovery passphrase: " +
                            "please verify that you entered the correct recovery passphrase.",
                        )}</p>
                    </div>;
                }
            } else {
                title = _t("Error");
                content = _t("Unable to restore backup");
            }
        } else if (this.state.backupInfo === null) {
            title = _t("Error");
            content = _t("No backup found!");
        } else if (this.state.recoverInfo) {
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            title = _t("Keys restored");
            let failedToDecrypt;
            if (this.state.recoverInfo.total > this.state.recoverInfo.imported) {
                failedToDecrypt = <p>{_t(
                    "Failed to decrypt %(failedCount)s sessions!",
                    {failedCount: this.state.recoverInfo.total - this.state.recoverInfo.imported},
                )}</p>;
            }
            content = <div>
                <p>{_t("Successfully restored %(sessionCount)s keys", {sessionCount: this.state.recoverInfo.imported})}</p>
                {failedToDecrypt}
                <DialogButtons primaryButton={_t('OK')}
                    onPrimaryButtonClick={this._onDone}
                    hasCancel={false}
                    focus={true}
                />
            </div>;
        } else if (backupHasPassphrase && !this.state.forceRecoveryKey) {
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
            title = _t("Enter recovery passphrase");
            content = <div>
                <p>{_t(
                    "<b>Warning</b>: you should only set up key backup " +
                    "from a trusted computer.", {},
                    { b: sub => <b>{sub}</b> },
                )}</p>
                <p>{_t(
                    "Access your secure message history and set up secure " +
                    "messaging by entering your recovery passphrase.",
                )}</p>

                <form className="mx_RestoreKeyBackupDialog_primaryContainer">
                    <input type="password"
                        className="mx_RestoreKeyBackupDialog_passPhraseInput"
                        onChange={this._onPassPhraseChange}
                        value={this.state.passPhrase}
                        autoFocus={true}
                    />
                    <DialogButtons
                        primaryButton={_t('Next')}
                        onPrimaryButtonClick={this._onPassPhraseNext}
                        primaryIsSubmit={true}
                        hasCancel={true}
                        onCancel={this._onCancel}
                        focus={false}
                    />
                </form>
                {_t(
                    "If you've forgotten your recovery passphrase you can "+
                    "<button1>use your recovery key</button1> or " +
                    "<button2>set up new recovery options</button2>"
                , {}, {
                    button1: s => <AccessibleButton className="mx_linkButton"
                        element="span"
                        onClick={this._onUseRecoveryKeyClick}
                    >
                        {s}
                    </AccessibleButton>,
                    button2: s => <AccessibleButton className="mx_linkButton"
                        element="span"
                        onClick={this._onResetRecoveryClick}
                    >
                        {s}
                    </AccessibleButton>,
                })}
            </div>;
        } else {
            title = _t("Enter recovery key");
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

            let keyStatus;
            if (this.state.recoveryKey.length === 0) {
                keyStatus = <div className="mx_RestoreKeyBackupDialog_keyStatus"></div>;
            } else if (this.state.recoveryKeyValid) {
                keyStatus = <div className="mx_RestoreKeyBackupDialog_keyStatus">
                    {"\uD83D\uDC4D "}{_t("This looks like a valid recovery key!")}
                </div>;
            } else {
                keyStatus = <div className="mx_RestoreKeyBackupDialog_keyStatus">
                    {"\uD83D\uDC4E "}{_t("Not a valid recovery key")}
                </div>;
            }

            content = <div>
                <p>{_t(
                    "<b>Warning</b>: You should only set up key backup " +
                    "from a trusted computer.", {},
                    { b: sub => <b>{sub}</b> },
                )}</p>
                <p>{_t(
                    "Access your secure message history and set up secure " +
                    "messaging by entering your recovery key.",
                )}</p>

                <div className="mx_RestoreKeyBackupDialog_primaryContainer">
                    <input className="mx_RestoreKeyBackupDialog_recoveryKeyInput"
                        onChange={this._onRecoveryKeyChange}
                        value={this.state.recoveryKey}
                        autoFocus={true}
                    />
                    {keyStatus}
                    <DialogButtons primaryButton={_t('Next')}
                        onPrimaryButtonClick={this._onRecoveryKeyNext}
                        hasCancel={true}
                        onCancel={this._onCancel}
                        focus={false}
                        primaryDisabled={!this.state.recoveryKeyValid}
                    />
                </div>
                {_t(
                    "If you've forgotten your recovery key you can "+
                    "<button>set up new recovery options</button>"
                , {}, {
                    button: s => <AccessibleButton className="mx_linkButton"
                        element="span"
                        onClick={this._onResetRecoveryClick}
                    >
                        {s}
                    </AccessibleButton>,
                })}
            </div>;
        }

        return (
            <BaseDialog className='mx_RestoreKeyBackupDialog'
                onFinished={this.props.onFinished}
                title={title}
            >
            <div className='mx_RestoreKeyBackupDialog_content'>
                {content}
            </div>
            </BaseDialog>
        );
    }
}
