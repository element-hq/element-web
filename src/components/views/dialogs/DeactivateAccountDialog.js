/*
Copyright 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import InteractiveAuth, {ERROR_USER_CANCELLED} from "../../structures/InteractiveAuth";
import {DEFAULT_PHASE, PasswordAuthEntry, SSOAuthEntry} from "../auth/InteractiveAuthEntryComponents";

export default class DeactivateAccountDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            shouldErase: false,
            errStr: null,
            authData: null, // for UIA
            authEnabled: true, // see usages for information

            // A few strings that are passed to InteractiveAuth for design or are displayed
            // next to the InteractiveAuth component.
            bodyText: null,
            continueText: null,
            continueKind: null,
        };

        this._initAuth(/* shouldErase= */false);
    }

    _onStagePhaseChange = (stage, phase) => {
        const dialogAesthetics = {
            [SSOAuthEntry.PHASE_PREAUTH]: {
                body: _t("Confirm your account deactivation by using Single Sign On to prove your identity."),
                continueText: _t("Single Sign On"),
                continueKind: "danger",
            },
            [SSOAuthEntry.PHASE_POSTAUTH]: {
                body: _t("Are you sure you want to deactivate your account? This is irreversible."),
                continueText: _t("Confirm account deactivation"),
                continueKind: "danger",
            },
        };

        // This is the same as aestheticsForStagePhases in InteractiveAuthDialog minus the `title`
        const DEACTIVATE_AESTHETICS = {
            [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
            [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
            [PasswordAuthEntry.LOGIN_TYPE]: {
                [DEFAULT_PHASE]: {
                    body: _t("To continue, please enter your password:"),
                },
            },
        };

        const aesthetics = DEACTIVATE_AESTHETICS[stage];
        let bodyText = null;
        let continueText = null;
        let continueKind = null;
        if (aesthetics) {
            const phaseAesthetics = aesthetics[phase];
            if (phaseAesthetics && phaseAesthetics.body) bodyText = phaseAesthetics.body;
            if (phaseAesthetics && phaseAesthetics.continueText) continueText = phaseAesthetics.continueText;
            if (phaseAesthetics && phaseAesthetics.continueKind) continueKind = phaseAesthetics.continueKind;
        }
        this.setState({bodyText, continueText, continueKind});
    };

    _onUIAuthFinished = (success, result, extra) => {
        if (success) return; // great! makeRequest() will be called too.

        if (result === ERROR_USER_CANCELLED) {
            this._onCancel();
            return;
        }

        console.error("Error during UI Auth:", {result, extra});
        this.setState({errStr: _t("There was a problem communicating with the server. Please try again.")});
    };

    _onUIAuthComplete = (auth) => {
        MatrixClientPeg.get().deactivateAccount(auth, this.state.shouldErase).then(r => {
            // Deactivation worked - logout & close this dialog
            Analytics.trackEvent('Account', 'Deactivate Account');
            Lifecycle.onLoggedOut();
            this.props.onFinished(true);
        }).catch(e => {
            console.error(e);
            this.setState({errStr: _t("There was a problem communicating with the server. Please try again.")});
        });
    };

    _onEraseFieldChange = (ev) => {
        this.setState({
            shouldErase: ev.target.checked,

            // Disable the auth form because we're going to have to reinitialize the auth
            // information. We do this because we can't modify the parameters in the UIA
            // session, and the user will have selected something which changes the request.
            // Therefore, we throw away the last auth session and try a new one.
            authEnabled: false,
        });

        // As mentioned above, set up for auth again to get updated UIA session info
        this._initAuth(/* shouldErase= */ev.target.checked);
    };

    _onCancel() {
        this.props.onFinished(false);
    }

    _initAuth(shouldErase) {
        MatrixClientPeg.get().deactivateAccount(null, shouldErase).then(r => {
            // If we got here, oops. The server didn't require any auth.
            // Our application lifecycle will catch the error and do the logout bits.
            // We'll try to log something in an vain attempt to record what happened (storage
            // is also obliterated on logout).
            console.warn("User's account got deactivated without confirmation: Server had no auth");
            this.setState({errStr: _t("Server did not require any authentication")});
        }).catch(e => {
            if (e && e.httpStatus === 401 && e.data) {
                // Valid UIA response
                this.setState({authData: e.data, authEnabled: true});
            } else {
                this.setState({errStr: _t("Server did not return valid authentication information.")});
            }
        });
    }

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');

        let error = null;
        if (this.state.errStr) {
            error = <div className="error">
                { this.state.errStr }
            </div>;
        }

        let auth = <div>{_t("Loading...")}</div>;
        if (this.state.authData && this.state.authEnabled) {
            auth = (
                <div>
                    {this.state.bodyText}
                    <InteractiveAuth
                        matrixClient={MatrixClientPeg.get()}
                        authData={this.state.authData}
                        makeRequest={this._onUIAuthComplete}
                        onAuthFinished={this._onUIAuthFinished}
                        onStagePhaseChange={this._onStagePhaseChange}
                        continueText={this.state.continueText}
                        continueKind={this.state.continueKind}
                    />
                </div>
            );
        }

        // this is on purpose not a <form /> to prevent Enter triggering submission, to further prevent accidents
        return (
            <BaseDialog className="mx_DeactivateAccountDialog"
                onFinished={this.props.onFinished}
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

                        {error}
                        {auth}
                    </div>

                </div>
            </BaseDialog>
        );
    }
}

DeactivateAccountDialog.propTypes = {
    onFinished: PropTypes.func.isRequired,
};
