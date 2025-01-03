/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { useEffect, useRef } from "react";

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
     * The type of flex container
     * @default flex
     */
    display?: "flex" | "inline-flex";
    /**
     * The flow direction of the flex children
     * @default row
     */
    direction?: "row" | "column" | "row-reverse" | "column-reverse";
    /**
     * The alingment of the flex children
     * @default start
     */
    align?: "start" | "center" | "end" | "baseline" | "stretch";
    /**
     * The justification of the flex children
     * @default start
     */
    justify?: "start" | "center" | "end" | "space-between";
    /**
     * The spacing between the flex children, expressed with the CSS unit
     * @default 0
     */
    gap?: string;
    /**
     * the on click event callback
     */
    onClick?: (e: React.MouseEvent) => void;
};

/**
 * A flexbox container helper
 */
export function Flex({
    as = "div",
    display = "flex",
    direction = "row",
    align = "start",
    justify = "start",
    gap = "0",
    className,
    children,
    ...props
}: React.PropsWithChildren<FlexProps>): JSX.Element {
    const ref = useRef<HTMLElement>();

    useEffect(() => {
        ref.current!.style.setProperty(`--mx-flex-display`, display);
        ref.current!.style.setProperty(`--mx-flex-direction`, direction);
        ref.current!.style.setProperty(`--mx-flex-align`, align);
        ref.current!.style.setProperty(`--mx-flex-justify`, justify);
        ref.current!.style.setProperty(`--mx-flex-gap`, gap);
    }, [align, direction, display, gap, justify]);

    return React.createElement(as, { ...props, className: classNames("mx_Flex", className), ref }, children);
}
