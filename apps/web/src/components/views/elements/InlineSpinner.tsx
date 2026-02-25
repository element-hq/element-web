/*
Copyright 2017-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { InlineSpinner as BaseInlineSpinner } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";

interface IProps {
    size?: number;
}

export default class InlineSpinner extends React.PureComponent<IProps> {
    public static defaultProps = {
        w: 16,
        h: 16,
    };

    public render(): React.ReactNode {
        return (
            <span className="mx_InlineSpinner">
                <BaseInlineSpinner
                    size={this.props.size}
                    aria-label={_t("common|loading")}
                    role="progressbar"
                    data-testid="spinner"
                />
            </span>
        );
    }
}
