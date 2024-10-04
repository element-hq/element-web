/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import AuthPage from "../../views/auth/AuthPage";
import CompleteSecurityBody from "../../views/auth/CompleteSecurityBody";
import CreateCrossSigningDialog from "../../views/dialogs/security/CreateCrossSigningDialog";

interface IProps {
    onFinished: () => void;
    accountPassword?: string;
    tokenLogin?: boolean;
}

export default class E2eSetup extends React.Component<IProps> {
    public render(): React.ReactNode {
        return (
            <AuthPage>
                <CompleteSecurityBody>
                    <CreateCrossSigningDialog
                        onFinished={this.props.onFinished}
                        accountPassword={this.props.accountPassword}
                        tokenLogin={this.props.tokenLogin}
                    />
                </CompleteSecurityBody>
            </AuthPage>
        );
    }
}
