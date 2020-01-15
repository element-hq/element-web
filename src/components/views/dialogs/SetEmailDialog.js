/*
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import * as Email from '../../../email';
import AddThreepid from '../../../AddThreepid';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';


/**
 * Prompt the user to set an email address.
 *
 * On success, `onFinished(true)` is called.
 */
export default createReactClass({
    displayName: 'SetEmailDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            emailAddress: '',
            emailBusy: false,
        };
    },

    onEmailAddressChanged: function(value) {
        this.setState({
            emailAddress: value,
        });
    },

    onSubmit: function() {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

        const emailAddress = this.state.emailAddress;
        if (!Email.looksValid(emailAddress)) {
            Modal.createTrackedDialog('Invalid Email Address', '', ErrorDialog, {
                title: _t("Invalid Email Address"),
                description: _t("This doesn't appear to be a valid email address"),
            });
            return;
        }
        this._addThreepid = new AddThreepid();
        this._addThreepid.addEmailAddress(emailAddress).then(() => {
            Modal.createTrackedDialog('Verification Pending', '', QuestionDialog, {
                title: _t("Verification Pending"),
                description: _t(
                    "Please check your email and click on the link it contains. Once this " +
                    "is done, click continue.",
                ),
                button: _t('Continue'),
                onFinished: this.onEmailDialogFinished,
            });
        }, (err) => {
            this.setState({emailBusy: false});
            console.error("Unable to add email address " + emailAddress + " " + err);
            Modal.createTrackedDialog('Unable to add email address', '', ErrorDialog, {
                title: _t("Unable to add email address"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });
        this.setState({emailBusy: true});
    },

    onCancelled: function() {
        this.props.onFinished(false);
    },

    onEmailDialogFinished: function(ok) {
        if (ok) {
            this.verifyEmailAddress();
        } else {
            this.setState({emailBusy: false});
        }
    },

    verifyEmailAddress: function() {
        this._addThreepid.checkEmailLinkClicked().then(() => {
            this.props.onFinished(true);
        }, (err) => {
            this.setState({emailBusy: false});
            if (err.errcode == 'M_THREEPID_AUTH_FAILED') {
                const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
                const message = _t("Unable to verify email address.") + " " +
                    _t("Please check your email and click on the link it contains. Once this is done, click continue.");
                Modal.createTrackedDialog('Verification Pending', '3pid Auth Failed', QuestionDialog, {
                    title: _t("Verification Pending"),
                    description: message,
                    button: _t('Continue'),
                    onFinished: this.onEmailDialogFinished,
                });
            } else {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                console.error("Unable to verify email address: " + err);
                Modal.createTrackedDialog('Unable to verify email address', '', ErrorDialog, {
                    title: _t("Unable to verify email address."),
                    description: ((err && err.message) ? err.message : _t("Operation failed")),
                });
            }
        });
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const Spinner = sdk.getComponent('elements.Spinner');
        const EditableText = sdk.getComponent('elements.EditableText');

        const emailInput = this.state.emailBusy ? <Spinner /> : <EditableText
            initialValue={this.state.emailAddress}
            className="mx_SetEmailDialog_email_input"
            autoFocus="true"
            placeholder={_t("Email address")}
            placeholderClassName="mx_SetEmailDialog_email_input_placeholder"
            blurToCancel={false}
            onValueChanged={this.onEmailAddressChanged} />;

        return (
            <BaseDialog className="mx_SetEmailDialog"
                onFinished={this.onCancelled}
                title={this.props.title}
                contentId='mx_Dialog_content'
            >
                <div className="mx_Dialog_content">
                    <p id='mx_Dialog_content'>
                        { _t('This will allow you to reset your password and receive notifications.') }
                    </p>
                    { emailInput }
                </div>
                <div className="mx_Dialog_buttons">
                    <input className="mx_Dialog_primary"
                        type="submit"
                        value={_t("Continue")}
                        onClick={this.onSubmit}
                    />
                    <input
                        type="submit"
                        value={_t("Skip")}
                        onClick={this.onCancelled}
                    />
                </div>
            </BaseDialog>
        );
    },
});
