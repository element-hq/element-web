/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import * as sdk from '../../../index';
import Analytics from '../../../Analytics';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import * as Lifecycle from '../../../Lifecycle';
import { _t } from '../../../languageHandler';

export default class DeactivateAccountDialog extends React.Component {
    constructor(props) {
        super(props);

        this._onOk = this._onOk.bind(this);
        this._onCancel = this._onCancel.bind(this);
        this._onPasswordFieldChange = this._onPasswordFieldChange.bind(this);
        this._onEraseFieldChange = this._onEraseFieldChange.bind(this);

        this.state = {
            password: "",
            busy: false,
            shouldErase: false,
            errStr: null,
        };
    }

    _onPasswordFieldChange(ev) {
        this.setState({
            password: ev.target.value,
        });
    }

    _onEraseFieldChange(ev) {
        this.setState({
            shouldErase: ev.target.checked,
        });
    }

    async _onOk() {
        this.setState({busy: true});

        try {
            // This assumes that the HS requires password UI auth
            // for this endpoint. In reality it could be any UI auth.
            const auth = {
                type: 'm.login.password',
                // TODO: Remove `user` once servers support proper UIA
                // See https://github.com/vector-im/riot-web/issues/10312
                user: MatrixClientPeg.get().credentials.userId,
                identifier: {
                    type: "m.id.user",
                    user: MatrixClientPeg.get().credentials.userId,
                },
                password: this.state.password,
            };
            await MatrixClientPeg.get().deactivateAccount(auth, this.state.shouldErase);
        } catch (err) {
            let errStr = _t('Unknown error');
            // https://matrix.org/jira/browse/SYN-744
            if (err.httpStatus === 401 || err.httpStatus === 403) {
                errStr = _t('Incorrect password');
            }
            this.setState({
                busy: false,
                errStr: errStr,
            });
            return;
        }

        Analytics.trackEvent('Account', 'Deactivate Account');
        Lifecycle.onLoggedOut();
        this.props.onFinished(true);
    }

    _onCancel() {
        this.props.onFinished(false);
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const Loader = sdk.getComponent("elements.Spinner");
        let passwordBoxClass = '';

        let error = null;
        if (this.state.errStr) {
            error = <div className="error">
                { this.state.errStr }
            </div>;
            passwordBoxClass = 'error';
        }

        const okLabel = this.state.busy ? <Loader /> : _t('Deactivate Account');
        const okEnabled = this.state.password && !this.state.busy;

        let cancelButton = null;
        if (!this.state.busy) {
            cancelButton = <button onClick={this._onCancel} autoFocus={true}>
                { _t("Cancel") }
            </button>;
        }

        const Field = sdk.getComponent('elements.Field');

        // this is on purpose not a <form /> to prevent Enter triggering submission, to further prevent accidents
        return (
            <BaseDialog className="mx_DeactivateAccountDialog"
                onFinished={this.props.onFinished}
                onEnterPressed={this.onOk}
                titleClass="danger"
                title={_t("Deactivate Account")}
            >
                <div className="mx_Dialog_content">
                    <p>{ _t(
                        "This will make your account permanently unusable. " +
                        "You will not be able to log in, and no one will be able to re-register the same " +
                        "user ID. " +
                        "This will cause your account to leave all rooms it is participating in, and it " +
                        "will remove your account details from your identity server. " +
                        "<b>This action is irreversible.</b>",
                        {},
                        { b: (sub) => <b> { sub } </b> },
                    ) }</p>

                    <p>{ _t(
                        "Deactivating your account <b>does not by default cause us to forget messages you " +
                        "have sent.</b> " +
                        "If you would like us to forget your messages, please tick the box below.",
                        {},
                        { b: (sub) => <b> { sub } </b> },
                    ) }</p>

                    <p>{ _t(
                        "Message visibility in Matrix is similar to email. " +
                        "Our forgetting your messages means that messages you have sent will not be shared " +
                        "with any new or unregistered users, but registered users who already have access " +
                        "to these messages will still have access to their copy.",
                    ) }</p>

                    <div className="mx_DeactivateAccountDialog_input_section">
                        <p>
                            <label htmlFor="mx_DeactivateAccountDialog_erase_account_input">
                                <input
                                    id="mx_DeactivateAccountDialog_erase_account_input"
                                    type="checkbox"
                                    checked={this.state.shouldErase}
                                    onChange={this._onEraseFieldChange}
                                />
                                { _t(
                                    "Please forget all messages I have sent when my account is deactivated " +
                                    "(<b>Warning:</b> this will cause future users to see an incomplete view " +
                                    "of conversations)",
                                    {},
                                    { b: (sub) => <b>{ sub }</b> },
                                ) }
                            </label>
                        </p>

                        <p>{ _t("To continue, please enter your password:") }</p>
                        <Field
                            id="mx_DeactivateAccountDialog_password"
                            type="password"
                            label={_t('Password')}
                            onChange={this._onPasswordFieldChange}
                            value={this.state.password}
                            className={passwordBoxClass}
                        />
                    </div>

                    { error }
                </div>
                <div className="mx_Dialog_buttons">
                    <button
                        className="mx_Dialog_primary danger"
                        onClick={this._onOk}
                        disabled={!okEnabled}
                    >
                        { okLabel }
                    </button>

                    { cancelButton }
                </div>
            </BaseDialog>
        );
    }
}

DeactivateAccountDialog.propTypes = {
    onFinished: PropTypes.func.isRequired,
};
