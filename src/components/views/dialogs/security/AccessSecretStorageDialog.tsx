/*
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

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

import {debounce} from "lodash";
import classNames from 'classnames';
import React, {ChangeEvent, FormEvent} from 'react';
import {ISecretStorageKeyInfo} from "matrix-js-sdk/src";

import * as sdk from '../../../../index';
import {MatrixClientPeg} from '../../../../MatrixClientPeg';
import Field from '../../elements/Field';
import AccessibleButton from '../../elements/AccessibleButton';
import {_t} from '../../../../languageHandler';
import {IDialogProps} from "../IDialogProps";

// Maximum acceptable size of a key file. It's 59 characters including the spaces we encode,
// so this should be plenty and allow for people putting extra whitespace in the file because
// maybe that's a thing people would do?
const KEY_FILE_MAX_SIZE = 128;

// Don't shout at the user that their key is invalid every time they type a key: wait a short time
const VALIDATION_THROTTLE_MS = 200;

interface IProps extends IDialogProps {
    keyInfo: ISecretStorageKeyInfo;
    checkPrivateKey: (k: {passphrase?: string, recoveryKey?: string}) => boolean;
}

interface IState {
    recoveryKey: string;
    recoveryKeyValid: boolean | null;
    recoveryKeyCorrect: boolean | null;
    recoveryKeyFileError: boolean | null;
    forceRecoveryKey: boolean;
    passPhrase: string;
    keyMatches: boolean | null;
}

/*
 * Access Secure Secret Storage by requesting the user's passphrase.
 */
export default class AccessSecretStorageDialog extends React.PureComponent<IProps, IState> {
    private fileUpload = React.createRef<HTMLInputElement>();

    constructor(props) {
        super(props);

        this.state = {
            recoveryKey: "",
            recoveryKeyValid: null,
            recoveryKeyCorrect: null,
            recoveryKeyFileError: null,
            forceRecoveryKey: false,
            passPhrase: '',
            keyMatches: null,
        };
    }

    private onCancel = () => {
        this.props.onFinished(false);
    };

    private onUseRecoveryKeyClick = () => {
        this.setState({
            forceRecoveryKey: true,
        });
    };

    private validateRecoveryKeyOnChange = debounce(async () => {
        await this.validateRecoveryKey();
    }, VALIDATION_THROTTLE_MS);

    private async validateRecoveryKey() {
        if (this.state.recoveryKey === '') {
            this.setState({
                recoveryKeyValid: null,
                recoveryKeyCorrect: null,
            });
            return;
        }

        try {
            const cli = MatrixClientPeg.get();
            const decodedKey = cli.keyBackupKeyFromRecoveryKey(this.state.recoveryKey);
            const correct = await cli.checkSecretStorageKey(
                decodedKey, this.props.keyInfo,
            );
            this.setState({
                recoveryKeyValid: true,
                recoveryKeyCorrect: correct,
            });
        } catch (e) {
            this.setState({
                recoveryKeyValid: false,
                recoveryKeyCorrect: false,
            });
        }
    }

