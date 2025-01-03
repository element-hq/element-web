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
 * Set or remove a CSS property
 * @param ref the reference
 * @param name the CSS property name
 * @param value the CSS property value
 */
function addOrRemoveProperty(
    ref: React.MutableRefObject<HTMLElement | undefined>,
    name: string,
    value?: string | null,
): void {
    const style = ref.current!.style;
    if (value) {
        style.setProperty(name, value);
    } else {
        style.removeProperty(name);
    }
}

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
    const ref = useRef<HTMLElement>();

    useEffect(() => {
        addOrRemoveProperty(ref, `--mx-box-flex`, flex);
        addOrRemoveProperty(ref, `--mx-box-shrink`, shrink);
        addOrRemoveProperty(ref, `--mx-box-grow`, grow);
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
            ref,
        },
        children,
    );
}
