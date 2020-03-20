/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import * as sdk from '../../../index';
import * as FormattingUtils from '../../../utils/FormattingUtils';
import { _t } from '../../../languageHandler';

export default class ManualDeviceKeyVerificationDialog extends React.Component {
    static propTypes = {
        userId: PropTypes.string.isRequired,
        device: PropTypes.object.isRequired,
        onFinished: PropTypes.func.isRequired,
    };

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

    render() {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");

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
}
