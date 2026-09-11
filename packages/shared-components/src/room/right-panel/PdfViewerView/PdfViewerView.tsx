/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
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
    /** The document surface, stretched to fill the space below the toolbar. */
    children?: ReactNode;
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
    /** Optional CSS class for the outer element. */
    className?: string;
}

/** The shell around a PDF viewer: toolbar and status overlays. The host renders the document into `children`. */
export function PdfViewerView({
    status,
    currentPage,
    pageCount,
    pageInput,
    children,
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
                    {/* A fieldset carries the implicit `group` role. */}
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
                                // Blur ends the edit the same way clicking away does.
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
                <div className={styles.surface} data-testid="pdf-surface">
                    {children}
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
