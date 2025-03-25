/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement, useMemo } from "react";
import sanitizeHtml from "sanitize-html";
import _Linkify from "linkify-react";

import { _linkifyString, options as linkifyMatrixOptions } from "./linkify-matrix";
import { sanitizeHtmlParams } from "./sanitiseHtml.ts";

/* Wrapper around linkify-react merging in our default linkify options */
export function Linkify({ as, options, children }: React.ComponentProps<typeof _Linkify>): ReactElement {
    const opts = useMemo(
        () => ({
            ...linkifyMatrixOptions,
            ...options,
        }),
        [options],
    );
    return (
        <_Linkify as={as} options={opts}>
            {children}
        </_Linkify>
    );
}

/**
 * Linkifies the given string. This is a wrapper around 'linkifyjs/string'.
 *
 * @param {string} str string to linkify
 * @param {object} [options] Options for linkifyString. Default: linkifyMatrixOptions
 * @returns {string} Linkified string
 */
export function linkifyString(str: string, options = linkifyMatrixOptions): string {
    return _linkifyString(str, options);
}

/**
 * Linkify the given string and sanitize the HTML afterwards.
 *
 * @param {string} dirtyHtml The HTML string to sanitize and linkify
 * @param {object} [options] Options for linkifyString. Default: linkifyMatrixOptions
 * @returns {string}
 */
export function linkifyAndSanitizeHtml(dirtyHtml: string, options = linkifyMatrixOptions): string {
    return sanitizeHtml(linkifyString(dirtyHtml, options), sanitizeHtmlParams);
}
