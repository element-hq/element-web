/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, type MouseEventHandler } from "react";

import { DocumentViewerView, type DocumentViewerStatus } from "../DocumentViewerView";
import styles from "./MarkdownViewerView.module.css";

/** The document lifecycle state presented by the Markdown viewer. */
export type MarkdownViewerStatus = DocumentViewerStatus;

/** Props for {@link MarkdownViewerView}. */
export interface MarkdownViewerViewProps {
    /** The lifecycle state currently presented. */
    status: MarkdownViewerStatus;
    /**
     * The rendered document. This is inserted into the DOM as-is, so the host must have sanitized it
     * already; the view does nothing to make it safe.
     */
    html: string;
    /** Called for clicks anywhere in the document, so the host can route the links it handles itself. */
    onContentClick?: MouseEventHandler<HTMLDivElement>;
    /** Optional CSS class for host-level styling, applied to the outer element. */
    className?: string;
}

/**
 * Renders a Markdown document, already converted to HTML by the host, on the shared
 * {@link DocumentViewerView} shell.
 *
 * The host owns loading, rendering and sanitizing. This view owns the typography of the document's
 * markup.
 */
export function MarkdownViewerView({
    status,
    html,
    onContentClick,
    className,
}: Readonly<MarkdownViewerViewProps>): JSX.Element {
    return (
        <DocumentViewerView status={status} className={className}>
            {status === "ready" ? (
                <div
                    className={styles.content}
                    data-testid="markdown-content"
                    dir="auto"
                    onClickCapture={onContentClick}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            ) : null}
        </DocumentViewerView>
    );
}
