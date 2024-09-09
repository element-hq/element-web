/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactNode } from "react";

import AuthFooter from "./AuthFooter";

export default class AuthPage extends React.PureComponent<{ children: ReactNode }> {
    public render(): React.ReactNode {
        return (
            <div className="mx_AuthPage">
                <div className="mx_AuthPage_modal">{this.props.children}</div>
                <AuthFooter />
            </div>
        );
    }
}
