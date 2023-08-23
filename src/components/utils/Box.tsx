/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
