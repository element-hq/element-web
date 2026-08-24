/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";
import sanitizeHtml, { type IOptions } from "sanitize-html";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../languageHandler";
import Spinner from "../Spinner";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { presentableTextForFile } from "../../../../utils/FileUtils";
import MediaPreviewShell from "./MediaPreviewShell";
import { PreviewError } from "./PreviewError";
import { ZoomControls, MAX_ZOOM, MIN_ZOOM, useZoom } from "./ZoomControls";
import { useMediaBytes } from "./useMediaBytes";
import { usePreviewChat } from "./usePreviewChat";

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
    allowProtocolRelative: false,
    transformTags: {
        a: (tagName, attribs) => {
            if (!attribs.href) delete attribs.href;
            return { tagName, attribs: { ...attribs, target: "_blank", rel: "noreferrer noopener" } };
        },
    },
};

interface Props {
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    onFinished: () => void;
}

/**
 * Previews a Word (.docx) document by converting it to HTML with mammoth.
 *
 * This is a best-effort text-and-structure view rather than a faithful reproduction of Word's
 * layout: mammoth maps styles onto semantic HTML, so headings, lists, tables and inline images
 * survive while precise positioning, columns and headers/footers do not.
 */
export default function DocxPreview({ mxEvent, permalinkCreator, onFinished }: Props): JSX.Element {
    const { data, error: fetchError, helper } = useMediaBytes(mxEvent);
    const { zoom, zoomIn, zoomOut } = useZoom();
    const chat = usePreviewChat(mxEvent);
    const [html, setHtml] = useState<string | null>(null);
    const [convertError, setConvertError] = useState<unknown>(null);

    useEffect(() => {
        if (!data) return;
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
                setConvertError(err);
            });

        return () => {
            cancelled = true;
        };
    }, [data]);

    const error = fetchError ?? convertError;

    let body: JSX.Element;
    if (error) {
        body = <PreviewError />;
    } else if (html === null) {
        body = <Spinner />;
    } else {
        body = (
            <div className="mx_DocxPreview" style={{ fontSize: `${zoom}rem` }}>
                {/* The HTML has been through the allowlist above and contains no scriptable content. */}
                <div className="mx_DocxPreview_page" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
        );
    }

    return (
        <MediaPreviewShell
            label={_t("media_preview|title")}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            title={presentableTextForFile(mxEvent.getContent<MediaEventContent>(), _t("common|attachment"), true)}
            downloadUrl={helper.media.srcHttp ?? ""}
            downloadName={helper.fileName}
            toolbar={<ZoomControls zoom={zoom} zoomIn={zoomIn} zoomOut={zoomOut} min={MIN_ZOOM} max={MAX_ZOOM} />}
            chat={chat}
            onFinished={onFinished}
        >
            {body}
        </MediaPreviewShell>
    );
}
