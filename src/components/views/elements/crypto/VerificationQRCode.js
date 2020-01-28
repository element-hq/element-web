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
        requestEventId: PropTypes.string,
    };

    static defaultProps = {
        action: "verify",
    };

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

        return <QRCode value={uri} size={256} logoWidth={48} logo={require("../../../../../res/img/matrix-m.svg")} />;
    }
}
