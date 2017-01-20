/*
Copyright 2016 OpenMarket Ltd

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

import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import Lifecycle from '../../../Lifecycle';
import Velocity from 'velocity-vector';

export default class DeactivateAccountDialog extends React.Component {
    constructor(props, context) {
        super(props, context);

        this._passwordField = null;

        this._onOk = this._onOk.bind(this);
        this._onCancel = this._onCancel.bind(this);
        this._onPasswordFieldChange = this._onPasswordFieldChange.bind(this);

        this.state = {
            confirmButtonEnabled: false,
            busy: false,
            errStr: null,
        };
    }

    _onPasswordFieldChange(ev) {
        this.setState({
            confirmButtonEnabled: Boolean(ev.target.value),
        });
    }

    _onOk() {
        // This assumes that the HS requires password UI auth
        // for this endpoint. In reality it could be any UI auth.
        this.setState({busy: true});
        MatrixClientPeg.get().deactivateAccount({
            type: 'm.login.password',
            user: MatrixClientPeg.get().credentials.userId,
            password: this._passwordField.value,
        }).done(() => {
            Lifecycle.onLoggedOut();
            this.props.onFinished(false);
        }, (err) => {
            let errStr = 'Unknown error';
            // https://matrix.org/jira/browse/SYN-744
            if (err.httpStatus == 401 || err.httpStatus == 403) {
                errStr = 'Incorrect password';
                Velocity(this._passwordField, "callout.shake", 300);
            }
            this.setState({
                busy: false,
                errStr: errStr,
            });
        });
    }

    _onCancel() {
        this.props.onFinished(false);
    }

    render() {
        const Loader = sdk.getComponent("elements.Spinner");
        let passwordBoxClass = '';

        let error = null;
        if (this.state.errStr) {
            error = <div className="error">
                {this.state.errStr}
            </div>;
            passwordBoxClass = 'error';
        }

        const okLabel = this.state.busy ? <Loader /> : 'Deactivate Account';
        const okEnabled = this.state.confirmButtonEnabled && !this.state.busy;

        let cancelButton = null;
        if (!this.state.busy) {
            cancelButton = <button onClick={this._onCancel} autoFocus={true}>
                Cancel
            </button>;
        }

        return (
            <div className="mx_DeactivateAccountDialog">
                <div className="mx_Dialog_title danger">
                    Deactivate Account
                </div>
                <div className="mx_Dialog_content">
                    <p>This will make your account permanently unusable. You will not be able to re-register the same user ID.</p>

                    <p>This action is irreversible.</p>

                    <p>To continue, please enter your password.</p>

                    <p>Password:</p>
                    <input
                        type="password"
                        onChange={this._onPasswordFieldChange}
                        ref={(e) => {this._passwordField = e;}}
                        className={passwordBoxClass}
                    />
                    {error}
                </div>
                <div className="mx_Dialog_buttons">
                    <button
                        className="mx_Dialog_primary danger"
                        onClick={this._onOk}
                        disabled={!okEnabled}
                    >
                        {okLabel}
                    </button>

                    {cancelButton}
                </div>
            </div>
        );
    }
}

DeactivateAccountDialog.propTypes = {
    onFinished: React.PropTypes.func.isRequired,
};
