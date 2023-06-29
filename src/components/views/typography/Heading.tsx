/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { HTMLAttributes } from "react";
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
