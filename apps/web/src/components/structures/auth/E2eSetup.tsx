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
    /** Callback which is called if the crypto setup failed, and the user clicked the 'cancel' button */
    onCancelled: () => void;
}

/**
 * An {@link AuthPage} which shows the {@link InitialCryptoSetupDialog}.
 */
export default class E2eSetup extends React.Component<IProps> {
    public render(): React.ReactNode {
        return (
            <AuthPage>
                <CompleteSecurityBody>
                    <InitialCryptoSetupDialog onCancelled={this.props.onCancelled} />
                </CompleteSecurityBody>
            </AuthPage>
        );
    }
}
