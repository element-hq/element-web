/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import SdkConfig from "../../../SdkConfig";

export default class AuthHeaderLogo extends React.PureComponent {
    public render(): React.ReactElement {
        const brandingConfig = SdkConfig.getObject("branding");
        const logoUrl = brandingConfig?.get("auth_header_logo_url") ?? "themes/element/img/logos/element-logo.svg";

        return (
            <aside className="mx_AuthHeaderLogo">
                <img src={logoUrl} alt="Element" />
            </aside>
        );
    }
}
