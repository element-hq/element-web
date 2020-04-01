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
import Spinner from "../Spinner";
import * as QRCode from "qrcode";

@replaceableComponent("views.elements.crypto.VerificationQRCode")
export default class VerificationQRCode extends React.PureComponent {
    static propTypes = {
        qrCodeData: PropTypes.object.isRequired,
    };

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
        // Now actually assemble the QR code's data URI
        const uri = await QRCode.toDataURL([{data: this.props.qrCodeData.buffer, mode: 'byte'}], {
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
