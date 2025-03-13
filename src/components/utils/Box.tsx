/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { useMemo } from "react";

type FlexProps = {
    /**
     * The type of the HTML element
     * @default div
     */
    as?: string;
    /**
     * The CSS class name.
     */
    className?: string;
    /**
     * the on click event callback
     */
    onClick?: (e: React.MouseEvent) => void;
    /**
     * The flex space to use
     * @default null
     */
    flex?: string | null;
    /**
     * The flex shrink factor
     * @default null
     */
    shrink?: string | null;
    /**
     * The flex grow factor
     * @default null
     */
    grow?: string | null;
};

/**
 * A flex child helper
 */
export function Box({
    as = "div",
    flex = null,
    shrink = null,
    grow = null,
    className,
    children,
    ...props
}: React.PropsWithChildren<FlexProps>): JSX.Element {
    const style = useMemo(() => {
        const style: Record<string, any> = {};
        if (flex) style["--mx-box-flex"] = flex;
        if (shrink) style["--mx-box-shrink"] = shrink;
        if (grow) style["--mx-box-grow"] = grow;
        return style;
    }, [flex, grow, shrink]);

    return React.createElement(
        as,
        {
            ...props,
            className: classNames("mx_Box", className, {
                "mx_Box--flex": !!flex,
                "mx_Box--shrink": !!shrink,
                "mx_Box--grow": !!grow,
            }),
            style,
        },
        children,
    );
}
