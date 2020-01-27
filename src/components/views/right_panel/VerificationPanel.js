/*
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

import * as sdk from '../../../index';
import {verificationMethods} from 'matrix-js-sdk/src/crypto';
import VerificationQRCode from "../elements/crypto/VerificationQRCode";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {_t} from "../../../languageHandler";
import E2EIcon from "../rooms/E2EIcon";

export default class VerificationPanel extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {};
        this._hasVerifier = !!props.request.verifier;
    }

    renderQRPhase() {
        const {member, request} = this.props;
        // TODO change the button into a spinner when on click
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const cli = MatrixClientPeg.get();
        const crossSigningInfo = cli.getStoredCrossSigningForUser(request.otherUserId);
        if (!crossSigningInfo || !request.requestEvent || !request.requestEvent.getId()) {
            // for whatever reason we can't generate a QR code, offer only SAS Verification
            return <div className="mx_UserInfo_container">
                <h3>Verify by emoji</h3>
                <p>{_t("Verify by comparing unique emoji.")}</p>

                <AccessibleButton kind="primary" className="mx_UserInfo_verify" onClick={this._startSAS}>
                    {_t("Verify by emoji")}
                </AccessibleButton>
            </div>;
        }

        const myKeyId = cli.getCrossSigningId();
        const qrCodeKeys = [
            [cli.getDeviceId(), cli.getDeviceEd25519Key()],
            [myKeyId, myKeyId],
        ];

        // TODO: add way to open camera to scan a QR code
        return <React.Fragment>
            <div className="mx_UserInfo_container">
                <h3>Verify by scanning</h3>
                <p>{_t("Ask %(displayName)s to scan your code:", {
                    displayName: member.displayName || member.name || member.userId,
                })}</p>

                <div className="mx_VerificationPanel_qrCode">
                    <VerificationQRCode
                        keyholderUserId={MatrixClientPeg.get().getUserId()}
                        requestEventId={request.requestEvent.getId()}
                        otherUserKey={crossSigningInfo.getId("master")}
                        secret={request.encodedSharedSecret}
                        keys={qrCodeKeys}
                    />
                </div>
            </div>

            <div className="mx_UserInfo_container">
                <h3>Verify by emoji</h3>
                <p>{_t("If you can't scan the code above, verify by comparing unique emoji.")}</p>

                <AccessibleButton kind="primary" className="mx_UserInfo_verify" onClick={this._startSAS}>
                    {_t("Verify by emoji")}
                </AccessibleButton>
            </div>
        </React.Fragment>;
    }

    renderVerifiedPhase() {
        const {member} = this.props;

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return (
            <div className="mx_UserInfo_container mx_VerificationPanel_verified_section">
                <h3>Verified</h3>
                <p>{_t("You've successfully verified %(displayName)s!", {
                    displayName: member.displayName || member.name || member.userId,
                })}</p>
                <E2EIcon isUser={true} status="verified" size={128} />
                <p>Verify all users in a room to ensure it's secure.</p>
                <AccessibleButton kind="primary" className="mx_UserInfo_verify" onClick={this._startSAS}>
                    {_t("Got it")}
                </AccessibleButton>
            </div>
        );
    }

    render() {
        const {member, request} = this.props;

        const displayName = member.displayName || member.name || member.userId;

        if (request.ready) {
            return this.renderQRPhase();
        } else if (request.started) {
            if (this.state.sasEvent) {
                const VerificationShowSas = sdk.getComponent('views.verification.VerificationShowSas');
                // TODO implement "mismatch" vs "cancelled"
                return <div className="mx_UserInfo_container">
                    <h3>Compare emoji</h3>
                    <VerificationShowSas
                        displayName={displayName}
                        sas={this.state.sasEvent.sas}
                        onCancel={this._onSasMismatchesClick}
                        onDone={this._onSasMatchesClick}
                    />
                </div>;
            } else {
                return (<p>Setting up SAS verification...</p>);
            }
        } else if (request.done) {
            return this.renderVerifiedPhase();
        } else if (request.cancelled) {
            // TODO check if this matches target
            // TODO should this be a MODAL?
            return <p>cancelled by {request.cancellingUserId}!</p>;
        }
        return null;
    }

    _startSAS = async () => {
        const verifier = this.props.request.beginKeyVerification(verificationMethods.SAS);
        try {
            await verifier.verify();
        } catch (err) {
            console.error(err);
        } finally {
            this.setState({sasEvent: null});
        }
    };

    _onSasMatchesClick = () => {
        this.state.sasEvent.confirm();
    };

    _onSasMismatchesClick = () => {
        this.state.sasEvent.cancel();
    };

    _onVerifierShowSas = (sasEvent) => {
        this.setState({sasEvent});
    };

    _onRequestChange = async () => {
        const {request} = this.props;
        if (!this._hasVerifier && !!request.verifier) {
            request.verifier.on('show_sas', this._onVerifierShowSas);
            try {
                // on the requester side, this is also awaited in _startSAS,
                // but that's ok as verify should return the same promise.
                await request.verifier.verify();
            } catch (err) {
                console.error("error verify", err);
            }
        } else if (this._hasVerifier && !request.verifier) {
            request.verifier.removeListener('show_sas', this._onVerifierShowSas);
        }
        this._hasVerifier = !!request.verifier;
        this.forceUpdate(); // TODO fix this
    };

    componentDidMount() {
        this.props.request.on("change", this._onRequestChange);
    }

    componentWillUnmount() {
        this.props.request.off("change", this._onRequestChange);
    }
}
