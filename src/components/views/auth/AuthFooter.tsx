/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";

export default class AuthFooter extends React.Component {
    public render(): React.ReactNode {
        return (
            <footer className="mx_AuthFooter" role="contentinfo">
                <a href="https://matrix.org" target="_blank" rel="noreferrer noopener">
                    {_t("auth|footer_powered_by_matrix")}
                </a>
            </footer>
        );
    }
}
