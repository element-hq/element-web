/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEventHandler, type JSX, useCallback, useMemo } from "react";
import { Tooltip, Text, Avatar } from "@vector-im/compound-web";
import classNames from "classnames";
import PlaySolidIcon from "@vector-im/compound-design-tokens/assets/web/icons/play-solid";

import { useI18n } from "../../utils/i18nContext";
import styles from "./LinkPreview.module.css";
import type { UrlPreviewViewSnapshotPreview } from "./types";
import { LinkedText } from "../../utils/LinkedText";
import { Clock } from "../../audio/Clock";

export interface LinkPreviewActions {
    onImageClick: () => void;
}

export type LinkPreviewProps = UrlPreviewViewSnapshotPreview & LinkPreviewActions;

/**
 * LinkPreview renders a single preview component for a single link on an event. It is usually rendered as part of
 * a `UrlPreviewGroupView`.
 */
export function LinkPreview({ onImageClick, ...preview }: LinkPreviewProps): JSX.Element {
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
            <div style={{ backgroundImage: `url('${preview.image.imageThumb}')` }} className={styles.preview}>
                {preview.duration && (
                    <span className={styles.duration}>
                        <Clock seconds={preview.duration} />
                    </span>
                )}
                {preview.playable && (
                    <button aria-label={_t("timeline|url_preview|view_image")} onClick={onImageClickHandler}>
                        <div className={styles.playIcon}>
                            <PlaySolidIcon width="24px" height="24px" />
                        </div>
                    </button>
                )}
            </div>
        );
    }

    const anchor = preview.title ? (
        <Text
            as="a"
            type="body"
            weight="semibold"
            size="lg"
            className={styles.title}
            href={preview.link}
            target="_blank"
            rel="noreferrer noopener"
        >
            {preview.title}
        </Text>
    ) : null;

    const useInline = !preview.image && !preview.author;

    return (
        <div className={classNames(styles.container, useInline && styles.inline)}>
            {img}
            {useInline && (
                <div className={styles.siteAvatar}>
                    <Avatar
                        type="square"
                        size="48px"
                        name={preview.siteName}
                        id={preview.siteName}
                        src={preview.siteIcon}
                    />
                </div>
            )}
            <div className={classNames(styles.textContent)}>
                {preview.author && (
                    <div className={styles.author}>
                        <Avatar
                            size="36px"
                            name={preview.author.name}
                            id={preview.author.name}
                            src={preview.siteIcon}
                        />{" "}
                        <div>
                            <Text as="span" size="md" weight="semibold">
                                {preview.author.username}
                            </Text>
                            <Text as="span" size="sm" weight="regular">
                                {preview.author.name}
                            </Text>
                        </div>
                    </div>
                )}
                {anchor && tooltipCaption ? <Tooltip label={tooltipCaption}>{anchor}</Tooltip> : anchor}
                <LinkedText type="body" size="md" className={styles.description}>
                    {preview.description}
                </LinkedText>
                {preview.siteName && (
                    <div className={styles.siteName}>
                        {!useInline && (
                            <Avatar size="16px" name={preview.siteName} id={preview.siteName} src={preview.siteIcon} />
                        )}
                        <Text as="span" size="sm" weight="regular">
                            {preview.siteName}
                        </Text>
                    </div>
                )}
            </div>
        </div>
    );
}
