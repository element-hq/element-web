/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, type MouseEventHandler } from "react";
import { Form, Switch } from "@vector-im/compound-web";
import DocumentIcon from "@vector-im/compound-design-tokens/assets/web/icons/document";
import CodeIcon from "@vector-im/compound-design-tokens/assets/web/icons/code";

import { useI18n } from "../../../core/i18n/i18nContext";
import { DocumentViewerView, type DocumentViewerStatus } from "../DocumentViewerView";
import styles from "./MarkdownViewerView.module.css";

/** The document lifecycle state presented by the Markdown viewer. */
export type MarkdownViewerStatus = DocumentViewerStatus;

/** How the Markdown viewer presents the document: rendered as Markdown, or as its plain source text. */
export type MarkdownViewerFormat = "rendered" | "plain";

/** Props for {@link MarkdownViewerView}. */
export interface MarkdownViewerViewProps {
    /** The lifecycle state currently presented. */
    status: MarkdownViewerStatus;
    /**
     * The rendered document. This is inserted into the DOM as-is, so the host must have sanitized it
     * already; the view does nothing to make it safe.
     */
    content: JSX.Element|string;
    /** Called for clicks anywhere in the document, so the host can route the links it handles itself. */
    onContentClick?: MouseEventHandler<HTMLDivElement>;
    /** Optional CSS class for host-level styling, applied to the outer element. */
    className?: string;
    /** Whether to offer a switch between the rendered and plain formats once the document is ready. */
    canToggleFormat?: boolean;
    /** The format the document in `html` is presented in. */
    format: MarkdownViewerFormat;
    /** Called when the user picks a different format with the switch. */
    onFormatChange: (format: MarkdownViewerFormat) => void;
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
    content,
    onContentClick,
    className,
    canToggleFormat,
    format,
    onFormatChange,
}: Readonly<MarkdownViewerViewProps>): JSX.Element {
    const { translate: _t } = useI18n();

    const toolbar =
        status === "ready" && canToggleFormat ? (
            <Form.Root className={styles.toolbar}>
                <Switch
                    name="formatSwitch"
                    size="md"
                    value={format}
                    onChange={onFormatChange}
                    leftLabel={_t("document_viewer|format_rendered")}
                    leftValue="rendered"
                    leftIcon={DocumentIcon}
                    rightLabel={_t("document_viewer|format_plain")}
                    rightValue="plain"
                    rightIcon={CodeIcon}
                />
            </Form.Root>
        ) : undefined;

    let inner;
    if (status === "ready") {
        if (typeof content === "string") {
            inner = <div
                className={styles.content}
                data-format={format}
                data-testid="markdown-content"
                dir="auto"
                onClickCapture={onContentClick}
                dangerouslySetInnerHTML={{ __html: content }}
                />
        } else {
            inner = <div
                className={styles.content}
                data-format={format}
                data-testid="markdown-content"
                dir="auto"
                >{content}</div>
        }
    }

    return (
        <DocumentViewerView status={status} className={className} toolbar={toolbar}>
            {inner}
        </DocumentViewerView>
    );
}
