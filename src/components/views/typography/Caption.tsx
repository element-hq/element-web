/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type HTMLAttributes } from "react";

interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, "className"> {
    children: React.ReactNode;
    isError?: boolean;
}

export const Caption: React.FC<Props> = ({ children, isError, ...rest }) => {
    return (
        <span
            className={classNames("mx_Caption", {
                mx_Caption_error: isError,
            })}
            {...rest}
        >
            {children}
        </span>
    );
};
