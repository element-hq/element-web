/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { InlineSpinner } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";

interface IProps {
    size?: number;
    message?: string;
    onFinished: any; // XXX: Spinner pretends to be a dialog so it must accept an onFinished, but it never calls it
}

export default class Spinner extends React.PureComponent<IProps> {
    public static defaultProps: Partial<IProps> = {
        size: 32,
    };

    public render(): React.ReactNode {
        const { size, message } = this.props;
        return (
            <div className="mx_Spinner">
                {message && (
                    <React.Fragment>
                        <div className="mx_Spinner_Msg">{message}</div>&nbsp;
                    </React.Fragment>
                )}
                <InlineSpinner size={size} aria-label={_t("common|loading")} role="progressbar" data-testid="spinner" />
            </div>
        );
    }
}
