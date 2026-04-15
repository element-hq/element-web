/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    type CSSProperties,
    type HTMLAttributeAnchorTarget,
    type JSX,
    type MouseEventHandler,
    type PropsWithChildren,
    type ReactEventHandler,
    useState,
} from "react";
import classNames from "classnames";
import { Blurhash } from "react-blurhash";
import { ImageErrorIcon, VisibilityOnIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { InlineSpinner, Tooltip } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import styles from "./ImageBodyView.module.css";

/**
 * High-level rendering state for the shared image body view.
 */
export const enum ImageBodyViewState {
    ERROR = "ERROR",
    HIDDEN = "HIDDEN",
    READY = "READY",
}

/**
 * Placeholder variant shown over the media frame while the image is still settling.
 */
export const enum ImageBodyViewPlaceholder {
    NONE = "NONE",
    SPINNER = "SPINNER",
    BLURHASH = "BLURHASH",
}

export interface ImageBodyViewSnapshot {
    /**
     * Controls whether the component renders an error state, a hidden-preview state,
     * or a visible image frame.
     */
    state: ImageBodyViewState;
    /**
     * Image alt text.
     */
    alt?: string;
    /**
     * Label shown when media processing fails.
     */
    errorLabel?: string;
    /**
     * Label used by the hidden-media reveal button.
     */
    hiddenButtonLabel?: string;
    /**
     * Full-resolution image source.
     */
    src?: string;
    /**
     * Thumbnail/static preview image source.
     * Falls back to `src` when omitted.
     */
    thumbnailSrc?: string;
    /**
     * Whether hovering or focusing the link should swap to the full-resolution image.
     */
    showAnimatedContentOnHover?: boolean;
    /**
     * Which placeholder to render over the image frame.
     */
    placeholder?: ImageBodyViewPlaceholder;
    /**
     * Blurhash string used when `placeholder` is `BLURHASH`.
     */
    blurhash?: string;
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
     * Optional badge shown for animated images when not hovered/focused.
     */
    gifLabel?: string;
    /**
     * Optional overlay banner shown while hovered/focused.
     */
    bannerLabel?: string;
    /**
     * Optional tooltip shown on the media frame.
     */
    tooltipLabel?: string;
    /**
     * Optional link target for the media frame.
     */
    linkUrl?: string;
    /**
     * Optional anchor target applied when `linkUrl` is provided.
     */
    linkTarget?: HTMLAttributeAnchorTarget;
}

export interface ImageBodyViewActions {
    /**
     * Invoked when the linked image is activated.
     */
    onLinkClick?: MouseEventHandler<HTMLAnchorElement>;
    /**
     * Invoked when the user chooses to reveal hidden media.
     */
    onHiddenButtonClick?: MouseEventHandler<HTMLButtonElement>;
    /**
     * Invoked when the visible image loads.
     */
    onImageLoad?: ReactEventHandler<HTMLImageElement>;
    /**
     * Invoked when the visible image fails to load.
     */
    onImageError?: ReactEventHandler<HTMLImageElement>;
}

export type ImageBodyViewModel = ViewModel<ImageBodyViewSnapshot, ImageBodyViewActions>;

interface ImageBodyViewProps {
    /**
     * The view model for the component.
     */
    vm: ImageBodyViewModel;
    /**
     * Optional host CSS class.
     */
    className?: string;
    /**
     * Optional supplemental content rendered after the media frame.
     */
    children?: PropsWithChildren["children"];
}

function renderPlaceholder({
    placeholder,
    blurhash,
    maxWidth,
    maxHeight,
}: Pick<ImageBodyViewSnapshot, "placeholder" | "blurhash" | "maxWidth" | "maxHeight">): JSX.Element | null {
    switch (placeholder) {
        case ImageBodyViewPlaceholder.BLURHASH:
            if (!blurhash) {
                return <InlineSpinner aria-label="Loading..." role="progressbar" />;
            }

            return (
                <Blurhash
                    className={styles.blurhash}
                    hash={blurhash}
                    width={maxWidth ?? 320}
                    height={maxHeight ?? 240}
                />
            );

        case ImageBodyViewPlaceholder.SPINNER:
            return <InlineSpinner aria-label="Loading..." role="progressbar" />;

        case ImageBodyViewPlaceholder.NONE:
        default:
            return null;
    }
}

/**
 * Renders the body of an image message with ready, hidden, and error states.
 *
 * The media frame supports thumbnail fallbacks, optional loading placeholders,
 * animated-content preview on hover/focus, and optional tooltip/banner labels.
 * Supplemental content such as a file body row can be rendered after the image
 * through `children`.
 *
 * @example
 * ```tsx
 * <ImageBodyView vm={imageBodyViewModel}>
 *     <div>File body slot</div>
 * </ImageBodyView>
 * ```
 */
export function ImageBodyView({ vm, className, children }: Readonly<ImageBodyViewProps>): JSX.Element {
    const {
        state,
        alt,
        errorLabel,
        hiddenButtonLabel,
        src,
        thumbnailSrc,
        showAnimatedContentOnHover,
        placeholder = ImageBodyViewPlaceholder.NONE,
        blurhash,
        maxWidth,
        maxHeight,
        aspectRatio,
        isSvg,
        gifLabel,
        bannerLabel,
        tooltipLabel,
        linkUrl,
        linkTarget,
    } = useViewModel(vm);

    const [hover, setHover] = useState(false);
    const [focus, setFocus] = useState(false);
    const hoverOrFocus = hover || focus;

    const rootClassName = classNames(className, styles.root);

    if (state === ImageBodyViewState.ERROR) {
        return (
            <span className={classNames(rootClassName, styles.error)}>
                <ImageErrorIcon className={styles.errorIcon} width="16" height="16" />
                {errorLabel}
            </span>
        );
    }

    const resolvedThumbnailSrc = thumbnailSrc ?? src;
    const resolvedImageSrc = hoverOrFocus && showAnimatedContentOnHover && src ? src : resolvedThumbnailSrc;

    // Reserve the media box on the container itself so the timeline doesn't jump
    // while the image element or loading state is still settling.
    const resolvedWidth = maxWidth === undefined ? undefined : `min(100%, ${maxWidth}px)`;
    const containerStyle: CSSProperties = {
        width: resolvedWidth,
        maxWidth,
        maxHeight,
        aspectRatio,
    };
    const mediaStyle: CSSProperties | undefined = isSvg
        ? {
              width: resolvedWidth,
              maxWidth,
              maxHeight,
          }
        : undefined;

    const placeholderNode = renderPlaceholder({ placeholder, blurhash, maxWidth, maxHeight });
    const showPlaceholder = placeholderNode !== null;

    const media =
        state === ImageBodyViewState.HIDDEN ? (
            <div style={{ width: maxWidth, height: maxHeight }}>
                <button type="button" className={styles.hiddenButton} onClick={vm.onHiddenButtonClick}>
                    <div className={styles.hiddenButtonContent}>
                        <VisibilityOnIcon />
                        <span>{hiddenButtonLabel}</span>
                    </div>
                </button>
            </div>
        ) : resolvedImageSrc ? (
            <img
                className={styles.image}
                src={resolvedImageSrc}
                alt={alt}
                onError={vm.onImageError}
                onLoad={vm.onImageLoad}
                onMouseEnter={(): void => setHover(true)}
                onMouseLeave={(): void => setHover(false)}
            />
        ) : null;

    const banner =
        state === ImageBodyViewState.READY && bannerLabel && hoverOrFocus ? (
            <span className={styles.banner}>{bannerLabel}</span>
        ) : null;

    const gifBadge =
        state === ImageBodyViewState.READY && gifLabel && !hoverOrFocus ? (
            <p className={styles.gifLabel}>{gifLabel}</p>
        ) : null;

    let frame = (
        <div className={styles.thumbnailContainer} style={containerStyle}>
            {showPlaceholder && (
                <div
                    className={classNames(styles.placeholder, {
                        [styles.placeholderBlurhash]: placeholder === ImageBodyViewPlaceholder.BLURHASH && !!blurhash,
                    })}
                >
                    {placeholderNode}
                </div>
            )}

            <div className={styles.mediaContent} style={mediaStyle}>
                {media}
                {gifBadge}
                {banner}
            </div>
        </div>
    );

    if (tooltipLabel) {
        frame = (
            <Tooltip description={tooltipLabel} placement="right" isTriggerInteractive={true}>
                {frame}
            </Tooltip>
        );
    }

    if (state === ImageBodyViewState.READY && linkUrl) {
        frame = (
            <a
                href={linkUrl}
                target={linkTarget}
                rel={linkTarget === "_blank" ? "noreferrer noopener" : undefined}
                className={styles.link}
                onClick={vm.onLinkClick}
                onFocus={(): void => setFocus(true)}
                onBlur={(): void => setFocus(false)}
            >
                {frame}
            </a>
        );
    }

    return (
        <div className={rootClassName}>
            {frame}
            {children}
        </div>
    );
}