    private onRecoveryKeyChange = (ev: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            recoveryKey: ev.target.value,
            recoveryKeyFileError: null,
        });

        // also clear the file upload control so that the user can upload the same file
        // the did before (otherwise the onchange wouldn't fire)
        if (this.fileUpload.current) this.fileUpload.current.value = null;

        // We don't use Field's validation here because a) we want it in a separate place rather
        // than in a tooltip and b) we want it to display feedback based on the uploaded file
        // as well as the text box. Ideally we would refactor Field's validation logic so we could
        // re-use some of it.
        this.validateRecoveryKeyOnChange();
    };

    private onRecoveryKeyFileChange = async (ev: ChangeEvent<HTMLInputElement>) => {
        if (ev.target.files.length === 0) return;

        const f = ev.target.files[0];

        if (f.size > KEY_FILE_MAX_SIZE) {
            this.setState({
                recoveryKeyFileError: true,
                recoveryKeyCorrect: false,
                recoveryKeyValid: false,
            });
        } else {
            const contents = await f.text();
            // test it's within the base58 alphabet. We could be more strict here, eg. require the
            // right number of characters, but it's really just to make sure that what we're reading is
            // text because we'll put it in the text field.
            if (/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz\s]+$/.test(contents)) {
                this.setState({
                    recoveryKeyFileError: null,
                    recoveryKey: contents.trim(),
                });
                await this.validateRecoveryKey();
            } else {
                this.setState({
                    recoveryKeyFileError: true,
                    recoveryKeyCorrect: false,
                    recoveryKeyValid: false,
                    recoveryKey: '',
                });
            }
        }
    };

    private onRecoveryKeyFileUploadClick = () => {
        this.fileUpload.current.click();
    }

    private onPassPhraseNext = async (ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault();

        if (this.state.passPhrase.length <= 0) return;

        this.setState({ keyMatches: null });
        const input = { passphrase: this.state.passPhrase };
        const keyMatches = await this.props.checkPrivateKey(input);
        if (keyMatches) {
            this.props.onFinished(input);
        } else {
            this.setState({ keyMatches });
        }
    };

    private onRecoveryKeyNext = async (ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault();

        if (!this.state.recoveryKeyValid) return;

        this.setState({ keyMatches: null });
        const input = { recoveryKey: this.state.recoveryKey };
        const keyMatches = await this.props.checkPrivateKey(input);
        if (keyMatches) {
            this.props.onFinished(input);
        } else {
            this.setState({ keyMatches });
        }
    };

    private onPassPhraseChange = (ev: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            passPhrase: ev.target.value,
            keyMatches: null,
        });
    };

    private getKeyValidationText(): string {
        if (this.state.recoveryKeyFileError) {
            return _t("Wrong file type");
        } else if (this.state.recoveryKeyCorrect) {
            return _t("Looks good!");
        } else if (this.state.recoveryKeyValid) {
            return _t("Wrong Security Key");
        } else if (this.state.recoveryKeyValid === null) {
            return '';
        } else {
            return _t("Invalid Security Key");
        }
    }

    render() {
        // Caution: Making this an import will break tests.
        const BaseDialog = sdk.getComponent("views.dialogs.BaseDialog");

        const hasPassphrase = (
            this.props.keyInfo &&
            this.props.keyInfo.passphrase &&
            this.props.keyInfo.passphrase.salt &&
            this.props.keyInfo.passphrase.iterations
        );

        let content;
        let title;
        let titleClass;
        if (hasPassphrase && !this.state.forceRecoveryKey) {
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
            title = _t("Security Phrase");
            titleClass = ['mx_AccessSecretStorageDialog_titleWithIcon mx_AccessSecretStorageDialog_securePhraseTitle'];

            let keyStatus;
            if (this.state.keyMatches === false) {
                keyStatus = <div className="mx_AccessSecretStorageDialog_keyStatus">
                    {"\uD83D\uDC4E "}{_t(
                        "Unable to access secret storage. " +
                        "Please verify that you entered the correct Security Phrase.",
                    )}
                </div>;
            } else {
                keyStatus = <div className="mx_AccessSecretStorageDialog_keyStatus" />;
            }

            content = <div>
                <p>{_t(
                    "Enter your Security Phrase or <button>Use your Security Key</button> to continue.", {},
                    {
                        button: s => <AccessibleButton className="mx_linkButton"
                            element="span"
                            onClick={this.onUseRecoveryKeyClick}
                        >
                            {s}
                        </AccessibleButton>,
                    },
                )}</p>

                <form className="mx_AccessSecretStorageDialog_primaryContainer" onSubmit={this.onPassPhraseNext}>
                    <input
                        type="password"
                        className="mx_AccessSecretStorageDialog_passPhraseInput"
                        onChange={this.onPassPhraseChange}
                        value={this.state.passPhrase}
                        autoFocus={true}
                        autoComplete="new-password"
                        placeholder={_t("Security Phrase")}
                    />
                    {keyStatus}
                    <DialogButtons
                        primaryButton={_t('Continue')}
                        onPrimaryButtonClick={this.onPassPhraseNext}
                        hasCancel={true}
                        onCancel={this.onCancel}
                        focus={false}
                        primaryDisabled={this.state.passPhrase.length === 0}
                    />
                </form>
            </div>;
        } else {
            title = _t("Security Key");
            titleClass = ['mx_AccessSecretStorageDialog_titleWithIcon mx_AccessSecretStorageDialog_secureBackupTitle'];
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

            const feedbackClasses = classNames({
                'mx_AccessSecretStorageDialog_recoveryKeyFeedback': true,
                'mx_AccessSecretStorageDialog_recoveryKeyFeedback_valid': this.state.recoveryKeyCorrect === true,
                'mx_AccessSecretStorageDialog_recoveryKeyFeedback_invalid': this.state.recoveryKeyCorrect === false,
            });
            const recoveryKeyFeedback = <div className={feedbackClasses}>
                {this.getKeyValidationText()}
            </div>;

            content = <div>
                <p>{_t("Use your Security Key to continue.")}</p>

                <form
                    className="mx_AccessSecretStorageDialog_primaryContainer"
                    onSubmit={this.onRecoveryKeyNext}
                    spellCheck={false}
                    autoComplete="off"
                >
                    <div className="mx_AccessSecretStorageDialog_recoveryKeyEntry">
                        <div className="mx_AccessSecretStorageDialog_recoveryKeyEntry_textInput">
                            <Field
                                type="password"
                                label={_t('Security Key')}
                                value={this.state.recoveryKey}
                                onChange={this.onRecoveryKeyChange}
                                forceValidity={this.state.recoveryKeyCorrect}
                                autoComplete="off"
                            />
                        </div>
                        <span className="mx_AccessSecretStorageDialog_recoveryKeyEntry_entryControlSeparatorText">
                            {_t("or")}
                        </span>
                        <div>
                            <input type="file"
                                className="mx_AccessSecretStorageDialog_recoveryKeyEntry_fileInput"
                                ref={this.fileUpload}
                                onChange={this.onRecoveryKeyFileChange}
                            />
                            <AccessibleButton kind="primary" onClick={this.onRecoveryKeyFileUploadClick}>
                                {_t("Upload")}
                            </AccessibleButton>
                        </div>
                    </div>
                    {recoveryKeyFeedback}
                    <DialogButtons
                        primaryButton={_t('Continue')}
                        onPrimaryButtonClick={this.onRecoveryKeyNext}
                        hasCancel={true}
                        cancelButton={_t("Go Back")}
                        cancelButtonClass='danger'
                        onCancel={this.onCancel}
                        focus={false}
                        primaryDisabled={!this.state.recoveryKeyValid}
                    />
                </form>
            </div>;
        }

        return (
            <BaseDialog className='mx_AccessSecretStorageDialog'
                onFinished={this.props.onFinished}
                title={title}
                titleClass={titleClass}
            >
                <div>
                    {content}
                </div>
            </BaseDialog>
        );
    }
}
