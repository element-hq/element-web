/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "./AccessibleButton";

interface IProps {
    // Callback for when the button is pressed
    onBackspacePress: (ev: ButtonEvent) => void;
}

export default class DialPadBackspaceButton extends React.PureComponent<IProps> {
    public render(): React.ReactNode {
        return (
            <div className="mx_DialPadBackspaceButtonWrapper">
                <AccessibleButton
                    className="mx_DialPadBackspaceButton"
                    onClick={this.props.onBackspacePress}
                    aria-label={_t("keyboard|backspace")}
                />
            </div>
        );
    }
}
