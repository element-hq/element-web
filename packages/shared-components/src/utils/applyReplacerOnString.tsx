/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Text, type HTMLReactParserOptions } from "html-react-parser";

type Replacer = HTMLReactParserOptions["replace"];

/**
 * Passes through any non-string inputs verbatim, as such they should only be used for emoji bodies.
 */
export function applyReplacerOnString(
    input: string | JSX.Element[],
    replacer?: Replacer,
): JSX.Element | JSX.Element[] | string {
    if (!replacer) return input;

    const arr = Array.isArray(input) ? input : [input];
    return arr.map((item, index): JSX.Element => {
        if (typeof item === "string") {
            return <React.Fragment key={index}>{(replacer(new Text(item), 0) as JSX.Element) || item}</React.Fragment>;
        }
        return item;
    });
}
