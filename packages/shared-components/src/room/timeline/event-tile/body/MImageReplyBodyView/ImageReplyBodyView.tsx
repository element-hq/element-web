/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type CSSProperties, type JSX, type ReactEventHandler, type Ref, useState } from "react";
import { Blurhash } from "react-blurhash";
import { InlineSpinner } from "@vector-im/compound-web";

import { useI18n } from "../../../../../core/i18n/i18nContext";
import styles from "./ImageReplyBodyView.module.css";

export const enum ImageReplyBodyViewPlaceholder {
    NONE = "NONE",
    SPINNER = "SPINNER",
    BLURHASH = "BLURHASH",
}

export interface ImageReplyBodyViewProps {
    /**
     * CSS class names applied to the root element.
     */
    className?: string;
    /**
     * Ref to the rendered image element.
     */
    imageRef?: Ref<HTMLImageElement>;
    /**
     * Full-resolution image source.
     */
    src?: string;
    /**
     * Thumbnail/static preview image source.
     */
    thumbnailSrc?: string;
    /**
     * Image alt text.
     */
    alt?: string;
    /**
     * Maximum rendered width for the media frame.
     */
    maxWidth?: number;
    /**
     * Maximum rendered height for the media frame.
     */
    maxHeight?: number;
    /**
     * Aspect ratio reserved for the media frame.
     */
    aspectRatio?: CSSProperties["aspectRatio"];
    /**
     * Whether the displayed image is an SVG and should therefore use explicit width sizing.
     */
    isSvg?: boolean;
    /**
     * Which placeholder to render over the image frame.
     */
    placeholder?: ImageReplyBodyViewPlaceholder;
    /**
     * Blurhash string used when `placeholder` is `BLURHASH`.
     */
    blurhash?: string;
    /**
     * Whether hovering the preview should swap to the full-resolution image.
     */
    showAnimatedContentOnHover?: boolean;
    /**
     * Whether the image element should be rendered inside the reserved media frame.
     */
    showImage?: boolean;
    /**
     * Optional badge shown for animated images when not hovered.
     */
    gifLabel?: string;
    /**
     * Optional overlay banner shown while hovered.
     */
    bannerLabel?: string;
    /**
     * Invoked when the rendered image loads.
     */
    onImageLoad?: ReactEventHandler<HTMLImageElement>;
    /**
     * Invoked when the rendered image fails to load.
     */
    onImageError?: ReactEventHandler<HTMLImageElement>;
}

function renderPlaceholder({
    placeholder,
    blurhash,
    maxWidth,
    maxHeight,
    loadingLabel,
}: Pick<ImageReplyBodyViewProps, "placeholder" | "blurhash" | "maxWidth" | "maxHeight"> & {
    loadingLabel: string;
}): JSX.Element | null {
    switch (placeholder) {
        case ImageReplyBodyViewPlaceholder.BLURHASH:
            if (!blurhash) {
                return (
                    <div className={styles.spinner}>
                        <InlineSpinner size={32} aria-label={loadingLabel} role="progressbar" />
                    </div>
                );
            }

            return (
                <Blurhash className={styles.blurhash} hash={blurhash} width={maxWidth ?? 58} height={maxHeight ?? 44} />
            );

        case ImageReplyBodyViewPlaceholder.SPINNER:
            return (
                <div className={styles.spinner}>
                    <InlineSpinner size={32} aria-label={loadingLabel} role="progressbar" />
                </div>
            );

        case ImageReplyBodyViewPlaceholder.NONE:
        default:
            return null;
    }
}

/**
 * Presentational wrapper for the compact image preview used inside reply tiles.
 */
export function ImageReplyBodyView({
    className,
    imageRef,
    src,
    thumbnailSrc,
    alt,
    maxWidth,
    maxHeight,
    aspectRatio,
    isSvg,
    placeholder = ImageReplyBodyViewPlaceholder.NONE,
    blurhash,
    showAnimatedContentOnHover,
    showImage = true,
    gifLabel,
    bannerLabel,
    onImageLoad,
    onImageError,
}: Readonly<ImageReplyBodyViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const [hover, setHover] = useState(false);
    const resolvedThumbnailSrc = thumbnailSrc ?? src;
    const resolvedImageSrc = hover && showAnimatedContentOnHover && src ? src : resolvedThumbnailSrc;

    if (!resolvedImageSrc) {
        return <div className={classNames(styles.root, className)} />;
    }

    if (maxWidth === undefined || maxHeight === undefined || aspectRatio === undefined) {
        if (!showImage) {
            return <div className={classNames(styles.root, className)} />;
        }

        return (
            <div className={classNames(styles.root, className)}>
                <img
                    className={styles.measureImage}
                    src={resolvedImageSrc}
                    ref={imageRef}
                    alt={alt}
                    onError={onImageError}
                    onLoad={onImageLoad}
                />
            </div>
        );
    }

    const containerStyle: CSSProperties = {
        maxWidth,
        maxHeight,
        aspectRatio,
    };
    const mediaStyle: CSSProperties = isSvg
        ? {
              width: maxWidth,
              maxWidth,
              maxHeight,
          }
        : {
              width: "100%",
              height: "100%",
              maxWidth,
              maxHeight,
          };

    const placeholderNode = renderPlaceholder({
        placeholder,
        blurhash,
        maxWidth,
        maxHeight,
        loadingLabel: _t("common|loading"),
    });

    return (
        <div className={classNames(styles.root, className)}>
            <div className={styles.thumbnailContainer} style={containerStyle}>
                {placeholderNode && <div className={styles.placeholder}>{placeholderNode}</div>}

                <div className={styles.mediaContent} style={mediaStyle}>
                    {showImage ? (
                        <img
                            className={styles.image}
                            src={resolvedImageSrc}
                            ref={imageRef}
                            alt={alt}
                            onError={onImageError}
                            onLoad={onImageLoad}
                            onMouseEnter={(): void => setHover(true)}
                            onMouseLeave={(): void => setHover(false)}
                        />
                    ) : null}
                    {gifLabel && !hover ? <p className={styles.gifLabel}>{gifLabel}</p> : null}
                    {bannerLabel && hover ? <span className={styles.banner}>{bannerLabel}</span> : null}
                </div>
            </div>
        </div>
    );
}
