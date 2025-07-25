/*
Copyright 2025 Keypair Establishment.
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type PropsWithChildren } from "react";
import { _t } from "../../../../shared-components/i18n";

interface Props {}

export default function AuthBody({ children }: PropsWithChildren<Props>): JSX.Element {
    return (
        <div className="qc_AuthPage">
            <a href="https://element.io" target="_blank" rel="noopener noreferrer">
                <img src="welcome/images/geometry.png" alt="Element Logo" />
            </a>
            <span className="qc_Header_title">
                {_t("auth|header")}
            </span>
            <div className="qc_Header_subtitle">
                {_t("auth|description")}
            </div>

            <div className="qc_ButtonGroup">
                <div className="mx_ButtonRow">{children}</div>
            </div>
        </div>
    );
}
