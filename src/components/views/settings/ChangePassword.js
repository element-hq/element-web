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
import createReactClass from 'create-react-class';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import AccessibleButton from '../elements/AccessibleButton';
import { _t } from '../../../languageHandler';
import * as sdk from "../../../index";
import Modal from "../../../Modal";

import sessionStore from '../../../stores/SessionStore';

export default createReactClass({
    displayName: 'ChangePassword',

    propTypes: {
        onFinished: PropTypes.func,
        onError: PropTypes.func,
        onCheckPassword: PropTypes.func,
        rowClassName: PropTypes.string,
        buttonClassName: PropTypes.string,
        buttonKind: PropTypes.string,
        confirm: PropTypes.bool,
        // Whether to autoFocus the new password input
        autoFocusNewPasswordInput: PropTypes.bool,
    },

    Phases: {
        Edit: "edit",
        Uploading: "uploading",
        Error: "error",
    },

    getDefaultProps: function() {
        return {
            onFinished: function() {},
            onError: function() {},
            onCheckPassword: function(oldPass, newPass, confirmPass) {
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
        };
    },

    getInitialState: function() {
        return {
            phase: this.Phases.Edit,
            cachedPassword: null,
            oldPassword: "",
            newPassword: "",
            newPasswordConfirm: "",
        };
    },

    componentDidMount: function() {
        this._sessionStore = sessionStore;
        this._sessionStoreToken = this._sessionStore.addListener(
            this._setStateFromSessionStore,
        );

        this._setStateFromSessionStore();
    },

    componentWillUnmount: function() {
        if (this._sessionStoreToken) {
            this._sessionStoreToken.remove();
        }
    },

    _setStateFromSessionStore: function() {
        this.setState({
            cachedPassword: this._sessionStore.getCachedPassword(),
        });
    },

    changePassword: function(oldPassword, newPassword) {
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
                <button className="mx_Dialog_primary"
                        onClick={this._onExportE2eKeysClicked}>
                    { _t('Export E2E room keys') }
                </button>,
            ],
            onFinished: (confirmed) => {
                if (confirmed) {
                    this._changePassword(cli, oldPassword, newPassword);
                }
            },
        });
    },

    _changePassword: function(cli, oldPassword, newPassword) {
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
            phase: this.Phases.Uploading,
        });

        cli.setPassword(authDict, newPassword).then(() => {
            // Notify SessionStore that the user's password was changed
            dis.dispatch({action: 'password_changed'});

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
                phase: this.Phases.Edit,
                oldPassword: "",
                newPassword: "",
                newPasswordConfirm: "",
            });
        });
    },

    _optionallySetEmail: function() {
        // Ask for an email otherwise the user has no way to reset their password
        const SetEmailDialog = sdk.getComponent("dialogs.SetEmailDialog");
        const modal = Modal.createTrackedDialog('Do you want to set an email address?', '', SetEmailDialog, {
            title: _t('Do you want to set an email address?'),
        });
        return modal.finished.then(([confirmed]) => confirmed);
    },

    _onExportE2eKeysClicked: function() {
        Modal.createTrackedDialogAsync('Export E2E Keys', 'Change Password',
            import('../../../async-components/views/dialogs/ExportE2eKeysDialog'),
            {
                matrixClient: MatrixClientPeg.get(),
            },
        );
    },

    onChangeOldPassword(ev) {
        this.setState({
            oldPassword: ev.target.value,
        });
    },

    onChangeNewPassword(ev) {
        this.setState({
            newPassword: ev.target.value,
        });
    },

    onChangeNewPasswordConfirm(ev) {
        this.setState({
            newPasswordConfirm: ev.target.value,
        });
    },

    onClickChange: function(ev) {
        ev.preventDefault();
        const oldPassword = this.state.cachedPassword || this.state.oldPassword;
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
    },

    render: function() {
        // TODO: Live validation on `new pw == confirm pw`

        const rowClassName = this.props.rowClassName;
        const buttonClassName = this.props.buttonClassName;

        let currentPassword = null;
        if (!this.state.cachedPassword) {
            currentPassword = (
                <div className={rowClassName}>
                    <Field
                        type="password"
                        label={_t('Current password')}
                        value={this.state.oldPassword}
                        onChange={this.onChangeOldPassword}
                    />
                </div>
            );
        }

        switch (this.state.phase) {
            case this.Phases.Edit:
                const passwordLabel = this.state.cachedPassword ?
                    _t('Password') : _t('New Password');
                return (
                    <form className={this.props.className} onSubmit={this.onClickChange}>
                        { currentPassword }
                        <div className={rowClassName}>
                            <Field
                                type="password"
                                label={passwordLabel}
                                value={this.state.newPassword}
                                autoFocus={this.props.autoFocusNewPasswordInput}
                                onChange={this.onChangeNewPassword}
                                autoComplete="new-password"
                            />
                        </div>
                        <div className={rowClassName}>
                            <Field
                                type="password"
                                label={_t("Confirm password")}
                                value={this.state.newPasswordConfirm}
                                onChange={this.onChangeNewPasswordConfirm}
                                autoComplete="new-password"
                            />
                        </div>
                        <AccessibleButton className={buttonClassName} kind={this.props.buttonKind} onClick={this.onClickChange}>
                            { _t('Change Password') }
                        </AccessibleButton>
                    </form>
                );
            case this.Phases.Uploading:
                var Loader = sdk.getComponent("elements.Spinner");
                return (
                    <div className="mx_Dialog_content">
                        <Loader />
                    </div>
                );
        }
    },
});
