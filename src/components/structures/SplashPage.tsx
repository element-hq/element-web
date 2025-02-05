/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type DetailedHTMLProps, type HTMLAttributes, type ReactNode } from "react";

interface Props extends DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> {
    className?: string;
    children?: ReactNode;
}

export default function SplashPage({ children, className, ...other }: Props): JSX.Element {
    const classes = classNames(className, "mx_SplashPage");
    return (
        <main {...other} className={classes}>
            {children}
        </main>
    );
}
