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

export default class VerificationComplete extends React.Component<IProps> {
    public render(): React.ReactNode {
        return (
            <div>
                <h2>{_t("encryption|verification|complete_title")}</h2>
                <p>{_t("encryption|verification|complete_description")}</p>
                <p>{_t("encryption|verification|explainer")}</p>
                <DialogButtons
                    onPrimaryButtonClick={this.props.onDone}
                    primaryButton={_t("encryption|verification|complete_action")}
                    hasCancel={false}
                />
            </div>
        );
    }
}
