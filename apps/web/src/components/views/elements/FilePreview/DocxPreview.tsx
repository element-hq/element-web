/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";
import sanitizeHtml, { type IOptions } from "sanitize-html";
import { logger } from "matrix-js-sdk/src/logger";

import Spinner from "../Spinner";

interface Props {
    /** The raw file contents, already decrypted where applicable. */
    data: ArrayBuffer;
    /** Scale multiplier applied to the rendered document. */
    zoom: number;
    /** Called when the document could not be converted at all. */
    onError: (error: unknown) => void;
}

/**
 * mammoth emits a small, predictable subset of HTML, so rather than reusing the message
 * sanitiser (which is tuned for Matrix content such as `mxc://` images and pills) we allow
 * exactly what a converted document can contain and nothing else.
 *
 * Images arrive as base64 `data:` URIs embedded by mammoth. Those cannot execute script, but
 * every other scheme — and every other tag — is dropped.
 */
const SANITIZE_OPTIONS: IOptions = {
    allowedTags: [
        "p",
        "br",
        "hr",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "sup",
        "sub",
        "span",
        "ul",
        "ol",
        "li",
        "blockquote",
        "pre",
        "code",
        "table",
        "thead",
        "tbody",
        "tfoot",
        "tr",
        "th",
        "td",
        "a",
        "img",
    ],
    allowedAttributes: {
        a: ["href", "title"],
        img: ["src", "alt", "width", "height"],
        th: ["colspan", "rowspan"],
        td: ["colspan", "rowspan"],
    },
    allowedSchemes: [],
    allowedSchemesByTag: {
        a: ["http", "https", "mailto"],
        img: ["data"],
    },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    // Disallow anything that could smuggle script or layout in via attributes.
    allowProtocolRelative: false,
    transformTags: {
        a: (tagName, attribs) => {
            if (!attribs.href) delete attribs.href;
            return { tagName, attribs: { ...attribs, target: "_blank", rel: "noreferrer noopener" } };
        },
    },
};

/**
 * Renders a Word (.docx) document by converting it to HTML with mammoth.
 *
 * This is a best-effort text-and-structure view rather than a faithful reproduction of Word's
 * layout: mammoth maps styles onto semantic HTML, so headings, lists, tables and inline images
 * survive while precise positioning, columns and headers/footers do not.
 */
export function DocxPreview({ data, zoom, onError }: Props): JSX.Element {
    const [html, setHtml] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        // mammoth pulls in a zip reader and an XML parser, so keep it out of the main bundle.
        import(/* webpackChunkName: "mammoth" */ "mammoth")
            .then((mammoth) => mammoth.convertToHtml({ arrayBuffer: data }))
            .then((result) => {
                if (cancelled) return;
                for (const message of result.messages) {
                    logger.debug(`docx preview: ${message.type}: ${message.message}`);
                }
                setHtml(sanitizeHtml(result.value, SANITIZE_OPTIONS));
            })
            .catch((err) => {
                if (cancelled) return;
                logger.error("Failed to convert docx for preview", err);
                onError(err);
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    if (html === null) return <Spinner />;

    return (
        <div className="mx_DocxPreview" style={{ fontSize: `${zoom}rem` }}>
            {/* The HTML has been through the allowlist above and contains no scriptable content. */}
            <div className="mx_DocxPreview_page" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
}
