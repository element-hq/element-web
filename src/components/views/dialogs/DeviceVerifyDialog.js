/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import MatrixClientPeg from '../../../MatrixClientPeg';
import sdk from '../../../index';
import * as FormattingUtils from '../../../utils/FormattingUtils';
import { _t } from '../../../languageHandler';
import {verificationMethods} from 'matrix-js-sdk/lib/crypto';

const MODE_LEGACY = 'legacy';
const MODE_SAS = 'sas';

const PHASE_START = 0;
const PHASE_WAIT_FOR_PARTNER_TO_ACCEPT = 1;
const PHASE_SHOW_SAS = 2;
const PHASE_WAIT_FOR_PARTNER_TO_CONFIRM = 3;
const PHASE_VERIFIED = 4;
const PHASE_CANCELLED = 5;

export default class DeviceVerifyDialog extends React.Component {
    static propTypes = {
        userId: PropTypes.string.isRequired,
        device: PropTypes.object.isRequired,
        onFinished: PropTypes.func.isRequired,
    };

    constructor() {
        super();
        this._verifier = null;
        this._showSasEvent = null;
        this.state = {
            phase: PHASE_START,
            mode: MODE_SAS,
            sasVerified: false,
        };
    }

    componentWillUnmount() {
        if (this._verifier) {
            this._verifier.removeListener('show_sas', this._onVerifierShowSas);
            this._verifier.cancel('User cancel');
        }
    }

    _onSwitchToLegacyClick = () => {
        if (this._verifier) {
            this._verifier.removeListener('show_sas', this._onVerifierShowSas);
            this._verifier.cancel('User cancel');
            this._verifier = null;
        }
        this.setState({mode: MODE_LEGACY});
    }

    _onSwitchToSasClick = () => {
        this.setState({mode: MODE_SAS});
    }

    _onCancelClick = () => {
        this.props.onFinished(false);
    }

    _onLegacyFinished = (confirm) => {
        if (confirm) {
            MatrixClientPeg.get().setDeviceVerified(
                this.props.userId, this.props.device.deviceId, true,
            );
        }
        this.props.onFinished(confirm);
    }

    _onSasRequestClick = () => {
        this.setState({
            phase: PHASE_WAIT_FOR_PARTNER_TO_ACCEPT,
        });
        this._verifier = MatrixClientPeg.get().beginKeyVerification(
            verificationMethods.SAS, this.props.userId, this.props.device.deviceId,
        );
        this._verifier.on('show_sas', this._onVerifierShowSas);
        this._verifier.verify().then(() => {
            this.setState({phase: PHASE_VERIFIED});
            this._verifier.removeListener('show_sas', this._onVerifierShowSas);
            this._verifier = null;
        }).catch((e) => {
            console.log("Verification failed", e);
            this.setState({
                phase: PHASE_CANCELLED,
            });
            this._verifier = null;
        });
    }

    _onSasMatchesClick = () => {
        this._showSasEvent.confirm();
        this.setState({
            phase: PHASE_WAIT_FOR_PARTNER_TO_CONFIRM,
        });
    }

    _onVerifiedDoneClick = () => {
        this.props.onFinished(true);
    }

    _onVerifierShowSas = (e) => {
        this._showSasEvent = e;
        this.setState({
            phase: PHASE_SHOW_SAS,
        });
    }

    _renderSasVerification() {
        let body;
        switch (this.state.phase) {
            case PHASE_START:
                body = this._renderSasVerificationPhaseStart();
                break;
            case PHASE_WAIT_FOR_PARTNER_TO_ACCEPT:
                body = this._renderSasVerificationPhaseWaitAccept();
                break;
            case PHASE_SHOW_SAS:
                body = this._renderSasVerificationPhaseShowSas();
                break;
            case PHASE_WAIT_FOR_PARTNER_TO_CONFIRM:
                body = this._renderSasVerificationPhaseWaitForPartnerToConfirm();
                break;
            case PHASE_VERIFIED:
                body = this._renderSasVerificationPhaseVerified();
                break;
            case PHASE_CANCELLED:
                body = this._renderSasVerificationPhaseCancelled();
                break;
        }

        const BaseDialog = sdk.getComponent("dialogs.BaseDialog");
        return (
            <BaseDialog
                title={_t("Verify device")}
                onFinished={this._onCancelClick}
            >
                {body}
            </BaseDialog>
        );
    }

