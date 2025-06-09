/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactElement } from "react";

import SdkConfig from "../../../SdkConfig";
import { _t } from "../../../languageHandler";

const AuthFooter = (): ReactElement => {
    const brandingConfig = SdkConfig.getObject("branding");
    const links = brandingConfig?.get("auth_footer_links") ?? [
    ];

    const authFooterLinks: JSX.Element[] = [];
    for (const linkEntry of links) {
        authFooterLinks.push(
            <a href={linkEntry.url} key={linkEntry.text} target="_blank" rel="noreferrer noopener">
                {linkEntry.text}
            </a>,
        );
    }

    return (
        <footer className="mx_AuthFooter" role="contentinfo">
            <a href="https://socjsc.com" style={{ cursor: "default"}} target="_blank" rel="noreferrer noopener">Copyright © <span  style={{ color: "white", cursor: "pointer" }}>SOC JSC</span></a>
        </footer>
    );
};

export default AuthFooter;
