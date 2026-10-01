/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLAttributes } from "react";

export interface SettingsIndentProps extends HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
}

export const SettingsIndent: React.FC<SettingsIndentProps> = ({ children, ...rest }) => (
    <div {...rest} className="mx_SettingsIndent">
        {children}
    </div>
);
