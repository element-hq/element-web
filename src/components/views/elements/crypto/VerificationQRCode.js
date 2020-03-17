/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from "react";
import PropTypes from "prop-types";
import {replaceableComponent} from "../../../../utils/replaceableComponent";
import {MatrixClientPeg} from "../../../../MatrixClientPeg";
import {VerificationRequest} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import {ToDeviceChannel} from "matrix-js-sdk/src/crypto/verification/request/ToDeviceChannel";
import {decodeBase64} from "matrix-js-sdk/src/crypto/olmlib";
import Spinner from "../Spinner";
import * as QRCode from "qrcode";

const CODE_VERSION = 0x02; // the version of binary QR codes we support
const BINARY_PREFIX = "MATRIX"; // ASCII, used to prefix the binary format
const MODE_VERIFY_OTHER_USER = 0x00; // Verifying someone who isn't us
const MODE_VERIFY_SELF_TRUSTED = 0x01; // We trust the master key
const MODE_VERIFY_SELF_UNTRUSTED = 0x02; // We do not trust the master key

@replaceableComponent("views.elements.crypto.VerificationQRCode")
export default class VerificationQRCode extends React.PureComponent {
    static propTypes = {
        prefix: PropTypes.string.isRequired,
        version: PropTypes.number.isRequired,
        mode: PropTypes.number.isRequired,
        transactionId: PropTypes.string.isRequired, // or requestEventId
        firstKeyB64: PropTypes.string.isRequired,
        secondKeyB64: PropTypes.string.isRequired,
        secretB64: PropTypes.string.isRequired,
    };

    static async getPropsForRequest(verificationRequest: VerificationRequest) {
        const cli = MatrixClientPeg.get();
        const myUserId = cli.getUserId();
        const otherUserId = verificationRequest.otherUserId;

        let mode = MODE_VERIFY_OTHER_USER;
        if (myUserId === otherUserId) {
            // Mode changes depending on whether or not we trust the master cross signing key
            const myTrust = cli.checkUserTrust(myUserId);
            if (myTrust.isCrossSigningVerified()) {
                mode = MODE_VERIFY_SELF_TRUSTED;
            } else {
                mode = MODE_VERIFY_SELF_UNTRUSTED;
            }
        }

        const requestEvent = verificationRequest.requestEvent;
        const transactionId = requestEvent.getId()
            ? requestEvent.getId()
            : ToDeviceChannel.getTransactionId(requestEvent);

        const qrProps = {
            prefix: BINARY_PREFIX,
            version: CODE_VERSION,
            mode,
            transactionId,
            firstKeyB64: '', // worked out shortly
            secondKeyB64: '', // worked out shortly
            secretB64: verificationRequest.encodedSharedSecret,
        };

        const myCrossSigningInfo = cli.getStoredCrossSigningForUser(myUserId);
        const myDevices = (await cli.getStoredDevicesForUser(myUserId)) || [];

        if (mode === MODE_VERIFY_OTHER_USER) {
            // First key is our master cross signing key
            qrProps.firstKeyB64 = myCrossSigningInfo.getId("master");

            // Second key is the other user's master cross signing key
            const otherUserCrossSigningInfo = cli.getStoredCrossSigningForUser(otherUserId);
            qrProps.secondKeyB64 = otherUserCrossSigningInfo.getId("master");
        } else if (mode === MODE_VERIFY_SELF_TRUSTED) {
            // First key is our master cross signing key
            qrProps.firstKeyB64 = myCrossSigningInfo.getId("master");

            // Second key is the other device's device key
            const otherDevice = verificationRequest.targetDevice;
            const otherDeviceId = otherDevice ? otherDevice.deviceId : null;
            const device = myDevices.find(d => d.deviceId === otherDeviceId);
            qrProps.secondKeyB64 = device.getFingerprint();
        } else if (mode === MODE_VERIFY_SELF_UNTRUSTED) {
            // First key is our device's key
            qrProps.firstKeyB64 = cli.getDeviceEd25519Key();

            // Second key is what we think our master cross signing key is
            qrProps.secondKeyB64 = myCrossSigningInfo.getId("master");
        }

        return qrProps;
    }

    constructor(props) {
        super(props);

        this.state = {
            dataUri: null,
        };
        this.generateQrCode();
    }

    componentDidUpdate(prevProps): void {
        if (JSON.stringify(this.props) === JSON.stringify(prevProps)) return; // No prop change

        this.generateQRCode();
    }

    async generateQrCode() {
        let buf = Buffer.alloc(0); // we'll concat our way through life

        const appendByte = (b: number) => {
            const tmpBuf = Buffer.from([b]);
            buf = Buffer.concat([buf, tmpBuf]);
        };
        const appendInt = (i: number) => {
            const tmpBuf = Buffer.alloc(2);
            tmpBuf.writeInt16BE(i, 0);
            buf = Buffer.concat([buf, tmpBuf]);
        };
        const appendStr = (s: string, enc: string, withLengthPrefix = true) => {
            const tmpBuf = Buffer.from(s, enc);
            if (withLengthPrefix) appendInt(tmpBuf.byteLength);
            buf = Buffer.concat([buf, tmpBuf]);
        };
        const appendEncBase64 = (b64: string) => {
            const b = decodeBase64(b64);
            const tmpBuf = Buffer.from(b);
            buf = Buffer.concat([buf, tmpBuf]);
        };

        // Actually build the buffer for the QR code
        appendStr(this.props.prefix, "ascii", false);
        appendByte(this.props.version);
        appendByte(this.props.mode);
        appendStr(this.props.transactionId, "utf-8");
        appendEncBase64(this.props.firstKeyB64);
        appendEncBase64(this.props.secondKeyB64);
        appendEncBase64(this.props.secretB64);

        // Now actually assemble the QR code's data URI
        const uri = await QRCode.toDataURL([{data: buf, mode: 'byte'}], {
            errorCorrectionLevel: 'L', // we want it as trivial-looking as possible
        });
        this.setState({dataUri: uri});
    }

    render() {
        if (!this.state.dataUri) {
            return <div className='mx_VerificationQRCode'><Spinner /></div>;
        }

        return <img src={this.state.dataUri} className='mx_VerificationQRCode' />;
    }
}
