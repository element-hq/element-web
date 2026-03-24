/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    type CSSProperties,
    type JSX,
    type MouseEventHandler,
    type PropsWithChildren,
    type ReactEventHandler,
    type Ref,
} from "react";
import classNames from "classnames";
import { FileErrorIcon, VisibilityOnIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { InlineSpinner } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./VideoBodyView.module.css";

/**
 * Render states for the shared video body view.
 */
export const VideoBodyViewState = {
    ERROR: "ERROR",
    HIDDEN: "HIDDEN",
    LOADING: "LOADING",
    READY: "READY",
} as const;

export type VideoBodyViewState = (typeof VideoBodyViewState)[keyof typeof VideoBodyViewState];

export interface VideoBodyViewSnapshot {
    /**
     * The current render state of the component.
     */
    state: VideoBodyViewState;
    /**
     * Accessible label applied to the video element.
     */
    videoLabel?: string;
    /**
     * Title applied to the video element.
     */
    videoTitle?: string;
    /**
     * Label shown in the hidden-preview placeholder.
     */
    hiddenButtonLabel?: string;
    /**
     * Label rendered when media cannot be processed.
     */
    errorLabel?: string;
    /**
     * Optional width constraint for the media frame.
     */
    maxWidth?: number;
    /**
     * Optional height constraint for the media frame.
     */
    maxHeight?: number;
    /**
     * Optional aspect ratio for the media frame.
     */
    aspectRatio?: CSSProperties["aspectRatio"];
    /**
     * Video source URL.
     */
    src?: string;
    /**
     * Poster image URL.
     */
    poster?: string;
    /**
     * Preload mode for the video.
     */
    preload?: "none" | "metadata" | "auto";
    /**
     * Whether native controls are visible.
     */
    controls?: boolean;
    /**
     * Whether the video is muted.
     */
    muted?: boolean;
    /**
     * Whether the video should autoplay.
     */
    autoPlay?: boolean;
}

export interface VideoBodyViewActions {
    /**
     * Invoked when the user chooses to reveal hidden media.
     */
    onPreviewClick?: MouseEventHandler<HTMLButtonElement>;
    /**
     * Invoked when the video starts playing.
     */
    onPlay?: ReactEventHandler<HTMLVideoElement>;
}

export type VideoBodyViewModel = ViewModel<VideoBodyViewSnapshot, VideoBodyViewActions>;

interface VideoBodyViewProps {
    /**
     * View model providing render state and actions.
     */
    vm: VideoBodyViewModel;
    /**
     * Optional host CSS class.
     */
    className?: string;
    /**
     * Optional CSS class applied to the media frame container.
     */
    containerClassName?: string;
    /**
     * Optional ref to the rendered video element.
     */
    videoRef?: Ref<HTMLVideoElement>;
    /**
     * Optional supplemental content rendered after the video frame.
     */
    children?: PropsWithChildren["children"];
}

export function VideoBodyView({
    vm,
    className,
    containerClassName,
    videoRef,
    children,
}: Readonly<VideoBodyViewProps>): JSX.Element {
    const {
        state,
        videoLabel,
        videoTitle,
        hiddenButtonLabel,
        errorLabel,
        maxWidth,
        maxHeight,
        aspectRatio,
        src,
        poster,
        preload,
        controls,
        muted,
        autoPlay,
    } = useViewModel(vm);

    const rootClassName = classNames(className, styles.root);
    const resolvedContainerClassName = classNames(containerClassName, styles.container);

    // Reserve the media box on the container itself so the timeline doesn't jump
    // while the video element or loading state is still settling.
    const resolvedWidth = maxWidth !== undefined ? `min(100%, ${maxWidth}px)` : undefined;
    const containerStyle: CSSProperties = {
        width: resolvedWidth,
        maxWidth,
        maxHeight,
        aspectRatio,
    };

    if (state === VideoBodyViewState.ERROR) {
        return (
            <span className={classNames(rootClassName, styles.error)}>
                <FileErrorIcon width="16" height="16" />
                {errorLabel}
            </span>
        );
    }

    if (state === VideoBodyViewState.HIDDEN) {
        return (
            <span className={rootClassName}>
                <div className={resolvedContainerClassName} style={containerStyle}>
                    <button type="button" onClick={vm.onPreviewClick} className={styles.hiddenButton}>
                        <div className={styles.hiddenButtonContent}>
                            <VisibilityOnIcon />
                            <span>{hiddenButtonLabel}</span>
                        </div>
                    </button>
                </div>
            </span>
        );
    }

    if (state === VideoBodyViewState.LOADING) {
        return (
            <span className={rootClassName}>
                <div className={resolvedContainerClassName} style={containerStyle}>
                    <div className={styles.loadingContainer}>
                        <InlineSpinner aria-label="Loading..." role="progressbar" />
                    </div>
                </div>
            </span>
        );
    }

    return (
        <span className={rootClassName}>
            <div className={resolvedContainerClassName} style={containerStyle}>
                {/* Captions will be supplied from app-side data once the VM wiring is in place. */}
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                    className={styles.video}
                    ref={videoRef}
                    src={src}
                    aria-label={videoLabel}
                    title={videoTitle}
                    controls={controls}
                    controlsList="nodownload"
                    crossOrigin="anonymous"
                    preload={preload}
                    muted={muted}
                    autoPlay={autoPlay}
                    poster={poster}
                    onPlay={vm.onPlay}
                />
            </div>
            {children}
        </span>
    );
}
