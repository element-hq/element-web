/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEventHandler, type JSX, useCallback } from "react";
import { IconButton, Tooltip } from "@vector-im/compound-web";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import classNames from "classnames";

import { useI18n } from "../../utils/i18nContext";
import styles from "./LinkPreview.module.css";
import type { UrlPreviewViewSnapshotPreview } from "./types";

export interface LinkPreviewActions {
    onHideClick?: () => void;
    onImageClick: () => void;
}

interface LinkPreviewAdditionalProps {
    mediaVisible: boolean;
    compactLayout?: boolean;
}

export type LinkPreviewProps = UrlPreviewViewSnapshotPreview & LinkPreviewActions & LinkPreviewAdditionalProps;

export function LinkPreview({
    onHideClick,
    onImageClick,
    mediaVisible,
    compactLayout,
    ...preview
}: LinkPreviewProps): JSX.Element {
    const { translate: _t } = useI18n();
    const hideButton = onHideClick && (
        <IconButton
            className="mx_LinkPreviewGroup_hide"
            onClick={() => onHideClick()}
            aria-label={_t("timeline|url_preview|close")}
        >
            <CloseIcon width="20px" height="20px" />
        </IconButton>
    );

    const onImageClickHandler = useCallback<MouseEventHandler>(
        (ev) => {
            if (ev.button != 0 || ev.metaKey) return;
            ev.preventDefault();

            if (!preview.image?.imageFull) {
                return;
            }
            onImageClick();
        },
        [preview, onImageClick],
    );

    let img: JSX.Element | undefined;
    // Don't render a button to show the image, just hide it outright
    if (preview.image?.imageThumb && mediaVisible) {
        // Image width and height sanitized in the view model.
        img = (
            <div className={styles.mx_LinkPreviewWidget_image} style={{ height: preview.image.height }}>
                <img
                    className={styles.thumbnail}
                    src={preview.image.imageThumb}
                    onClick={onImageClickHandler}
                    role="button"
                    alt=""
                />
            </div>
        );
    }

    const anchor = (
        <a href={preview.link} target="_blank" rel="noreferrer noopener">
            {preview.title}
        </a>
    );
    return (
        <div className={classNames(styles.container, compactLayout && "compactLayout")}>
            <div className={styles.mx_LinkPreviewWidget_wrapImageCaption}>
                {img}
                <div className={styles.mx_LinkPreviewWidget_caption}>
                    <div className={styles.mx_LinkPreviewWidget_title}>
                        {preview.showTooltipOnLink ? (
                            <Tooltip label={new URL(preview.link, window.location.href).toString()}>{anchor}</Tooltip>
                        ) : (
                            anchor
                        )}
                        {preview.siteName && (
                            <span className={styles.mx_LinkPreviewWidget_siteName}>{" - " + preview.siteName}</span>
                        )}
                    </div>
                    {preview.description && (
                        <div
                            className={styles.mx_LinkPreviewWidget_description}
                            dangerouslySetInnerHTML={{ __html: preview.description }}
                        />
                    )}
                </div>
            </div>
            {hideButton}
        </div>
    );
}
