/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 New Vector Ltd

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
import SettingsStore from '../../../settings/SettingsStore';
import {verificationMethods} from 'matrix-js-sdk/lib/crypto';
import {renderSasWaitAccept} from '../../../sas_ui';

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
            mode: SettingsStore.isFeatureEnabled("feature_sas") ? MODE_SAS : MODE_LEGACY,
        };
    }

    componentWillUnmount() {
        if (this._verifier) {
            this._verifier.removeListener('show_sas', this._onVerifierShowSas);
            this._verifier.cancel('User cancel');
        }
    }

    _onSwitchToLegacyClick = () => {
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
                //body = this._renderSasVerificationPhaseWaitForPartnerToAccept();
                body = renderSasWaitAccept(this.props.userId);
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
                    { _t("Do clicky clicky button press request verify user send to do.") }
                </p>
                <DialogButtons
                    primaryButton={_t('Send Verification Request')}
                    hasCancel={true}
                    onPrimaryButtonClick={this._onSasRequestClick}
                    onCancel={this._onCancelClick}
                />
            </div>
        );
    }

    _renderSasVerificationPhaseShowSas() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            <p>{_t(
                "Verify this user by confirming the following number appears on their screen"
            )}</p>
            <p>{_t(
                "For maximum security, we reccommend you do this in person or use another " +
                "trusted means of communication"
            )}</p>
            <pre>{this._showSasEvent.sas}</pre>
            <DialogButtons onPrimaryButtonClick={this._onSasMatchesClick}
                primaryButton={_t("This Matches")}
                hasCancel={true}
                onCancel={this._onCancelClick}
            />
        </div>;
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
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return <div>
            <p>{_t("Verification complete!")}</p>
            <DialogButtons onPrimaryButtonClick={this._onVerifiedDoneClick}
                primaryButton={_t("Done")}
                hasCancel={false}
            />
        </div>;
    }

    _renderSasVerificationPhaseCancelled() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        return (
            <div>
                <p>{_t(
                    "%(userId)s cancelled the verification.", {userId: this.props.userId},
                )}</p>
                <DialogButtons
                    primaryButton={_t('Cancel')}
                    hasCancel={false}
                    onPrimaryButtonClick={this._onCancelClick}
                />
            </div>
        );
    }

    _renderLegacyVerification() {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        const AccessibleButton = sdk.getComponent('views.elements.AccessibleButton');

        const key = FormattingUtils.formatCryptoKey(this.props.device.getFingerprint());
        const body = (
            <div>
                <AccessibleButton
                    element="span" className="mx_linkButton" onClick={this._onSwitchToSasClick}
                >
                    {_t("Use two-way text verification")}
                </AccessibleButton>
                <p>
                    { _t("To verify that this device can be trusted, please contact its " +
                        "owner using some other means (e.g. in person or a phone call) " +
                        "and ask them whether the key they see in their User Settings " +
                        "for this device matches the key below:") }
                </p>
                <div className="mx_UserSettings_cryptoSection">
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
                <p>
                    { _t("In future this verification process will be more sophisticated.") }
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

