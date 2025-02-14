/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLAttributes } from "react";
import classNames from "classnames";

type Size = "1" | "2" | "3" | "4";

type HTMLHeadingTags = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
    /**
     * Defines the type of heading used
     */
    as?: HTMLHeadingTags;
    /**
     * Defines the appearance of the heading
     * Falls back to the type of heading used if `as` is not provided
     */
    size: Size;
}

const Heading: React.FC<HeadingProps> = ({ as, size = "1", className, children, ...rest }) =>
    React.createElement(as || `h${size}`, {
        ...rest,
        className: classNames(`mx_Heading_h${size}`, className),
        children,
    });

export default Heading;
