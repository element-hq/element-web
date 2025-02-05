/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type VerificationRequest } from "matrix-js-sdk/src/crypto-api";
import { type User } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import EncryptionPanel from "../right_panel/EncryptionPanel";

interface IProps {
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
    onFinished: () => void;
    member?: User;
}

interface IState {
    verificationRequest?: VerificationRequest;
}

export default class VerificationRequestDialog extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            verificationRequest: this.props.verificationRequest,
        };
    }

    public componentDidMount(): void {
        this.props.verificationRequestPromise?.then((r) => {
            this.setState({ verificationRequest: r });
        });
    }

    public render(): React.ReactNode {
        const request = this.state.verificationRequest;
        const otherUserId = request?.otherUserId;
        const member = this.props.member || (otherUserId ? MatrixClientPeg.safeGet().getUser(otherUserId) : null);
        const title = request?.isSelfVerification
            ? _t("encryption|verification|verification_dialog_title_device")
            : _t("encryption|verification|verification_dialog_title_user");

        if (!member) return null;

        return (
            <BaseDialog
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
            </BaseDialog>
        );
    }
}
