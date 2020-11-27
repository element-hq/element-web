/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018-2019 New Vector Ltd

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

import Field from "../elements/Field";
import React from 'react';
import PropTypes from 'prop-types';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import AccessibleButton from '../elements/AccessibleButton';
import Spinner from '../elements/Spinner';
import withValidation from '../elements/Validation';
import { _t } from '../../../languageHandler';
import * as sdk from "../../../index";
import Modal from "../../../Modal";
import PassphraseField from "../auth/PassphraseField";
import CountlyAnalytics from "../../../CountlyAnalytics";

const FIELD_OLD_PASSWORD = 'field_old_password';
const FIELD_NEW_PASSWORD = 'field_new_password';
const FIELD_NEW_PASSWORD_CONFIRM = 'field_new_password_confirm';

const PASSWORD_MIN_SCORE = 3; // safely unguessable: moderate protection from offline slow-hash scenario.

export default class ChangePassword extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func,
        onError: PropTypes.func,
        onCheckPassword: PropTypes.func,
        rowClassName: PropTypes.string,
        buttonClassName: PropTypes.string,
        buttonKind: PropTypes.string,
        buttonLabel: PropTypes.string,
        confirm: PropTypes.bool,
        // Whether to autoFocus the new password input
        autoFocusNewPasswordInput: PropTypes.bool,
    };

    static Phases = {
        Edit: "edit",
        Uploading: "uploading",
        Error: "error",
    };

    static defaultProps = {
        onFinished() {},
        onError() {},
        onCheckPassword(oldPass, newPass, confirmPass) {
            if (newPass !== confirmPass) {
                return {
                    error: _t("New passwords don't match"),
                };
            } else if (!newPass || newPass.length === 0) {
                return {
                    error: _t("Passwords can't be empty"),
                };
            }
        },
        confirm: true,
    }

    state = {
        fieldValid: {},
        phase: ChangePassword.Phases.Edit,
        oldPassword: "",
        newPassword: "",
        newPasswordConfirm: "",
    };

    changePassword(oldPassword, newPassword) {
        const cli = MatrixClientPeg.get();

        if (!this.props.confirm) {
            this._changePassword(cli, oldPassword, newPassword);
            return;
        }

        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createTrackedDialog('Change Password', '', QuestionDialog, {
            title: _t("Warning!"),
            description:
                <div>
                    { _t(
                        'Changing password will currently reset any end-to-end encryption keys on all sessions, ' +
                        'making encrypted chat history unreadable, unless you first export your room keys ' +
                        'and re-import them afterwards. ' +
                        'In future this will be improved.',
                    ) }
                    {' '}
                    <a href="https://github.com/vector-im/element-web/issues/2671" target="_blank" rel="noreferrer noopener">
                        https://github.com/vector-im/element-web/issues/2671
                    </a>
                </div>,
            button: _t("Continue"),
            extraButtons: [
                <button
                    key="exportRoomKeys"
                    className="mx_Dialog_primary"
                    onClick={this._onExportE2eKeysClicked}
                >
                    { _t('Export E2E room keys') }
                </button>,
            ],
            onFinished: (confirmed) => {
                if (confirmed) {
                    this._changePassword(cli, oldPassword, newPassword);
                }
            },
        });
    }

    _changePassword(cli, oldPassword, newPassword) {
        const authDict = {
            type: 'm.login.password',
            identifier: {
                type: 'm.id.user',
                user: cli.credentials.userId,
            },
            // TODO: Remove `user` once servers support proper UIA
            // See https://github.com/matrix-org/synapse/issues/5665
            user: cli.credentials.userId,
            password: oldPassword,
        };

        this.setState({
            phase: ChangePassword.Phases.Uploading,
        });

        cli.setPassword(authDict, newPassword).then(() => {
            if (this.props.shouldAskForEmail) {
                return this._optionallySetEmail().then((confirmed) => {
                    this.props.onFinished({
                        didSetEmail: confirmed,
                    });
                });
            } else {
                this.props.onFinished();
            }
        }, (err) => {
            this.props.onError(err);
        }).finally(() => {
            this.setState({
                phase: ChangePassword.Phases.Edit,
                oldPassword: "",
                newPassword: "",
                newPasswordConfirm: "",
            });
        });
    }

    _optionallySetEmail() {
        // Ask for an email otherwise the user has no way to reset their password
        const SetEmailDialog = sdk.getComponent("dialogs.SetEmailDialog");
        const modal = Modal.createTrackedDialog('Do you want to set an email address?', '', SetEmailDialog, {
            title: _t('Do you want to set an email address?'),
        });
        return modal.finished.then(([confirmed]) => confirmed);
    }

    _onExportE2eKeysClicked = () => {
        Modal.createTrackedDialogAsync('Export E2E Keys', 'Change Password',
            import('../../../async-components/views/dialogs/security/ExportE2eKeysDialog'),
            {
                matrixClient: MatrixClientPeg.get(),
            },
        );
    };

    markFieldValid(fieldID, valid) {
        const { fieldValid } = this.state;
        fieldValid[fieldID] = valid;
        this.setState({
            fieldValid,
        });
    }

    onChangeOldPassword = (ev) => {
        this.setState({
            oldPassword: ev.target.value,
        });
    };

    onOldPasswordValidate = async fieldState => {
        const result = await this.validateOldPasswordRules(fieldState);
        this.markFieldValid(FIELD_OLD_PASSWORD, result.valid);
        return result;
    };

    validateOldPasswordRules = withValidation({
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Passwords can't be empty"),
            },
         ],
    });

    onChangeNewPassword = (ev) => {
        this.setState({
            newPassword: ev.target.value,
        });
    };

    onNewPasswordValidate = result => {
        this.markFieldValid(FIELD_NEW_PASSWORD, result.valid);
    };

    onChangeNewPasswordConfirm = (ev) => {
        this.setState({
            newPasswordConfirm: ev.target.value,
        });
    };

    onNewPasswordConfirmValidate = async fieldState => {
        const result = await this.validatePasswordConfirmRules(fieldState);
        this.markFieldValid(FIELD_NEW_PASSWORD_CONFIRM, result.valid);
        return result;
    };

    validatePasswordConfirmRules = withValidation({
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Confirm password"),
            },
            {
                key: "match",
                test({ value }) {
                    return !value || value === this.state.newPassword;
                },
                invalid: () => _t("Passwords don't match"),
            },
         ],
    });

    onClickChange = async (ev) => {
        ev.preventDefault();

        const allFieldsValid = await this.verifyFieldsBeforeSubmit();
        if (!allFieldsValid) {
            CountlyAnalytics.instance.track("onboarding_registration_submit_failed");
            return;
        }

        const oldPassword = this.state.oldPassword;
        const newPassword = this.state.newPassword;
        const confirmPassword = this.state.newPasswordConfirm;
        const err = this.props.onCheckPassword(
            oldPassword, newPassword, confirmPassword,
        );
        if (err) {
            this.props.onError(err);
        } else {
            this.changePassword(oldPassword, newPassword);
        }
    };

    async verifyFieldsBeforeSubmit() {
        // Blur the active element if any, so we first run its blur validation,
        // which is less strict than the pass we're about to do below for all fields.
        const activeElement = document.activeElement;
        if (activeElement) {
            activeElement.blur();
        }

        const fieldIDsInDisplayOrder = [
            FIELD_OLD_PASSWORD,
            FIELD_NEW_PASSWORD,
            FIELD_NEW_PASSWORD_CONFIRM,
        ];

        // Run all fields with stricter validation that no longer allows empty
        // values for required fields.
        for (const fieldID of fieldIDsInDisplayOrder) {
            const field = this[fieldID];
            if (!field) {
                continue;
            }
            // We must wait for these validations to finish before queueing
            // up the setState below so our setState goes in the queue after
            // all the setStates from these validate calls (that's how we
            // know they've finished).
            await field.validate({ allowEmpty: false });
        }

        // Validation and state updates are async, so we need to wait for them to complete
        // first. Queue a `setState` callback and wait for it to resolve.
        await new Promise(resolve => this.setState({}, resolve));

        if (this.allFieldsValid()) {
            return true;
        }

        const invalidField = this.findFirstInvalidField(fieldIDsInDisplayOrder);

        if (!invalidField) {
            return true;
        }

        // Focus the first invalid field and show feedback in the stricter mode
        // that no longer allows empty values for required fields.
        invalidField.focus();
        invalidField.validate({ allowEmpty: false, focused: true });
        return false;
    }

    allFieldsValid() {
        const keys = Object.keys(this.state.fieldValid);
        for (let i = 0; i < keys.length; ++i) {
            if (!this.state.fieldValid[keys[i]]) {
                return false;
            }
        }
        return true;
    }

    findFirstInvalidField(fieldIDs) {
        for (const fieldID of fieldIDs) {
            if (!this.state.fieldValid[fieldID] && this[fieldID]) {
                return this[fieldID];
            }
        }
        return null;
    }

    render() {
        const rowClassName = this.props.rowClassName;
        const buttonClassName = this.props.buttonClassName;

        switch (this.state.phase) {
            case ChangePassword.Phases.Edit:
                return (
                    <form className={this.props.className} onSubmit={this.onClickChange}>
                        <div className={rowClassName}>
                            <Field
                                ref={field => this[FIELD_OLD_PASSWORD] = field}
                                type="password"
                                label={_t('Current password')}
                                value={this.state.oldPassword}
                                onChange={this.onChangeOldPassword}
                                onValidate={this.onOldPasswordValidate}
                            />
                        </div>
                        <div className={rowClassName}>
                            <PassphraseField
                                fieldRef={field => this[FIELD_NEW_PASSWORD] = field}
                                type="password"
                                label='New Password'
                                minScore={PASSWORD_MIN_SCORE}
                                value={this.state.newPassword}
                                autoFocus={this.props.autoFocusNewPasswordInput}
                                onChange={this.onChangeNewPassword}
                                onValidate={this.onNewPasswordValidate}
                                autoComplete="new-password"
                            />
                        </div>
                        <div className={rowClassName}>
                            <Field
                                ref={field => this[FIELD_NEW_PASSWORD_CONFIRM] = field}
                                type="password"
                                label={_t("Confirm password")}
                                value={this.state.newPasswordConfirm}
                                onChange={this.onChangeNewPasswordConfirm}
                                onValidate={this.onNewPasswordConfirmValidate}
                                autoComplete="new-password"
                            />
                        </div>
                        <AccessibleButton className={buttonClassName} kind={this.props.buttonKind} onClick={this.onClickChange}>
                            { this.props.buttonLabel || _t('Change Password') }
                        </AccessibleButton>
                    </form>
                );
            case ChangePassword.Phases.Uploading:
                return (
                    <div className="mx_Dialog_content">
                        <Spinner />
                    </div>
                );
        }
    }
}
