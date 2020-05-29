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
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import * as sdk from '../../../index';
import * as FormattingUtils from '../../../utils/FormattingUtils';
import { _t } from '../../../languageHandler';
import {verificationMethods} from 'matrix-js-sdk/src/crypto';
import {ensureDMExists} from "../../../createRoom";
import dis from "../../../dispatcher/dispatcher";
import SettingsStore from '../../../settings/SettingsStore';
import {SHOW_QR_CODE_METHOD} from "matrix-js-sdk/src/crypto/verification/QRCode";
import VerificationQREmojiOptions from "../verification/VerificationQREmojiOptions";

const MODE_LEGACY = 'legacy';
const MODE_SAS = 'sas';

const PHASE_START = 0;
const PHASE_WAIT_FOR_PARTNER_TO_ACCEPT = 1;
const PHASE_PICK_VERIFICATION_OPTION = 2;
const PHASE_SHOW_SAS = 3;
const PHASE_WAIT_FOR_PARTNER_TO_CONFIRM = 4;
const PHASE_VERIFIED = 5;
const PHASE_CANCELLED = 6;

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
        this._request = null;
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

    _onUseSasClick = async () => {
        try {
            this._verifier = this._request.beginKeyVerification(verificationMethods.SAS);
            this._verifier.on('show_sas', this._onVerifierShowSas);
            // throws upon cancellation
            await this._verifier.verify();
            this.setState({phase: PHASE_VERIFIED});
            this._verifier.removeListener('show_sas', this._onVerifierShowSas);
            this._verifier = null;
        } catch (e) {
            console.log("Verification failed", e);
            this.setState({
                phase: PHASE_CANCELLED,
            });
            this._verifier = null;
            this._request = null;
        }
    };

    _onLegacyFinished = (confirm) => {
        if (confirm) {
            MatrixClientPeg.get().setDeviceVerified(
                this.props.userId, this.props.device.deviceId, true,
            );
        }
        this.props.onFinished(confirm);
    }

    _onSasRequestClick = async () => {
        this.setState({
            phase: PHASE_WAIT_FOR_PARTNER_TO_ACCEPT,
        });
        const client = MatrixClientPeg.get();
        const verifyingOwnDevice = this.props.userId === client.getUserId();
        try {
            if (!verifyingOwnDevice && SettingsStore.getValue("feature_cross_signing")) {
                const roomId = await ensureDMExistsAndOpen(this.props.userId);
                // throws upon cancellation before having started
                const request = await client.requestVerificationDM(
                    this.props.userId, roomId,
                );
                await request.waitFor(r => r.ready || r.started);
                if (request.ready) {
                    this._verifier = request.beginKeyVerification(verificationMethods.SAS);
                } else {
                    this._verifier = request.verifier;
                }
            } else if (verifyingOwnDevice && SettingsStore.getValue("feature_cross_signing")) {
                this._request = await client.requestVerification(this.props.userId, [
                    verificationMethods.SAS,
                    SHOW_QR_CODE_METHOD,
                    verificationMethods.RECIPROCATE_QR_CODE,
                ]);

                await this._request.waitFor(r => r.ready || r.started);
                this.setState({phase: PHASE_PICK_VERIFICATION_OPTION});
            } else {
                this._verifier = client.beginKeyVerification(
                    verificationMethods.SAS, this.props.userId, this.props.device.deviceId,
                );
            }
            if (!this._verifier) return;
            this._verifier.on('show_sas', this._onVerifierShowSas);
            // throws upon cancellation
            await this._verifier.verify();
            this.setState({phase: PHASE_VERIFIED});
            this._verifier.removeListener('show_sas', this._onVerifierShowSas);
            this._verifier = null;
        } catch (e) {
            console.log("Verification failed", e);
            this.setState({
                phase: PHASE_CANCELLED,
            });
            this._verifier = null;
        }
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
                body = this._renderVerificationPhaseStart();
                break;
            case PHASE_WAIT_FOR_PARTNER_TO_ACCEPT:
                body = this._renderVerificationPhaseWaitAccept();
                break;
            case PHASE_PICK_VERIFICATION_OPTION:
                body = this._renderVerificationPhasePick();
                break;
            case PHASE_SHOW_SAS:
                body = this._renderSasVerificationPhaseShowSas();
                break;
            case PHASE_WAIT_FOR_PARTNER_TO_CONFIRM:
                body = this._renderSasVerificationPhaseWaitForPartnerToConfirm();
                break;
            case PHASE_VERIFIED:
                body = this._renderVerificationPhaseVerified();
                break;
            case PHASE_CANCELLED:
                body = this._renderVerificationPhaseCancelled();
                break;
        }

        const BaseDialog = sdk.getComponent("dialogs.BaseDialog");
        return (
            <BaseDialog
                title={_t("Verify session")}
                onFinished={this._onCancelClick}
            >
                {body}
            </BaseDialog>
        );
    }

    _renderVerificationPhaseStart() {
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
                    {_t("To be secure, do this in person or use a trusted way to communicate.")}
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

    _renderVerificationPhaseWaitAccept() {
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

    _renderVerificationPhasePick() {
        return <VerificationQREmojiOptions
            request={this._request}
            onCancel={this._onCancelClick}
            onStartEmoji={this._onUseSasClick}
        />;
    }

    _renderSasVerificationPhaseShowSas() {
        const VerificationShowSas = sdk.getComponent('views.verification.VerificationShowSas');
        return <VerificationShowSas
            sas={this._showSasEvent.sas}
            onCancel={this._onCancelClick}
            onDone={this._onSasMatchesClick}
            isSelf={MatrixClientPeg.get().getUserId() === this.props.userId}
            onStartEmoji={this._onUseSasClick}
            inDialog={true}
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

    _renderVerificationPhaseVerified() {
        const VerificationComplete = sdk.getComponent('views.verification.VerificationComplete');
        return <VerificationComplete onDone={this._onVerifiedDoneClick} />;
    }

    _renderVerificationPhaseCancelled() {
        const VerificationCancelled = sdk.getComponent('views.verification.VerificationCancelled');
        return <VerificationCancelled onDone={this._onCancelClick} />;
    }

    _renderLegacyVerification() {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        const AccessibleButton = sdk.getComponent('views.elements.AccessibleButton');

        let text;
        if (MatrixClientPeg.get().getUserId() === this.props.userId) {
            text = _t("To verify that this session can be trusted, please check that the key you see " +
                "in User Settings on that device matches the key below:");
        } else {
            text = _t("To verify that this session can be trusted, please contact its owner using some other " +
                "means (e.g. in person or a phone call) and ask them whether the key they see in their User Settings " +
                "for this session matches the key below:");
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
                        <li><label>{ _t("Session name") }:</label> <span>{ this.props.device.getDisplayName() }</span></li>
                        <li><label>{ _t("Session ID") }:</label> <span><code>{ this.props.device.deviceId }</code></span></li>
                        <li><label>{ _t("Session key") }:</label> <span><code><b>{ key }</b></code></span></li>
                    </ul>
                </div>
                <p>
                    { _t("If it matches, press the verify button below. " +
                        "If it doesn't, then someone else is intercepting this session " +
                        "and you probably want to press the blacklist button instead.") }
                </p>
            </div>
        );

        return (
            <QuestionDialog
                title={_t("Verify session")}
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

async function ensureDMExistsAndOpen(userId) {
    const roomId = await ensureDMExists(MatrixClientPeg.get(), userId);
    // don't use andView and spinner in createRoom, together, they cause this dialog to close and reopen,
    // we causes us to loose the verifier and restart, and we end up having two verification requests
    dis.dispatch({
        action: 'view_room',
        room_id: roomId,
        should_peek: false,
    });
    return roomId;
}
