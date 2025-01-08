/*
Copyright 2017-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";

interface IProps {
    w?: number;
    h?: number;
    children?: React.ReactNode;
}

export default class InlineSpinner extends React.PureComponent<IProps> {
    public static defaultProps = {
        w: 16,
        h: 16,
    };

    public render(): React.ReactNode {
        return (
            <div className="mx_InlineSpinner">
                <div
                    className="mx_InlineSpinner_icon mx_Spinner_icon"
                    style={{ width: this.props.w, height: this.props.h }}
                    aria-label={_t("common|loading")}
                >
                    {this.props.children}
                </div>
            </div>
        );
    }
}
