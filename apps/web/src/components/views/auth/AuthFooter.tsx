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
        { text: "Blog", url: "https://element.io/blog" },
        { text: "Mastodon", url: "https://mastodon.matrix.org/@Element" },
        { text: "GitHub", url: "https://github.com/element-hq/element-web" },
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
            {authFooterLinks}
            <a href="https://matrix.org" target="_blank" rel="noreferrer noopener">
                {_t("powered_by_matrix")}
            </a>
        </footer>
    );
};

export default AuthFooter;
