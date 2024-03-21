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
