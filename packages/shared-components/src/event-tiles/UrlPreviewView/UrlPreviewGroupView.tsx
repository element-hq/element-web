/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, IconButton } from "@vector-im/compound-web";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";

import { useViewModel, type ViewModel } from "../../viewmodel";
import { useI18n } from "../../utils/i18nContext";
import type { UrlPreviewViewSnapshotPreview } from "./types";
import { LinkPreview } from "./LinkPreview";
import styles from "./UrlPreviewGroupView.module.css";

export interface UrlPreviewGroupViewSnapshot {
    previews: Array<UrlPreviewViewSnapshotPreview>;
    totalPreviewCount: number;
    previewsLimited: boolean;
    overPreviewLimit: boolean;
    compactLayout: boolean;
}

export interface UrlPreviewGroupViewProps {
    vm: ViewModel<UrlPreviewGroupViewSnapshot> & UrlPreviewGroupViewActions;
}

export interface UrlPreviewGroupViewActions {
    onTogglePreviewLimit: () => void;
    onHideClick: () => Promise<void>;
    onImageClick: (preview: UrlPreviewViewSnapshotPreview) => void;
}

/**
 * UrlPreviewGroupView renders a list of URL previews for a single event.
 */
export function UrlPreviewGroupView({ vm }: UrlPreviewGroupViewProps): JSX.Element | null {
    const { translate: _t } = useI18n();
    const { previews, totalPreviewCount, previewsLimited, overPreviewLimit, compactLayout } = useViewModel(vm);
    if (previews.length === 0) {
        return null;
    }

    let toggleButton: JSX.Element | undefined;
    if (overPreviewLimit) {
        toggleButton = (
            <Button className={styles.toggleButton} kind="tertiary" size="sm" onClick={() => vm.onTogglePreviewLimit()}>
                {previewsLimited
                    ? _t("timeline|url_preview|show_n_more", { count: totalPreviewCount - previews.length })
                    : _t("action|collapse")}
            </Button>
        );
    }

    return (
        <div className={styles.wrapper}>
            <div className={styles.previewGroup}>
                {previews.map((preview, i) => (
                    <LinkPreview
                        key={preview.link}
                        compactLayout={compactLayout}
                        onImageClick={() => vm.onImageClick(preview)}
                        {...preview}
                    />
                ))}
                {toggleButton}
            </div>
            <IconButton size="20px" onClick={() => vm.onHideClick()} aria-label={_t("timeline|url_preview|close")}>
                <CloseIcon />
            </IconButton>
        </div>
    );
}
