/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Text, type HTMLReactParserOptions } from "html-react-parser";

type Replacer = HTMLReactParserOptions["replace"];

/**
 * Applies a parser replacer to string content while passing through JSX elements unchanged.
 *
 * @param input Plain-text body content or pre-rendered JSX elements (for example emoji bodies).
 * Non-string items are returned verbatim.
 * @param replacer Optional replace callback to run on string items.
 * @returns The original `input` when no replacer is provided; otherwise an array where string
 * items are replaced and JSX elements are passed through unchanged.
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
