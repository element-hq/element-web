/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, IconButton } from "@vector-im/compound-web";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import classNames from "classnames";

import { useViewModel, type ViewModel } from "../../../../core/viewmodel";
import { useI18n } from "../../../../core/i18n/i18nContext";
import { useEventPresentation } from "../../EventPresentation";
import type { UrlPreview } from "./types";
import { LinkPreview } from "./LinkPreview";
import styles from "./UrlPreviewGroupView.module.css";

/** Snapshot data for rendering URL previews attached to an event. */
export interface UrlPreviewGroupViewSnapshot {
    /** URL previews to render. */
    previews: Array<UrlPreview>;
    /** Total number of previews available before limiting. */
    totalPreviewCount: number;
    /** Whether the preview list is currently limited. */
    previewsLimited: boolean;
    /** Whether more previews exist than are currently rendered. */
    overPreviewLimit: boolean;
}

/** Props for the URL preview group view. */
export interface UrlPreviewGroupViewProps {
    /**
     * The view model for the component.
     */
    vm: ViewModel<UrlPreviewGroupViewSnapshot> & UrlPreviewGroupViewActions;
    /**
     * Extra CSS classes to apply to the component.
     */
    className?: string;
}

/** User actions emitted by the URL preview group view. */
export interface UrlPreviewGroupViewActions {
    /** Invoked when the preview limit toggle is clicked. */
    onTogglePreviewLimit: () => void;
    /** Invoked when the hide-preview action is clicked. */
    onHideClick: () => Promise<void>;
    /** Invoked when a preview image is clicked. */
    onImageClick: (preview: UrlPreview) => void;
}

/** View model contract for the URL preview group view. */
export type UrlPreviewGroupViewModel = ViewModel<UrlPreviewGroupViewSnapshot, UrlPreviewGroupViewActions>;

/**
 * Renders the URL preview group attached to a single event.
 *
 * The view lays out one or more link previews, can collapse or expand
 * overflowed previews, and exposes a control to hide the group.
 */
export function UrlPreviewGroupView({ vm, className }: UrlPreviewGroupViewProps): JSX.Element | null {
    const { translate: _t } = useI18n();
    const { density } = useEventPresentation();
    const { previews, totalPreviewCount, previewsLimited, overPreviewLimit } = useViewModel(vm);
    if (previews.length === 0) {
        return null;
    }

    let toggleButton: JSX.Element | undefined;
    if (overPreviewLimit) {
        toggleButton = (
            <Button className={styles.toggleButton} kind="tertiary" size="md" onClick={vm.onTogglePreviewLimit}>
                {previewsLimited
                    ? _t("timeline|url_preview|show_n_more", { count: totalPreviewCount - previews.length })
                    : _t("action|collapse")}
            </Button>
        );
    }

    return (
        <div className={classNames(className, styles.wrapper)}>
            <div className={classNames(styles.previewGroup, density === "compact" && styles.compactLayout)}>
                {previews.map((preview) => (
                    <LinkPreview key={preview.link} onImageClick={() => vm.onImageClick(preview)} {...preview} />
                ))}
                {toggleButton}
            </div>
            <IconButton
                kind="secondary"
                size="28px"
                onClick={vm.onHideClick}
                aria-label={_t("timeline|url_preview|close")}
            >
                <CloseIcon />
            </IconButton>
        </div>
    );
}
