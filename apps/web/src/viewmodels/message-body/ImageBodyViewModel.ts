/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ComponentProps, type MouseEvent, type RefObject } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type ImageContent } from "matrix-js-sdk/src/types";
import {
    BaseViewModel,
    ImageBodyViewPlaceholder,
    ImageBodyViewState,
    type ImageBodyViewModel as ImageBodyViewModelInterface,
    type ImageBodyViewSnapshot,
} from "@element-hq/web-shared-components";

import Modal from "../../Modal";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { _t } from "../../languageHandler";
import { mediaFromContent } from "../../customisations/Media";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import SettingsStore from "../../settings/SettingsStore";
import { type ImageSize, suggestedSize as suggestedImageSize } from "../../settings/enums/ImageSize";
import { presentableTextForFile } from "../../utils/FileUtils";
import { type MediaEventHelper } from "../../utils/MediaEventHelper";
import { blobIsAnimated, mayBeAnimated } from "../../utils/Image";
import { type RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import { createReconnectedListener } from "../../utils/connection";
import { DecryptError, DownloadError } from "../../utils/DecryptFile";
import { BLURHASH_FIELD, createThumbnail } from "../../utils/image-media";
import { isMimeTypeAllowed } from "../../utils/blobs";
import ImageView from "../../components/views/elements/ImageView";

export interface ImageBodyViewModelProps {
    mxEvent: MatrixEvent;
    mediaEventHelper?: MediaEventHelper;
    forExport?: boolean;
    maxImageHeight?: number;
    mediaVisible: boolean;
    permalinkCreator?: RoomPermalinkCreator;
    timelineRenderingType: TimelineRenderingType;
    imageRef: RefObject<HTMLImageElement | null>;
    setMediaVisible?: (visible: boolean) => void;
}

interface LoadedImageDimensions {
    naturalWidth: number;
    naturalHeight: number;
}

interface InternalState {
    contentUrl: string | null;
    thumbUrl: string | null;
    isAnimated: boolean;
    error: unknown | null;
    imgError: boolean;
    imgLoaded: boolean;
    loadedImageDimensions?: LoadedImageDimensions;
    placeholder: ImageBodyViewPlaceholder;
    imageSize: ImageSize;
    generatedThumbnailUrl: string | null;
}

type ImageInfoWithAnimationFlag = NonNullable<ImageContent["info"]> & {
    "org.matrix.msc4230.is_animated"?: boolean;
};

export class ImageBodyViewModel
    extends BaseViewModel<ImageBodyViewSnapshot, ImageBodyViewModelProps>
    implements ImageBodyViewModelInterface
{
    private state: InternalState;
    private blurhashTimeout?: number;

    private readonly reconnectedListener = createReconnectedListener((): void => {
        MatrixClientPeg.get()?.off(ClientEvent.Sync, this.reconnectedListener);

        if (!this.state.imgError) {
            return;
        }

        this.state = {
            ...this.state,
            imgError: false,
        };
        this.updateSnapshotFromState();
    });

    public constructor(props: ImageBodyViewModelProps) {
        const initialState = ImageBodyViewModel.createInitialState(props.mxEvent);
        super(props, ImageBodyViewModel.computeSnapshot(props, initialState));
        this.state = initialState;

        const imageSizeWatcherRef = SettingsStore.watchSetting("Images.size", null, (_s, _r, _l, _nvl, value) => {
            this.setImageSize(value as ImageSize);
        });
        this.disposables.track(() => SettingsStore.unwatchSetting(imageSizeWatcherRef));
    }

    private static createInitialState(mxEvent: MatrixEvent): InternalState {
        return {
            contentUrl: null,
            thumbUrl: null,
            isAnimated: false,
            error: null,
            imgError: false,
            imgLoaded: false,
            loadedImageDimensions: undefined,
            placeholder: mxEvent.getContent<ImageContent>().info?.[BLURHASH_FIELD]
                ? ImageBodyViewPlaceholder.NONE
                : ImageBodyViewPlaceholder.SPINNER,
            imageSize: SettingsStore.getValue("Images.size") as ImageSize,
            generatedThumbnailUrl: null,
        };
    }

    private static getImageDimensions(
        props: ImageBodyViewModelProps,
        state: InternalState,
    ): Pick<ImageBodyViewSnapshot, "maxWidth" | "maxHeight" | "aspectRatio" | "isSvg"> {
        const content = props.mxEvent.getContent<ImageContent>();
        const info = content.info;
        const naturalWidth = info?.w ?? state.loadedImageDimensions?.naturalWidth;
        const naturalHeight = info?.h ?? state.loadedImageDimensions?.naturalHeight;

        if (!naturalWidth || !naturalHeight) {
            return {
                maxWidth: undefined,
                maxHeight: undefined,
                aspectRatio: undefined,
                isSvg: info?.mimetype === "image/svg+xml",
            };
        }

        const { w: maxWidth, h: maxHeight } = suggestedImageSize(
            state.imageSize,
            { w: naturalWidth, h: naturalHeight },
            props.maxImageHeight,
        );

        return {
            maxWidth,
            maxHeight,
            aspectRatio: `${naturalWidth}/${naturalHeight}`,
            isSvg: info?.mimetype === "image/svg+xml",
        };
    }

    private static computeErrorLabel(error: unknown, imgError: boolean): string {
        if (error instanceof DecryptError) {
            return _t("timeline|m.image|error_decrypting");
        }

        if (error instanceof DownloadError) {
            return _t("timeline|m.image|error_downloading");
        }

        if (imgError || error) {
            return _t("timeline|m.image|error");
        }

        return _t("timeline|m.image|error");
    }

    private static shouldShowBanner(timelineRenderingType: TimelineRenderingType): boolean {
        return ![TimelineRenderingType.ThreadsList, TimelineRenderingType.File].includes(timelineRenderingType);
    }

    private static computeSnapshot(props: ImageBodyViewModelProps, state: InternalState): ImageBodyViewSnapshot {
        const content = props.mxEvent.getContent<ImageContent>();
        const dimensions = ImageBodyViewModel.getImageDimensions(props, state);
        const autoplayGifs = SettingsStore.getValue("autoplayGifs") as boolean;
        const contentUrl = ImageBodyViewModel.getContentUrl(props, state);
        const thumbnailSrc = props.forExport
            ? contentUrl ?? undefined
            : state.isAnimated && autoplayGifs
              ? contentUrl ?? undefined
              : state.thumbUrl ?? contentUrl ?? undefined;

        if (state.error || state.imgError) {
            return {
                state: ImageBodyViewState.ERROR,
                errorLabel: ImageBodyViewModel.computeErrorLabel(state.error, state.imgError),
                ...dimensions,
            };
        }

        if (!props.mediaVisible) {
            return {
                state: ImageBodyViewState.HIDDEN,
                hiddenButtonLabel: _t("timeline|m.image|show_image"),
                ...dimensions,
            };
        }

        return {
            state: ImageBodyViewState.READY,
            alt: content.body,
            src: contentUrl ?? undefined,
            thumbnailSrc,
            showAnimatedContentOnHover: state.isAnimated && !autoplayGifs && !!contentUrl,
            placeholder: !props.forExport && !state.imgLoaded ? state.placeholder : ImageBodyViewPlaceholder.NONE,
            blurhash: content.info?.[BLURHASH_FIELD],
            gifLabel: state.isAnimated && !autoplayGifs ? "GIF" : undefined,
            bannerLabel: ImageBodyViewModel.shouldShowBanner(props.timelineRenderingType)
                ? presentableTextForFile(content, _t("common|image"), true, true)
                : undefined,
            linkUrl: contentUrl ?? undefined,
            linkTarget: props.forExport ? "_blank" : undefined,
            ...dimensions,
        };
    }

    private static getContentUrl(props: ImageBodyViewModelProps, state: InternalState): string | null {
        if (props.forExport) {
            return props.mxEvent.getContent<ImageContent>().url ?? props.mxEvent.getContent<ImageContent>().file?.url ?? null;
        }

        if (props.mediaEventHelper?.media.isEncrypted) {
            return state.contentUrl;
        }

        return mediaFromContent(props.mxEvent.getContent<ImageContent>()).srcHttp;
    }

    public loadInitialMediaIfVisible(): void {
        if (!this.props.mediaVisible) {
            return;
        }

        this.scheduleBlurhashPlaceholder();
        void this.downloadImage();
    }

    private updateSnapshotFromState(): void {
        this.snapshot.set(ImageBodyViewModel.computeSnapshot(this.props, this.state));
    }

    private resetState(mxEvent: MatrixEvent): void {
        this.clearBlurhashTimeout();
        MatrixClientPeg.get()?.off(ClientEvent.Sync, this.reconnectedListener);
        this.revokeGeneratedThumbnailUrl();
        this.state = ImageBodyViewModel.createInitialState(mxEvent);
    }

    private revokeGeneratedThumbnailUrl(): void {
        if (!this.state.generatedThumbnailUrl) {
            return;
        }

        URL.revokeObjectURL(this.state.generatedThumbnailUrl);
        this.state = {
            ...this.state,
            generatedThumbnailUrl: null,
        };
    }

    private clearBlurhashTimeout(): void {
        if (!this.blurhashTimeout) {
            return;
        }

        clearTimeout(this.blurhashTimeout);
        this.blurhashTimeout = undefined;
    }

    private scheduleBlurhashPlaceholder(): void {
        if (!this.props.mxEvent.getContent<ImageContent>().info?.[BLURHASH_FIELD] || this.state.imgLoaded || this.state.imgError) {
            return;
        }

        this.clearBlurhashTimeout();
        this.blurhashTimeout = window.setTimeout(() => {
            if (this.isDisposed || this.state.imgLoaded || this.state.imgError) {
                return;
            }

            this.state = {
                ...this.state,
                placeholder: ImageBodyViewPlaceholder.BLURHASH,
            };
            this.snapshot.merge({ placeholder: ImageBodyViewPlaceholder.BLURHASH });
        }, 150);
    }

    private getThumbUrl(): string | null {
        const thumbWidth = 800;
        const thumbHeight = 600;

        const content = this.props.mxEvent.getContent<ImageContent>();
        const media = mediaFromContent(content);
        const info = content.info;

        if (info?.mimetype === "image/svg+xml" && media.hasThumbnail) {
            return media.getThumbnailHttp(thumbWidth, thumbHeight, "scale");
        }

        if (this.state.isAnimated || window.devicePixelRatio === 1.0 || !info || !info.w || !info.h || !info.size) {
            return media.getThumbnailOfSourceHttp(thumbWidth, thumbHeight);
        }

        const isLargerThanThumbnail = info.w > thumbWidth || info.h > thumbHeight;
        const isLargeFileSize = info.size > 1 * 1024 * 1024;

        if (isLargeFileSize && isLargerThanThumbnail) {
            return media.getThumbnailOfSourceHttp(thumbWidth, thumbHeight);
        }

        return media.srcHttp;
    }

    private async downloadImage(): Promise<void> {
        if (this.state.contentUrl || this.props.forExport) {
            return;
        }

        let thumbUrl: string | null;
        let contentUrl: string | null;

        if (this.props.mediaEventHelper?.media.isEncrypted) {
            try {
                [contentUrl, thumbUrl] = await Promise.all([
                    this.props.mediaEventHelper.sourceUrl.value,
                    this.props.mediaEventHelper.thumbnailUrl.value,
                ]);
            } catch (error) {
                if (this.isDisposed) {
                    return;
                }

                if (error instanceof DecryptError) {
                    logger.error("Unable to decrypt attachment: ", error);
                } else if (error instanceof DownloadError) {
                    logger.error("Unable to download attachment to decrypt it: ", error);
                } else {
                    logger.error("Error encountered when downloading encrypted attachment: ", error);
                }

                this.state = {
                    ...this.state,
                    error: error as Error,
                };
                this.updateSnapshotFromState();
                return;
            }
        } else {
            contentUrl = ImageBodyViewModel.getContentUrl(this.props, this.state);
            thumbUrl = this.getThumbUrl();
        }

        const content = this.props.mxEvent.getContent<ImageContent>();
        let generatedThumbnailUrl: string | null = null;
        let isAnimated = (content.info as ImageInfoWithAnimationFlag | undefined)?.["org.matrix.msc4230.is_animated"];
        if (isAnimated === undefined) {
            isAnimated = mayBeAnimated(content.info?.mimetype);
        }

        const autoplayGifs = SettingsStore.getValue("autoplayGifs") as boolean;
        if (isAnimated && !autoplayGifs) {
            if (!thumbUrl || !content.info?.thumbnail_info || mayBeAnimated(content.info.thumbnail_info.mimetype)) {
                const image = document.createElement("img");
                const loadPromise = new Promise<void>((resolve, reject) => {
                    image.onload = (): void => resolve();
                    image.onerror = (): void => reject(new Error("Unable to load image"));
                });

                image.crossOrigin = "Anonymous";
                image.src = contentUrl ?? "";

                try {
                    await loadPromise;
                } catch (error) {
                    logger.error("Unable to download attachment: ", error);
                    this.state = {
                        ...this.state,
                        error: error as Error,
                    };
                    this.updateSnapshotFromState();
                    return;
                }

                try {
                    if (
                        (content.info as ImageInfoWithAnimationFlag | undefined)?.["org.matrix.msc4230.is_animated"] === false ||
                        (this.props.mediaEventHelper && (await blobIsAnimated(await this.props.mediaEventHelper.sourceBlob.value)) === false)
                    ) {
                        isAnimated = false;
                    }

                    if (isAnimated) {
                        const thumbnail = await createThumbnail(
                            image,
                            image.width,
                            image.height,
                            content.info?.mimetype ?? "image/jpeg",
                            false,
                        );
                        generatedThumbnailUrl = URL.createObjectURL(thumbnail.thumbnail);
                        thumbUrl = generatedThumbnailUrl;
                    }
                } catch (error) {
                    logger.warn("Unable to generate thumbnail for animated image: ", error);
                }
            }
        }

        if (this.isDisposed) {
            if (generatedThumbnailUrl) {
                URL.revokeObjectURL(generatedThumbnailUrl);
            }
            return;
        }

        this.revokeGeneratedThumbnailUrl();
        this.state = {
            ...this.state,
            contentUrl,
            thumbUrl,
            isAnimated,
            error: null,
            generatedThumbnailUrl,
        };
        this.updateSnapshotFromState();
    }

    private openImageViewer(event: MouseEvent<HTMLAnchorElement>): void {
        if (event.button !== 0 || event.metaKey) {
            return;
        }

        event.preventDefault();

        if (!this.props.mediaVisible) {
            this.props.setMediaVisible?.(true);
            return;
        }

        const content = this.props.mxEvent.getContent<ImageContent>();

        let httpUrl = this.state.contentUrl;
        if (
            this.props.mediaEventHelper?.media.isEncrypted &&
            !isMimeTypeAllowed(this.props.mediaEventHelper.sourceBlob.cachedValue?.type ?? "")
        ) {
            httpUrl = this.state.thumbUrl;
        }

        if (!httpUrl) {
            return;
        }

        const params: Omit<ComponentProps<typeof ImageView>, "onFinished"> = {
            src: httpUrl,
            name: content.body && content.body.length > 0 ? content.body : _t("common|attachment"),
            mxEvent: this.props.mxEvent,
            permalinkCreator: this.props.permalinkCreator,
        };

        if (content.info) {
            params.width = content.info.w;
            params.height = content.info.h;
            params.fileSize = content.info.size;
        }

        if (this.props.imageRef.current) {
            const clientRect = this.props.imageRef.current.getBoundingClientRect();
            params.thumbnailInfo = {
                width: clientRect.width,
                height: clientRect.height,
                positionX: clientRect.x,
                positionY: clientRect.y,
            };
        }

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    }

    public onLinkClick = (event: MouseEvent<HTMLAnchorElement>): void => {
        this.openImageViewer(event);
    };

    public onHiddenButtonClick = (): void => {
        this.props.setMediaVisible?.(true);
    };

    public onImageError = (): void => {
        if (this.state.thumbUrl && this.state.thumbUrl !== this.state.contentUrl) {
            this.state = {
                ...this.state,
                thumbUrl: null,
            };
            this.updateSnapshotFromState();
            return;
        }

        this.clearBlurhashTimeout();

        if (this.state.imgError) {
            return;
        }

        this.state = {
            ...this.state,
            imgError: true,
        };
        MatrixClientPeg.safeGet().on(ClientEvent.Sync, this.reconnectedListener);
        this.updateSnapshotFromState();
    };

    public onImageLoad = (): void => {
        this.clearBlurhashTimeout();

        let loadedImageDimensions: LoadedImageDimensions | undefined;
        if (this.props.imageRef.current) {
            const { naturalWidth, naturalHeight } = this.props.imageRef.current;
            loadedImageDimensions = { naturalWidth, naturalHeight };
        }

        this.state = {
            ...this.state,
            imgLoaded: true,
            loadedImageDimensions,
            placeholder: ImageBodyViewPlaceholder.NONE,
        };
        this.updateSnapshotFromState();
    };

    public setEvent(mxEvent: MatrixEvent, mediaEventHelper?: MediaEventHelper): void {
        if (this.props.mxEvent === mxEvent && this.props.mediaEventHelper === mediaEventHelper) {
            return;
        }

        const previousVisible = this.props.mediaVisible;
        this.props = {
            ...this.props,
            mxEvent,
            mediaEventHelper,
        };
        this.resetState(mxEvent);
        this.updateSnapshotFromState();

        if (previousVisible) {
            this.scheduleBlurhashPlaceholder();
            void this.downloadImage();
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

    public setMaxImageHeight(maxImageHeight?: number): void {
        if (this.props.maxImageHeight === maxImageHeight) {
            return;
        }

        this.props = {
            ...this.props,
            maxImageHeight,
        };
        this.updateSnapshotFromState();
    }

    public setMediaVisible(mediaVisible: boolean): void {
        if (this.props.mediaVisible === mediaVisible) {
            return;
        }

        const wasVisible = this.props.mediaVisible;
        this.props = {
            ...this.props,
            mediaVisible,
        };
        this.updateSnapshotFromState();

        if (!wasVisible && mediaVisible) {
            this.scheduleBlurhashPlaceholder();
            void this.downloadImage();
        }
    }

    public setPermalinkCreator(permalinkCreator?: RoomPermalinkCreator): void {
        if (this.props.permalinkCreator === permalinkCreator) {
            return;
        }

        this.props = {
            ...this.props,
            permalinkCreator,
        };
    }

    public setTimelineRenderingType(timelineRenderingType: TimelineRenderingType): void {
        if (this.props.timelineRenderingType === timelineRenderingType) {
            return;
        }

        this.props = {
            ...this.props,
            timelineRenderingType,
        };
        this.snapshot.merge(ImageBodyViewModel.computeSnapshot(this.props, this.state));
    }

    public setSetMediaVisible(setMediaVisible?: (visible: boolean) => void): void {
        if (this.props.setMediaVisible === setMediaVisible) {
            return;
        }

        this.props = {
            ...this.props,
            setMediaVisible,
        };
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

    public dispose(): void {
        this.clearBlurhashTimeout();
        MatrixClientPeg.get()?.off(ClientEvent.Sync, this.reconnectedListener);
        this.revokeGeneratedThumbnailUrl();
        super.dispose();
    }
}
