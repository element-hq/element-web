/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type Ref } from "react";
import classNames from "classnames";

import { useI18n } from "../../../core/i18n/i18nContext";
import styles from "./PdfViewerView.module.css";

/** The document lifecycle state presented by the PDF viewer shell. */
export type PdfViewerStatus = "loading" | "ready" | "error";

/** Controlled state and host integration points for {@link PdfViewerView}. */
export interface PdfViewerViewProps {
    /** The lifecycle state currently presented over the document surface. */
    status: PdfViewerStatus;
    /** The page currently visible in the host renderer. */
    currentPage: number;
    /** The number of pages reported by the loaded document. Zero hides the page controls. */
    pageCount: number;
    /** The controlled value of the page-number input. */
    pageInput: string;
    /** Receives the scrolling element that the host renderer measures and observes. */
    containerRef: Ref<HTMLDivElement>;
    /** Receives the inner element into which the host renders document pages. */
    viewerRef: Ref<HTMLDivElement>;
    /** Called with each new value typed into the controlled page-number input. */
    onPageInputChange: (value: string) => void;
    /** Called when the page-number input enters its editing state. */
    onPageInputFocus: () => void;
    /** Called when the page-number input leaves its editing state. */
    onPageInputBlur: () => void;
    /** Called when the user cancels a page-number edit with Escape. */
    onPageInputCancel: () => void;
    /** Called when the user submits the page-number form. */
    onPageSubmit: () => void;
    /**
     * Optional CSS class for host-level styling. Applied to the outer element, so a host can scope
     * styling for its own renderer's markup without that markup being known here.
     */
    className?: string;
}

/**
 * Renders the reusable presentation shell for a PDF document viewer.
 *
 * The host owns document loading and rendering. It receives both required DOM elements through refs,
 * while this View owns the toolbar, status overlays, accessibility labels, and pdf.js-compatible page styling.
 */
export function PdfViewerView({
    status,
    currentPage,
    pageCount,
    pageInput,
    containerRef,
    viewerRef,
    onPageInputChange,
    onPageInputFocus,
    onPageInputBlur,
    onPageInputCancel,
    onPageSubmit,
    className,
}: Readonly<PdfViewerViewProps>): JSX.Element {
    const { translate: _t } = useI18n();

    return (
        <div className={classNames(styles.viewer, className)} data-testid="pdf-viewer">
            {pageCount > 0 ? (
                <form
                    className={styles.toolbar}
                    onSubmit={(event) => {
                        event.preventDefault();
                        onPageSubmit();
                    }}
                >
                    {/* A fieldset groups the controls semantically, and carries the implicit `group` role. */}
                    <fieldset
                        className={styles.pageForm}
                        aria-label={_t("pdf_viewer|page_label", { page: currentPage, total: pageCount })}
                    >
                        <input
                            aria-label={_t("pdf_viewer|page_number")}
                            className={styles.pageInput}
                            data-testid="pdf-page-input"
                            inputMode="numeric"
                            onBlur={onPageInputBlur}
                            onChange={(event) => onPageInputChange(event.target.value)}
                            onFocus={onPageInputFocus}
                            onKeyDown={(event) => {
                                if (event.key !== "Escape") return;

                                onPageInputCancel();
                                // Blurring completes the same editing lifecycle as clicking away from the input.
                                event.currentTarget.blur();
                            }}
                            value={pageInput}
                        />
                        <span aria-hidden="true" className={styles.pageSeparator}>
                            |
                        </span>
                        <span className={styles.pageTotal} data-testid="pdf-page-total">
                            {pageCount}
                        </span>
                    </fieldset>
                </form>
            ) : null}
            <div className={styles.body}>
                <div className={styles.container} data-testid="pdf-container" ref={containerRef}>
                    <div className="pdfViewer" ref={viewerRef} />
                </div>
                {status === "loading" ? (
                    <div className={styles.message} role="status" aria-live="polite">
                        {_t("pdf_viewer|loading")}
                    </div>
                ) : null}
                {status === "error" ? (
                    <div className={classNames(styles.message, styles.error)} role="alert">
                        {_t("pdf_viewer|error_load")}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
