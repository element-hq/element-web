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
import * as qs from "qs";
import QRCode from "qrcode-react";
import {MatrixClientPeg} from "../../../../MatrixClientPeg";
import {VerificationRequest} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import {ToDeviceChannel} from "matrix-js-sdk/src/crypto/verification/request/ToDeviceChannel";

@replaceableComponent("views.elements.crypto.VerificationQRCode")
export default class VerificationQRCode extends React.PureComponent {
    static propTypes = {
        // Common for all kinds of QR codes
        keys: PropTypes.array.isRequired, // array of [Key ID, Base64 Key] pairs
        action: PropTypes.string.isRequired,
        keyholderUserId: PropTypes.string.isRequired,

        // User verification use case only
        secret: PropTypes.string,
        otherUserKey: PropTypes.string, // Base64 key being verified
        otherUserDeviceKey: PropTypes.string, // Base64 key of the other user's device (or what we think it is; optional)
        requestEventId: PropTypes.string, // for DM verification only
    };

    static defaultProps = {
        action: "verify",
    };

    static async getPropsForRequest(verificationRequest: VerificationRequest) {
        const cli = MatrixClientPeg.get();
        const myUserId = cli.getUserId();
        const otherUserId = verificationRequest.otherUserId;
        const myDeviceId = cli.getDeviceId();
        const otherDevice = verificationRequest.targetDevice;
        const otherDeviceId = otherDevice ? otherDevice.deviceId : null;

        const qrProps = {
            secret: verificationRequest.encodedSharedSecret,
            keyholderUserId: myUserId,
            action: "verify",
            keys: [], // array of pairs: keyId, base64Key
            otherUserKey: "", // base64key
            otherUserDeviceKey: "", // base64key
            requestEventId: "", // we figure this out in a moment
        };

        const requestEvent = verificationRequest.requestEvent;
        qrProps.requestEventId = requestEvent.getId()
            ? requestEvent.getId()
            : ToDeviceChannel.getTransactionId(requestEvent);

        // Populate the keys we need depending on which direction and users are involved in the verification.
        if (myUserId === otherUserId) {
            if (!otherDeviceId) {
                // Existing scanning New session's QR code
                qrProps.otherUserDeviceKey = null;
            } else {
                // New scanning Existing session's QR code
                const myDevices = (await cli.getStoredDevicesForUser(myUserId)) || [];
                const device = myDevices.find(d => d.deviceId === otherDeviceId);
                if (device) qrProps.otherUserDeviceKey = device.getFingerprint();
            }

            // Either direction shares these next few props

            const xsignInfo = cli.getStoredCrossSigningForUser(myUserId);
            qrProps.otherUserKey = xsignInfo.getId("master");

            qrProps.keys = [
                [myDeviceId, cli.getDeviceEd25519Key()],
                [xsignInfo.getId("master"), xsignInfo.getId("master")],
            ];
        } else {
            // Doesn't matter which direction the verification is, we always show the same QR code
            // for not-ourself verification.
            const myXsignInfo = cli.getStoredCrossSigningForUser(myUserId);
            const otherXsignInfo = cli.getStoredCrossSigningForUser(otherUserId);
            const otherDevices = (await cli.getStoredDevicesForUser(otherUserId)) || [];
            const otherDevice = otherDevices.find(d => d.deviceId === otherDeviceId);

            qrProps.keys = [
                [myDeviceId, cli.getDeviceEd25519Key()],
                [myXsignInfo.getId("master"), myXsignInfo.getId("master")],
            ];
            qrProps.otherUserKey = otherXsignInfo.getId("master");
            if (otherDevice) qrProps.otherUserDeviceKey = otherDevice.getFingerprint();
        }

        return qrProps;
    }

    constructor(props) {
        super(props);
    }

    render() {
        const query = {
            request: this.props.requestEventId,
            action: this.props.action,
            other_user_key: this.props.otherUserKey,
            secret: this.props.secret,
        };
        for (const key of this.props.keys) {
            query[`key_${key[0]}`] = key[1];
        }

        const uri = `https://matrix.to/#/${this.props.keyholderUserId}?${qs.stringify(query)}`;

        return <QRCode value={uri} size={512} logoWidth={64} logo={require("../../../../../res/img/matrix-m.svg")} />;
    }
}
