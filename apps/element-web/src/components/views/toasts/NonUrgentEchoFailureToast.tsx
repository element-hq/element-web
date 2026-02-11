/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { OfflineIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import Modal from "../../../Modal";
import ServerOfflineDialog from "../dialogs/ServerOfflineDialog";

export default class NonUrgentEchoFailureToast extends React.PureComponent {
    private openDialog = (): void => {
        Modal.createDialog(ServerOfflineDialog, {});
    };

    public render(): React.ReactNode {
        return (
            <div className="mx_NonUrgentEchoFailureToast">
                <OfflineIcon />
                {_t(
                    "error|non_urgent_echo_failure_toast",
                    {},
                    {
                        a: (sub) => (
                            <AccessibleButton kind="link_inline" onClick={this.openDialog}>
                                {sub}
                            </AccessibleButton>
                        ),
                    },
                )}
            </div>
        );
    }
}
