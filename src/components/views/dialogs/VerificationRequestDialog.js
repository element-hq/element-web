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
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';

export default class VerificationRequestDialog extends React.Component {
    static propTypes = {
        verificationRequest: PropTypes.object,
        verificationRequestPromise: PropTypes.object,
        onFinished: PropTypes.func.isRequired,
    };

    constructor(...args) {
        super(...args);
        this.onFinished = this.onFinished.bind(this);
    }

    render() {
        const BaseDialog = sdk.getComponent("views.dialogs.BaseDialog");
        const EncryptionPanel = sdk.getComponent("views.right_panel.EncryptionPanel");
        const member = this.props.member ||
            MatrixClientPeg.get().getUser(this.props.verificationRequest.otherUserId);
        return <BaseDialog className="mx_InfoDialog" onFinished={this.onFinished}
                contentId="mx_Dialog_content"
                title={_t("Verification Request")}
                hasCancel={true}
            >
            <EncryptionPanel
                layout="dialog"
                verificationRequest={this.props.verificationRequest}
                verificationRequestPromise={this.props.verificationRequestPromise}
                onClose={this.props.onFinished}
                member={member}
            />
        </BaseDialog>;
    }

    async onFinished() {
        this.props.onFinished();
        let request = this.props.verificationRequest;
        if (!request && this.props.verificationRequestPromise) {
            request = await this.props.verificationRequestPromise;
        }
        request.cancel();
    }
}
