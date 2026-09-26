/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, type MouseEvent, useCallback, useEffect, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { MarkdownViewerView, type MarkdownViewerStatus } from "@element-hq/web-shared-components";

import { type MarkdownMedia } from "../../../@types/markdown-viewer";
import { renderMarkdown } from "../../../utils/renderMarkdown";
import { tryTransformPermalinkToLocalHref } from "../../../utils/permalinks/Permalinks";

const loggerMarkdown = logger.getChild("MarkdownViewer");

/**
 * Cap on the attachment. The whole rendered document sits in the DOM for as long as it is open, and
 * the sender chooses how big it is.
 */
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;

/**
 * Renders a Markdown attachment.
 *
 * Loads the file, renders it to sanitized HTML and hands that to the view. Links to rooms, users and
 * messages are followed within the app, as they are in the timeline; the sanitizer already makes every
 * other link open in a new tab.
 */
export function MarkdownViewer({ media }: { media: MarkdownMedia }): JSX.Element {
    const [status, setStatus] = useState<MarkdownViewerStatus>("loading");
    const [html, setHtml] = useState("");

    useEffect(() => {
        setStatus("loading");
        setHtml("");

        let disposed = false;

        const loadDocument = async (): Promise<void> => {
            // The declared size is the sender's claim, but a claim big enough to refuse saves the download.
            if (media.size !== undefined && media.size > MAX_MARKDOWN_BYTES) {
                throw new Error("Markdown attachment is too large");
            }

            const blob = await media.blob();
            if (blob.size === 0) {
                throw new Error("Markdown attachment is empty");
            }
            if (blob.size > MAX_MARKDOWN_BYTES) {
                throw new Error("Markdown attachment is too large");
            }

            const text = new TextDecoder().decode(await blob.arrayBuffer());
            // Text never contains NUL, so a file that does was never Markdown, whatever it was labelled.
            if (text.includes("\0")) {
                throw new Error("Attachment is not a text file");
            }

            if (disposed) return;

            setHtml(renderMarkdown(text));
            setStatus("ready");
        };

        void loadDocument().catch((error: unknown) => {
            if (disposed) return;

            loggerMarkdown.error("Unable to load Markdown file", error);
            setStatus("error");
        });

        return () => {
            disposed = true;
        };
    }, [media]);

    const onContentClick = useCallback((event: MouseEvent<HTMLDivElement>): void => {
        const link = (event.target as HTMLElement).closest("a");
        if (!link) return;

        const localHref = tryTransformPermalinkToLocalHref(link.href);
        if (localHref !== link.href) {
            event.preventDefault();
            window.location.hash = localHref;
        }
    }, []);

    return <MarkdownViewerView status={status} html={html} onContentClick={onContentClick} />;
}
