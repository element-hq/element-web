/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEventHandler, type JSX, useCallback, useMemo } from "react";
import { Tooltip, Text } from "@vector-im/compound-web";
import classNames from "classnames";

import { useI18n } from "../../utils/i18nContext";
import styles from "./LinkPreview.module.css";
import type { UrlPreviewViewSnapshotPreview } from "./types";

export interface LinkPreviewActions {
    onImageClick: () => void;
}

export interface LinkPreviewAdditionalProps {
    compactLayout?: boolean;
}

export type LinkPreviewProps = UrlPreviewViewSnapshotPreview & LinkPreviewActions & LinkPreviewAdditionalProps;

export function LinkPreview({ onImageClick, compactLayout, ...preview }: LinkPreviewProps): JSX.Element {
    const { translate: _t } = useI18n();

    const tooltipCaption = useMemo(() => {
        if (preview.showTooltipOnLink) {
            return new URL(preview.link, window.location.href).toString();
        }
        return null;
    }, [preview.link, preview.showTooltipOnLink]);

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
    if (preview.image?.imageThumb) {
        img = (
            <button
                aria-label={_t("timeline|url_preview|view_image")}
                className={styles.image}
                onClick={onImageClickHandler}
            >
                <img className={styles.thumbnail} src={preview.image.imageThumb} alt="" />
            </button>
        );
    }

    const anchor = (
        <a href={preview.link} target="_blank" rel="noreferrer noopener">
            {preview.title}
        </a>
    );
    return (
        <div className={classNames(styles.container, compactLayout && "compactLayout")}>
            <div className={styles.wrapImageCaption}>
                {img}
                <div className={styles.caption}>
                    <Text type="body" size="md" className={styles.title}>
                        {tooltipCaption ? <Tooltip label={tooltipCaption}>{anchor}</Tooltip> : anchor}
                        {preview.siteName && (
                            <Text as="span" size="md" weight="regular">
                                {" - " + preview.siteName}
                            </Text>
                        )}
                    </Text>
                    {preview.description && (
                        <Text
                            className={styles.description}
                            dangerouslySetInnerHTML={{ __html: preview.description }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
