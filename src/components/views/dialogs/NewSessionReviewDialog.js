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
import Modal from '../../../Modal';
import { replaceableComponent } from '../../../utils/replaceableComponent';
import VerificationRequestDialog from './VerificationRequestDialog';
import BaseDialog from './BaseDialog';
import DialogButtons from '../elements/DialogButtons';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import * as sdk from '../../../index';

@replaceableComponent("views.dialogs.NewSessionReviewDialog")
export default class NewSessionReviewDialog extends React.PureComponent {
    static propTypes = {
        userId: PropTypes.string.isRequired,
        device: PropTypes.object.isRequired,
        onFinished: PropTypes.func.isRequired,
    }

    onCancelClick = () => {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog("Verification failed", "insecure", ErrorDialog, {
            headerImage: require("../../../../res/img/e2e/warning.svg"),
            title: _t("Your account is not secure"),
            description: <div>
                {_t("One of the following may be compromised:")}
                <ul>
                    <li>{_t("Your password")}</li>
                    <li>{_t("Your homeserver")}</li>
                    <li>{_t("This session, or the other session")}</li>
                    <li>{_t("The internet connection either session is using")}</li>
                </ul>
                <div>
                    {_t("We recommend you change your password and recovery key in Settings immediately")}
                </div>
            </div>,
            onFinished: () => this.props.onFinished(false),
        });
    }

    onContinueClick = () => {
        const { userId, device } = this.props;
        const cli = MatrixClientPeg.get();
        const requestPromise = cli.requestVerification(
            userId,
            [device.deviceId],
        );

        this.props.onFinished(true);
        Modal.createTrackedDialog('New Session Verification', 'Starting dialog', VerificationRequestDialog, {
            verificationRequestPromise: requestPromise,
            member: cli.getUser(userId),
        });
    }

    render() {
        const { device } = this.props;

        const icon = <span className="mx_NewSessionReviewDialog_headerIcon mx_E2EIcon_warning"></span>;
        const titleText = _t("New session");

        const title = <h2 className="mx_NewSessionReviewDialog_header">
            {icon}
            {titleText}
        </h2>;

        return (
            <BaseDialog
                title={title}
                onFinished={this.props.onFinished}
            >
                <div className="mx_NewSessionReviewDialog_body">
                    <p>{_t(
                        "Use this session to verify your new one, " +
                        "granting it access to encrypted messages:",
                    )}</p>
                    <div className="mx_NewSessionReviewDialog_deviceInfo">
                        <div>
                            <span className="mx_NewSessionReviewDialog_deviceName">
                                {device.getDisplayName()}
                            </span> <span className="mx_NewSessionReviewDialog_deviceID">
                                ({device.deviceId})
                            </span>
                        </div>
                    </div>
                    <p>{_t(
                        "If you didn’t sign in to this session, " +
                        "your account may be compromised.",
                    )}</p>
                    <DialogButtons
                        cancelButton={_t("This wasn't me")}
                        cancelButtonClass="danger"
                        primaryButton={_t("Continue")}
                        onCancel={this.onCancelClick}
                        onPrimaryButtonClick={this.onContinueClick}
                    />
                </div>
            </BaseDialog>
        );
    }
}