    _renderSasVerificationPhaseStart() {
        const AccessibleButton = sdk.getComponent('views.elements.AccessibleButton');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return (
            <div>
                <AccessibleButton
                    element="span" className="mx_linkButton" onClick={this._onSwitchToLegacyClick}
                >
                    {_t("Use Legacy Verification (for older clients)")}
                </AccessibleButton>
                <p>
                    { _t("Verify by comparing a short text string.") }
                </p>
                <p>
                    {_t(
                        "For maximum security, we recommend you do this in person or " +
                        "use another trusted means of communication.",
                    )}
                </p>
                <DialogButtons
                    primaryButton={_t('Begin Verifying')}
                    hasCancel={true}
                    onPrimaryButtonClick={this._onSasRequestClick}
                    onCancel={this._onCancelClick}
                />
            </div>
        );
    }

    _renderSasVerificationPhaseWaitAccept() {
        const Spinner = sdk.getComponent("views.elements.Spinner");
        const AccessibleButton = sdk.getComponent('views.elements.AccessibleButton');

        return (
            <div>
                <Spinner />
                <p>{_t("Waiting for partner to accept...")}</p>
                <p>{_t(
                    "Nothing appearing? Not all clients support interactive verification yet. " +
                    "<button>Use legacy verification</button>.",
                    {}, {button: sub => <AccessibleButton element='span' className="mx_linkButton"
                        onClick={this._onSwitchToLegacyClick}
                    >
                        {sub}
                    </AccessibleButton>},
                )}</p>
            </div>
        );
    }

    _renderSasVerificationPhaseShowSas() {
        const VerificationShowSas = sdk.getComponent('views.verification.VerificationShowSas');
        return <VerificationShowSas
            sas={this._showSasEvent.sas}
            onCancel={this._onCancelClick}
            onDone={this._onSasMatchesClick}
        />;
    }

    _renderSasVerificationPhaseWaitForPartnerToConfirm() {
        const Spinner = sdk.getComponent('views.elements.Spinner');
        return <div>
            <Spinner />
            <p>{_t(
                "Waiting for %(userId)s to confirm...", {userId: this.props.userId},
            )}</p>
        </div>;
    }

    _renderSasVerificationPhaseVerified() {
        const VerificationComplete = sdk.getComponent('views.verification.VerificationComplete');
        return <VerificationComplete onDone={this._onVerifiedDoneClick} />;
    }

    _renderSasVerificationPhaseCancelled() {
        const VerificationCancelled = sdk.getComponent('views.verification.VerificationCancelled');
        return <VerificationCancelled onDone={this._onCancelClick} />;
    }

    _renderLegacyVerification() {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        const AccessibleButton = sdk.getComponent('views.elements.AccessibleButton');

        let text;
        if (MatrixClientPeg.get().getUserId() === this.props.userId) {
            text = _t("To verify that this device can be trusted, please check that the key you see " +
                "in User Settings on that device matches the key below:");
        } else {
            text = _t("To verify that this device can be trusted, please contact its owner using some other " +
                "means (e.g. in person or a phone call) and ask them whether the key they see in their User Settings " +
                "for this device matches the key below:");
        }

        const key = FormattingUtils.formatCryptoKey(this.props.device.getFingerprint());
        const body = (
            <div>
                <AccessibleButton
                    element="span" className="mx_linkButton" onClick={this._onSwitchToSasClick}
                >
                    {_t("Use two-way text verification")}
                </AccessibleButton>
                <p>
                    { text }
                </p>
                <div className="mx_DeviceVerifyDialog_cryptoSection">
                    <ul>
                        <li><label>{ _t("Device name") }:</label> <span>{ this.props.device.getDisplayName() }</span></li>
                        <li><label>{ _t("Device ID") }:</label> <span><code>{ this.props.device.deviceId }</code></span></li>
                        <li><label>{ _t("Device key") }:</label> <span><code><b>{ key }</b></code></span></li>
                    </ul>
                </div>
                <p>
                    { _t("If it matches, press the verify button below. " +
                        "If it doesn't, then someone else is intercepting this device " +
                        "and you probably want to press the blacklist button instead.") }
                </p>
            </div>
        );

        return (
            <QuestionDialog
                title={_t("Verify device")}
                description={body}
                button={_t("I verify that the keys match")}
                onFinished={this._onLegacyFinished}
            />
        );
    }

    render() {
        if (this.state.mode === MODE_LEGACY) {
            return this._renderLegacyVerification();
        } else {
            return <div>
                {this._renderSasVerification()}
            </div>;
        }
    }
}

