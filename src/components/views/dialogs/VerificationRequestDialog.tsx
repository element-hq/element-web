/*
Copyright 2020-2021 The Matrix.org Foundation C.I.C.

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
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { User } from 'matrix-js-sdk/src/models/user';

import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import BaseDialog from "./BaseDialog";
import EncryptionPanel from "../right_panel/EncryptionPanel";

interface IProps {
    verificationRequest: VerificationRequest;
    verificationRequestPromise: Promise<VerificationRequest>;
    onFinished: () => void;
    member: User;
}

interface IState {
    verificationRequest: VerificationRequest;
}

@replaceableComponent("views.dialogs.VerificationRequestDialog")
export default class VerificationRequestDialog extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);
        this.state = {
            verificationRequest: this.props.verificationRequest,
        };
        if (this.props.verificationRequestPromise) {
            this.props.verificationRequestPromise.then(r => {
                this.setState({ verificationRequest: r });
            });
        }
    }

    render() {
        const request = this.state.verificationRequest;
        const otherUserId = request && request.otherUserId;
        const member = this.props.member ||
            otherUserId && MatrixClientPeg.get().getUser(otherUserId);
        const title = request && request.isSelfVerification ?
            _t("Verify other device") : _t("Verification Request");

        return <BaseDialog
            className="mx_InfoDialog"
            onFinished={this.props.onFinished}
            contentId="mx_Dialog_content"
            title={title}
            hasCancel={true}
        >
            <EncryptionPanel
                layout="dialog"
                verificationRequest={this.props.verificationRequest}
                verificationRequestPromise={this.props.verificationRequestPromise}
                onClose={this.props.onFinished}
                member={member}
                isRoomEncrypted={false}
            />
        </BaseDialog>;
    }
}
