/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type JSX, type PropsWithChildren } from "react";

interface Props {
    className?: string;
    flex?: boolean;
}

export default function AuthBody({ flex, className, children }: PropsWithChildren<Props>): JSX.Element {
    return <main className={classNames("mx_AuthBody", className, { mx_AuthBody_flex: flex })}>{children}</main>;
}
