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
import {VerificationRequest} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import Spinner from "../elements/Spinner";

@replaceableComponent("views.verification.VerificationQREmojiOptions")
export default class VerificationQREmojiOptions extends React.Component {
    static propTypes = {
        request: PropTypes.object.isRequired,
        onCancel: PropTypes.func.isRequired,
        onStartEmoji: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            qrProps: null,
        };

        this._prepareQrCode(props.request);
    }

    async _prepareQrCode(request: VerificationRequest) {
        try {
            const props = await VerificationQRCode.getPropsForRequest(request);
            this.setState({qrProps: props});
        } catch (e) {
            console.error(e);
            // We just won't show a QR code
        }
    }

    render() {
        let qrCode = <div className='mx_VerificationQREmojiOptions_noQR'><Spinner /></div>;
        if (this.state.qrProps) {
            qrCode = <VerificationQRCode {...this.state.qrProps} />;
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
