/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";

import LanguageSelector from "./LanguageSelector";

interface Props {
    disableLanguageSelector?: boolean;
}

const AuthFooter = ({ disableLanguageSelector }: Props): ReactElement => {
    return (
        <footer
            className="relative flex w-full items-center justify-center py-5 text-center"
            style={{ font: "var(--cpd-font-body-md-regular)" }}
            role="contentinfo"
        >
            <a
                href="https://nextkakao.com"
                target="_blank"
                rel="noreferrer noopener"
                className="mx-[22px] text-[#2e2f32]!"
            >
                Team
            </a>
            <div className="absolute right-10">
                <div className="py-0">
                    <LanguageSelector disabled={disableLanguageSelector} />
                </div>
            </div>
        </footer>
    );
};

export default AuthFooter;
