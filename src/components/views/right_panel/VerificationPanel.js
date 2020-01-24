/*
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
import * as sdk from '../../../index';
import {verificationMethods} from 'matrix-js-sdk/src/crypto';
import VerificationQRCode from "../elements/crypto/VerificationQRCode";
import {VerificationRequest} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import {MatrixClientPeg} from "../../../MatrixClientPeg";

export default class VerificationPanel extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {};
        this._hasVerifier = !!props.request.verifier;
    }

    render() {
        return <div className="mx_UserInfo">
            <div className="mx_UserInfo_container">
                { this.renderStatus() }
            </div>
        </div>;
    }

    renderStatus() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const Spinner = sdk.getComponent('elements.Spinner');
        const {request: req} = this.props;
        const request: VerificationRequest = req;

        if (request.requested) {
            return (<p>Waiting for {request.otherUserId} to accept ... <Spinner /></p>);
        } else if (request.ready) {
            const verifyButton = <AccessibleButton kind="primary" onClick={this._startSAS}>
                Verify by emoji
            </AccessibleButton>;

            const crossSigningInfo = MatrixClientPeg.get().getStoredCrossSigningForUser(request.otherUserId);
            const myKeyId = MatrixClientPeg.get().getCrossSigningId();
            if (request.requestEvent && request.requestEvent.getId() && crossSigningInfo) {
                const qrCodeKeys = [
                    [MatrixClientPeg.get().getDeviceId(), MatrixClientPeg.get().getDeviceEd25519Key()],
                    [myKeyId, myKeyId],
                ];
                const qrCode = <VerificationQRCode
                    keyholderUserId={MatrixClientPeg.get().getUserId()}
                    requestEventId={request.requestEvent.getId()}
                    otherUserKey={crossSigningInfo.getId("master")}
                    secret={request.encodedSharedSecret}
                    keys={qrCodeKeys}
                />;
                return (<p>{request.otherUserId} is ready, start {verifyButton} or have them scan: {qrCode}</p>);
            }

            return (<p>{request.otherUserId} is ready, start {verifyButton}</p>);
        } else if (request.started) {
            if (this.state.sasWaitingForOtherParty) {
                return <p>Waiting for {request.otherUserId} to confirm ...</p>;
            } else if (this.state.sasEvent) {
                const VerificationShowSas = sdk.getComponent('views.verification.VerificationShowSas');
                return (<div>
                    <VerificationShowSas
                        sas={this.state.sasEvent.sas}
                        onCancel={this._onSasMismatchesClick}
                        onDone={this._onSasMatchesClick}
                    />
                </div>);
            } else {
                return (<p>Setting up SAS verification...</p>);
            }
        } else if (request.done) {
            return <p>verified {request.otherUserId}!!</p>;
        } else if (request.cancelled) {
            return <p>cancelled by {request.cancellingUserId}!</p>;
        }
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
        this.setState({sasWaitingForOtherParty: true});
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
        this.forceUpdate();
    };

    componentDidMount() {
        this.props.request.on("change", this._onRequestChange);
    }

    componentWillUnmount() {
        this.props.request.off("change", this._onRequestChange);
    }
}
