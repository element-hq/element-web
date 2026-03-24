/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { decode } from "blurhash";
import { type RefObject } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent, type VideoInfo } from "matrix-js-sdk/src/types";
import {
    BaseViewModel,
    VideoBodyViewState,
    type VideoBodyViewModel as VideoBodyViewModelInterface,
    type VideoBodyViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import SettingsStore from "../../settings/SettingsStore";
import { mediaFromContent } from "../../customisations/Media";
import { BLURHASH_FIELD } from "../../utils/image-media";
import { type ImageSize, suggestedSize as suggestedVideoSize } from "../../settings/enums/ImageSize";
import { type MediaEventHelper } from "../../utils/MediaEventHelper";

export interface VideoBodyViewModelProps {
    /**
     * Video event being rendered.
     */
    mxEvent: MatrixEvent;
    /**
     * Helper for resolving encrypted and unencrypted media sources.
     */
    mediaEventHelper?: MediaEventHelper;
    /**
     * Whether the video is being rendered for export instead of live playback.
     */
    forExport?: boolean;
    /**
     * Whether playback controls and autoplay should be disabled.
     */
    inhibitInteraction?: boolean;
    /**
     * Whether the media should currently be shown instead of the preview button.
     */
    mediaVisible: boolean;
    /**
     * Callback invoked when the hidden-media preview is revealed.
     */
    onPreviewClick?: () => void;
    /**
     * Ref to the underlying video element used for replay after lazy decryption.
     */
    videoRef: RefObject<HTMLVideoElement | null>;
}

interface InternalState {
    /**
     * Decrypted playable media URL for encrypted videos.
     */
    decryptedUrl: string | null;
    /**
     * Decrypted thumbnail URL for encrypted videos.
     */
    decryptedThumbnailUrl: string | null;
    /**
     * Decrypted media blob cached for download or replay.
     */
    decryptedBlob: Blob | null;
    /**
     * Last media-processing error, if any.
     */
    error: unknown | null;
    /**
     * Whether an on-demand media fetch is in progress.
     */
    fetchingData: boolean;
    /**
     * Whether the blurhash poster is being shown while the real poster loads.
     */
    posterLoading: boolean;
    /**
     * Data URL generated from the blurhash placeholder.
     */
    blurhashUrl: string | null;
    /**
     * Current media sizing preference from settings.
     */
    imageSize: ImageSize;
}

type VideoInfoWithBlurhash = VideoInfo & {
    [BLURHASH_FIELD]?: string;
};

/**
 * View model for the video message body, encapsulating media-loading and playback state.
 */
export class VideoBodyViewModel
    extends BaseViewModel<VideoBodyViewSnapshot, VideoBodyViewModelProps>
    implements VideoBodyViewModelInterface
{
    private state: InternalState;

    public constructor(props: VideoBodyViewModelProps) {
        super(props, VideoBodyViewModel.computeSnapshot(props, VideoBodyViewModel.createInitialState()));

        this.state = VideoBodyViewModel.createInitialState();
        this.snapshot.set(VideoBodyViewModel.computeSnapshot(this.props, this.state));

        const imageSizeWatcherRef = SettingsStore.watchSetting("Images.size", null, (_s, _r, _l, _nvl, value) => {
            this.setImageSize(value as ImageSize);
        });
        this.disposables.track(() => SettingsStore.unwatchSetting(imageSizeWatcherRef));
    }

    public loadInitialMediaIfVisible(): void {
        if (this.props.mediaVisible) {
            void this.downloadVideo();
        }
    }

    private static createInitialState(): InternalState {
        return {
            fetchingData: false,
            decryptedUrl: null,
            decryptedThumbnailUrl: null,
            decryptedBlob: null,
            error: null,
            posterLoading: false,
            blurhashUrl: null,
            imageSize: SettingsStore.getValue("Images.size") as ImageSize,
        };
    }

    private static getAspectRatio(mxEvent: MatrixEvent): string | undefined {
        const { w, h } = (mxEvent.getContent<MediaEventContent>().info as VideoInfoWithBlurhash | undefined) ?? {};
        if (!w || !h) {
            return undefined;
        }

        return `${w}/${h}`;
    }

    private static getDimensions(mxEvent: MatrixEvent, imageSize: ImageSize): Required<{ w?: number; h?: number }> {
        const { w, h } = (mxEvent.getContent<MediaEventContent>().info as VideoInfoWithBlurhash | undefined) ?? {};
        return suggestedVideoSize(imageSize, { w, h });
    }

    private static getContentUrl(props: VideoBodyViewModelProps, state: InternalState): string | undefined {
        const content = props.mxEvent.getContent<MediaEventContent>();
        if (props.forExport) {
            return content.file?.url ?? content.url;
        }

        const media = mediaFromContent(content);
        if (media.isEncrypted) {
            return state.decryptedUrl ?? undefined;
        }

        return media.srcHttp ?? undefined;
    }

    private static getThumbnailUrl(props: VideoBodyViewModelProps, state: InternalState): string | null {
        if (props.forExport) {
            return null;
        }

        const content = props.mxEvent.getContent<MediaEventContent>();
        const media = mediaFromContent(content);

        if (media.isEncrypted && state.decryptedThumbnailUrl) {
            return state.decryptedThumbnailUrl;
        }
        if (state.posterLoading) {
            return state.blurhashUrl;
        }
        if (media.hasThumbnail) {
            return media.thumbnailHttp;
        }

        return null;
    }

    private static computeSnapshot(props: VideoBodyViewModelProps, state: InternalState): VideoBodyViewSnapshot {
        const content = props.mxEvent.getContent<MediaEventContent>();
        const autoplay = !props.inhibitInteraction && (SettingsStore.getValue("autoplayVideo") as boolean);
        const aspectRatio = VideoBodyViewModel.getAspectRatio(props.mxEvent);
        const { w: maxWidth, h: maxHeight } = VideoBodyViewModel.getDimensions(props.mxEvent, state.imageSize);

        if (state.error !== null) {
            return {
                state: VideoBodyViewState.ERROR,
                errorLabel: _t("timeline|m.video|error_decrypting"),
                maxWidth,
                maxHeight,
                aspectRatio,
            };
        }

        if (!props.mediaVisible) {
            return {
                state: VideoBodyViewState.HIDDEN,
                hiddenButtonLabel: _t("timeline|m.video|show_video"),
                maxWidth,
                maxHeight,
                aspectRatio,
            };
        }

        if (!props.forExport && content.file !== undefined && state.decryptedUrl === null && autoplay) {
            return {
                state: VideoBodyViewState.LOADING,
                maxWidth,
                maxHeight,
                aspectRatio,
            };
        }

        const thumbnailUrl = VideoBodyViewModel.getThumbnailUrl(props, state);
        let preload: VideoBodyViewSnapshot["preload"] = "metadata";
        let poster: string | undefined;
        if (content.info && thumbnailUrl) {
            preload = "none";
            poster = thumbnailUrl;
        }

        return {
            state: VideoBodyViewState.READY,
            videoLabel: content.body,
            videoTitle: content.body,
            maxWidth,
            maxHeight,
            aspectRatio,
            src: VideoBodyViewModel.getContentUrl(props, state),
            poster,
            preload,
            controls: !props.inhibitInteraction,
            muted: autoplay,
            autoPlay: autoplay,
        };
    }

    private updateSnapshotFromState(): void {
        this.snapshot.set(VideoBodyViewModel.computeSnapshot(this.props, this.state));
    }

    private hasContentUrl(): boolean {
        const url = VideoBodyViewModel.getContentUrl(this.props, this.state);
        return !!url && !url.startsWith("data:");
    }

    private setImageSize(imageSize: ImageSize): void {
        if (this.state.imageSize === imageSize) {
            return;
        }

        this.state = {
            ...this.state,
            imageSize,
        };
        this.updateSnapshotFromState();
    }

    private resetMediaState(): void {
        this.state = {
            ...this.state,
            decryptedUrl: null,
            decryptedThumbnailUrl: null,
            decryptedBlob: null,
            error: null,
            fetchingData: false,
            posterLoading: false,
            blurhashUrl: null,
        };
    }

    private loadBlurhash(): void {
        const info = this.props.mxEvent.getContent<MediaEventContent>().info as VideoInfoWithBlurhash | undefined;
        const blurhash = info?.[BLURHASH_FIELD];
        if (!blurhash) {
            return;
        }

        const canvas = document.createElement("canvas");
        const { w: width, h: height } = VideoBodyViewModel.getDimensions(this.props.mxEvent, this.state.imageSize);

        canvas.width = width;
        canvas.height = height;

        const pixels = decode(blurhash, width, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }

        const imgData = ctx.createImageData(width, height);
        imgData.data.set(pixels);
        ctx.putImageData(imgData, 0, 0);

        this.state = {
            ...this.state,
            blurhashUrl: canvas.toDataURL(),
            posterLoading: true,
        };
        this.updateSnapshotFromState();

        const media = mediaFromContent(this.props.mxEvent.getContent<MediaEventContent>());
        if (!media.hasThumbnail || !media.thumbnailHttp) {
            return;
        }

        const currentEvent = this.props.mxEvent;
        const image = new Image();
        image.onload = (): void => {
            if (this.isDisposed || currentEvent !== this.props.mxEvent || !this.state.posterLoading) {
                return;
            }

            this.state = {
                ...this.state,
                posterLoading: false,
            };
            this.updateSnapshotFromState();
        };
        image.src = media.thumbnailHttp;
    }

    private async downloadVideo(): Promise<void> {
        try {
            this.loadBlurhash();
        } catch (error) {
            logger.error("Failed to load blurhash", error);
        }

        if (!this.props.mediaEventHelper?.media.isEncrypted || this.state.decryptedUrl !== null) {
            return;
        }

        const currentEvent = this.props.mxEvent;
        const currentHelper = this.props.mediaEventHelper;
        try {
            const autoplay = !this.props.inhibitInteraction && (SettingsStore.getValue("autoplayVideo") as boolean);
            const thumbnailUrl = await currentHelper.thumbnailUrl.value;

            if (
                this.isDisposed ||
                currentEvent !== this.props.mxEvent ||
                currentHelper !== this.props.mediaEventHelper
            ) {
                return;
            }

            if (autoplay) {
                logger.log("Preloading video");
                this.state = {
                    ...this.state,
                    decryptedUrl: await currentHelper.sourceUrl.value,
                    decryptedThumbnailUrl: thumbnailUrl,
                    decryptedBlob: await currentHelper.sourceBlob.value,
                };
            } else {
                logger.log("NOT preloading video");
                const content = currentEvent.getContent<MediaEventContent>();
                let mimetype = content.info?.mimetype ?? "application/octet-stream";
                if (mimetype === "video/quicktime") {
                    mimetype = "video/mp4";
                }

                this.state = {
                    ...this.state,
                    decryptedUrl: `data:${mimetype},`,
                    decryptedThumbnailUrl: thumbnailUrl || `data:${mimetype},`,
                    decryptedBlob: null,
                };
            }

            this.updateSnapshotFromState();
        } catch (error) {
            if (
                this.isDisposed ||
                currentEvent !== this.props.mxEvent ||
                currentHelper !== this.props.mediaEventHelper
            ) {
                return;
            }

            logger.warn("Unable to decrypt attachment: ", error);
            this.state = {
                ...this.state,
                error,
            };
            this.updateSnapshotFromState();
        }
    }

    public setEvent(mxEvent: MatrixEvent, mediaEventHelper?: MediaEventHelper): void {
        if (this.props.mxEvent === mxEvent && this.props.mediaEventHelper === mediaEventHelper) {
            return;
        }

        this.props = {
            ...this.props,
            mxEvent,
            mediaEventHelper,
        };
        this.resetMediaState();
        this.updateSnapshotFromState();

        if (this.props.mediaVisible) {
            void this.downloadVideo();
        }
    }

    public setForExport(forExport?: boolean): void {
        if (this.props.forExport === forExport) {
            return;
        }

        this.props = {
            ...this.props,
            forExport,
        };
        this.updateSnapshotFromState();
    }

    public setInhibitInteraction(inhibitInteraction?: boolean): void {
        if (this.props.inhibitInteraction === inhibitInteraction) {
            return;
        }

        this.props = {
            ...this.props,
            inhibitInteraction,
        };
        this.updateSnapshotFromState();
    }

    public setMediaVisible(mediaVisible: boolean): void {
        if (this.props.mediaVisible === mediaVisible) {
            return;
        }

        this.props = {
            ...this.props,
            mediaVisible,
        };
        this.updateSnapshotFromState();

        if (mediaVisible) {
            void this.downloadVideo();
        }
    }

    public setOnPreviewClick(onPreviewClick?: () => void): void {
        if (this.props.onPreviewClick === onPreviewClick) {
            return;
        }

        this.props = {
            ...this.props,
            onPreviewClick,
        };
    }

    public onPreviewClick = (): void => {
        this.props.onPreviewClick?.();
    };

    public onPlay = async (): Promise<void> => {
        if (this.hasContentUrl() || this.state.fetchingData || this.state.error !== null) {
            return;
        }

        this.state = {
            ...this.state,
            fetchingData: true,
        };

        if (!this.props.mediaEventHelper?.media.isEncrypted) {
            this.state = {
                ...this.state,
                error: "No file given in content",
                fetchingData: false,
            };
            this.updateSnapshotFromState();
            return;
        }

        const currentEvent = this.props.mxEvent;
        const currentHelper = this.props.mediaEventHelper;

        try {
            const decryptedUrl = await currentHelper.sourceUrl.value;
            const decryptedBlob = await currentHelper.sourceBlob.value;

            if (
                this.isDisposed ||
                currentEvent !== this.props.mxEvent ||
                currentHelper !== this.props.mediaEventHelper
            ) {
                return;
            }

            this.state = {
                ...this.state,
                decryptedUrl,
                decryptedBlob,
                fetchingData: false,
            };
            this.updateSnapshotFromState();
            this.props.videoRef.current?.play();
        } catch (error) {
            if (
                this.isDisposed ||
                currentEvent !== this.props.mxEvent ||
                currentHelper !== this.props.mediaEventHelper
            ) {
                return;
            }

            logger.warn("Unable to decrypt attachment: ", error);
            this.state = {
                ...this.state,
                error,
                fetchingData: false,
            };
            this.updateSnapshotFromState();
        }
    };
}
