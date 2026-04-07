/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEventHandler, type JSX, useCallback, useMemo } from "react";
import { Tooltip, Text, Avatar, IconButton, Button } from "@vector-im/compound-web";
import PlaySolidIcon from "@vector-im/compound-design-tokens/assets/web/icons/play-solid";
import classNames from "classnames";

import { useI18n } from "../../../core/i18n/i18nContext";
import type { UrlPreview } from "../types";
import { LinkedText } from "../../../core/utils/LinkedText";
import styles from "./LinkPreview.module.css";

export interface LinkPreviewActions {
    onImageClick: () => void;
}

export type LinkPreviewProps = UrlPreview & LinkPreviewActions;

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
        [preview.image?.imageFull, onImageClick],
    );

    let img: JSX.Element | undefined;
    // Don't render a button to show the image, just hide it outright
    if (preview.image?.imageThumb) {
        if (preview.playable) {
            img = (
                <div
                    style={{
                        backgroundImage: `url('${preview.image.imageThumb}')`,
                    }}
                    className={styles.preview}
                >
                    {preview.playable && (
                        <Button
                            as="a"
                            href={preview.link}
                            aria-label={_t("timeline|url_preview|view_image")}
                            className={styles.playButton}
                            target="_blank"
                            rel="noreferrer noopener"
                            kind="primary"
                        >
                            <PlaySolidIcon width="24px" height="24px" />
                        </Button>
                    )}
                </div>
            );
        } else {
            img = (
                <button
                    style={{
                        backgroundImage: `image-set(url('${preview.image.imageThumb}') 1x, url('${preview.image.imageFull}') 2x)`,
                    }}
                    className={styles.preview}
                    onClick={onImageClickHandler}
                />
            );
        }
    }

    const anchor = (
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
    );

    const useInline = !preview.image && !preview.author;

    return (
        <div className={classNames(styles.container, useInline && styles.inline)}>
            {img}
            {useInline && (
                <div className={styles.siteAvatar}>
                    <Avatar type="square" size="48px" name={preview.title} id={preview.title} src={preview.siteIcon} />
                </div>
            )}
            <div className={classNames(styles.textContent)}>
                {preview.author && (
                    <div className={styles.author}>
                        <Text as="span" size="md" weight="semibold">
                            {preview.author.username}
                        </Text>
                        <Text as="span" size="sm" weight="regular">
                            {preview.author.name}
                        </Text>
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
