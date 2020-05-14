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

import React from 'react';
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import AccessibleButton from "../elements/AccessibleButton";
import {replaceableComponent} from "../../../utils/replaceableComponent";
import VerificationQRCode from "../elements/crypto/VerificationQRCode";
import Spinner from "../elements/Spinner";
import {SCAN_QR_CODE_METHOD} from "matrix-js-sdk/src/crypto/verification/QRCode";

@replaceableComponent("views.verification.VerificationQREmojiOptions")
export default class VerificationQREmojiOptions extends React.Component {
    static propTypes = {
        request: PropTypes.object.isRequired,
        onCancel: PropTypes.func.isRequired,
        onStartEmoji: PropTypes.func.isRequired,
    };

    render() {
        const {request} = this.props;
        const showQR = request.otherPartySupportsMethod(SCAN_QR_CODE_METHOD);

        let qrCode;
        if (showQR) {
            qrCode = <VerificationQRCode qrCodeData={request.qrCodeData} />;
        } else {
            qrCode = <div className='mx_VerificationQREmojiOptions_noQR'><Spinner /></div>;
        }

        return (
            <div>
                {_t("Verify this session by completing one of the following:")}
                <div className='mx_IncomingSasDialog_startOptions'>
                    <div className='mx_IncomingSasDialog_startOption'>
                        <p>{_t("Scan this unique code")}</p>
                        {qrCode}
                    </div>
                    <div className='mx_IncomingSasDialog_betweenText'>{_t("or")}</div>
                    <div className='mx_IncomingSasDialog_startOption'>
                        <p>{_t("Compare unique emoji")}</p>
                        <span className='mx_IncomingSasDialog_helpText'>{_t("Compare a unique set of emoji if you don't have a camera on either device")}</span>
                        <AccessibleButton onClick={this.props.onStartEmoji} kind='primary'>
                            {_t("Start")}
                        </AccessibleButton>
                    </div>
                </div>
                <AccessibleButton onClick={this.props.onCancel} kind='danger'>
                    {_t("Cancel")}
                </AccessibleButton>
            </div>
        );
    }
}
