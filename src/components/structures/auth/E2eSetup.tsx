/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import AuthPage from "../../views/auth/AuthPage";
import CompleteSecurityBody from "../../views/auth/CompleteSecurityBody";
import { InitialCryptoSetupDialog } from "../../views/dialogs/security/InitialCryptoSetupDialog";

interface IProps {
    onFinished: () => void;
}

export default class E2eSetup extends React.Component<IProps> {
    public render(): React.ReactNode {
        return (
            <AuthPage>
                <CompleteSecurityBody>
                    <InitialCryptoSetupDialog onFinished={this.props.onFinished} />
                </CompleteSecurityBody>
            </AuthPage>
        );
    }
}
