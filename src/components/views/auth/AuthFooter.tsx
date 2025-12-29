/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";

const AuthFooter = (): ReactElement => {
    return (
        <footer className="mx_AuthFooter" role="contentinfo">
            <a href="https://nextkakao.com" target="_blank" rel="noreferrer noopener">
                Team
            </a>
        </footer>
    );
};

export default AuthFooter;
