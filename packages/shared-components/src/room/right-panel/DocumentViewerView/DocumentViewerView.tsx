/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import classNames from "classnames";

import { useI18n } from "../../../core/i18n/i18nContext";
import styles from "./DocumentViewerView.module.css";

/** The lifecycle state of the document a viewer is presenting. */
export type DocumentViewerStatus = "loading" | "ready" | "error";

/** Props for {@link DocumentViewerView}. */
export interface DocumentViewerViewProps {
    /** The lifecycle state presented over the document surface. */
    status: DocumentViewerStatus;
    /** Controls shown in a bar above the document, if the viewer has any. */
    toolbar?: ReactNode;
    /**
     * The document surface. Rendered whatever the status, so a viewer that renders imperatively can
     * keep its mount point stable while the loading overlay is up.
     */
    children?: ReactNode;
    /** Optional CSS class for host-level styling, applied to the outer element. */
    className?: string;
}

/**
 * The frame shared by the right panel document viewers: an optional toolbar, the document surface,
 * and the loading and error overlays. What goes on the surface is up to the viewer built on it.
 */
export function DocumentViewerView({
    status,
    toolbar,
    children,
    className,
}: Readonly<DocumentViewerViewProps>): JSX.Element {
    const { translate: _t } = useI18n();

    return (
        <div className={classNames(styles.viewer, className)} data-testid="document-viewer">
            {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
            <div className={styles.body}>
                {children}
                {status === "loading" ? (
                    <div className={styles.message} role="status" aria-live="polite">
                        {_t("document_viewer|loading")}
                    </div>
                ) : null}
                {status === "error" ? (
                    <div className={classNames(styles.message, styles.error)} role="alert">
                        {_t("document_viewer|error_load")}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
