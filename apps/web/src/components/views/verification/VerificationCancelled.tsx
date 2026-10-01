/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    onDone: () => void;
}

export default class VerificationCancelled extends React.Component<IProps> {
    public render(): React.ReactNode {
        return (
            <div>
                <p>{_t("encryption|verification|other_party_cancelled")}</p>
                <DialogButtons
                    primaryButton={_t("action|ok")}
                    hasCancel={false}
                    onPrimaryButtonClick={this.props.onDone}
                />
            </div>
        );
    }
}
