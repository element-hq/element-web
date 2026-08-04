/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { InlineSpinner } from "@vector-im/compound-web";
import { ErrorSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import styles from "./PdfViewerCardView.module.css";
import { type ViewModel } from "../../../core/viewmodel/ViewModel";
import { useViewModel } from "../../../core/viewmodel/useViewModel";
import { useI18n } from "../../../core/i18n/i18nContext";

/**
 * The PDF has been downloaded and can be handed over to the browser's PDF viewer.
 */
export interface PdfViewerCardSnapshotLoaded {
    status: "loaded";
    /**
     * URL the viewer should load the PDF from, usually an object URL owned by the view model.
     */
    url: string;
}

/**
 * The event, or the file it points at, is still being fetched.
 */
export interface PdfViewerCardSnapshotLoading {
    status: "loading";
}

/**
 * The PDF cannot be shown.
 */
export interface PdfViewerCardSnapshotFailed {
    status: "failed";
    /**
     * Translated, user facing explanation of why the PDF cannot be shown.
     */
    message: string;
}

export type PdfViewerCardSnapshot =
    | PdfViewerCardSnapshotFailed
    | PdfViewerCardSnapshotLoaded
    | PdfViewerCardSnapshotLoading;

export type PdfViewerCardViewModel = ViewModel<PdfViewerCardSnapshot>;

interface PdfViewerCardViewProps {
    vm: PdfViewerCardViewModel;
}

/**
 * The contents of the right panel card which previews a PDF attachment using the
 * browser's built in PDF viewer.
 */
export function PdfViewerCardView({ vm }: PdfViewerCardViewProps): JSX.Element {
    const { translate: _t } = useI18n();
    const snapshot = useViewModel(vm);

    switch (snapshot.status) {
        case "loaded":
            // A sandboxed iframe doesn't get handed to the browser's PDF viewer, so it can't be
            // used here. The URL points at a blob owned by this client rather than at remote
            // content, so the plugin gets nothing it could not already read.
            // eslint-disable-next-line react/iframe-missing-sandbox
            return <iframe className={styles.viewer} src={snapshot.url} title={_t("right_panel|pdf_viewer|title")} />;
        case "failed":
            return (
                <div className={styles.error}>
                    <ErrorSolidIcon className={styles.errorIcon} />
                    <div>{snapshot.message}</div>
                </div>
            );
        case "loading":
            return (
                <div className={styles.loading}>
                    <InlineSpinner size={32} aria-label={_t("common|loading")} role="progressbar" />
                </div>
            );
    }
}
