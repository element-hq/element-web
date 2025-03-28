/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ComponentProps, createRef, type ReactNode } from "react";
import { Blurhash } from "react-blurhash";
import classNames from "classnames";
import { CSSTransition, SwitchTransition } from "react-transition-group";
import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent } from "matrix-js-sdk/src/matrix";
import { type ImageContent } from "matrix-js-sdk/src/types";
import { Tooltip } from "@vector-im/compound-web";

import MFileBody from "./MFileBody";
import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import Spinner from "../elements/Spinner";
import { type Media, mediaFromContent } from "../../../customisations/Media";
import { BLURHASH_FIELD, createThumbnail } from "../../../utils/image-media";
import ImageView from "../elements/ImageView";
import { type IBodyProps } from "./IBodyProps";
import { type ImageSize, suggestedSize as suggestedImageSize } from "../../../settings/enums/ImageSize";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import { blobIsAnimated, mayBeAnimated } from "../../../utils/Image";
import { presentableTextForFile } from "../../../utils/FileUtils";
import { createReconnectedListener } from "../../../utils/connection";
import MediaProcessingError from "./shared/MediaProcessingError";
import { DecryptError, DownloadError } from "../../../utils/DecryptFile";
import { HiddenMediaPlaceholder } from "./HiddenMediaPlaceholder";
import { useMediaVisible } from "../../../hooks/useMediaVisible";

enum Placeholder {
    NoImage,
    Blurhash,
}

interface IState {
    contentUrl: string | null;
    thumbUrl: string | null;
    isAnimated?: boolean;
    error?: unknown;
    imgError: boolean;
    imgLoaded: boolean;
    loadedImageDimensions?: {
        naturalWidth: number;
        naturalHeight: number;
    };
    hover: boolean;
    focus: boolean;
    placeholder: Placeholder;
}

interface IProps extends IBodyProps {
    /**
     * Should the media be behind a preview.
     */
    mediaVisible: boolean;
    /**
     * Set the visibility of the media event.
     * @param visible Should the event be visible.
     */
    setMediaVisible: (visible: boolean) => void;
}

/**
 * @private Only use for inheritance. Use the default export for presentation.
 */
export class MImageBodyInner extends React.Component<IProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private unmounted = false;
    private image = createRef<HTMLImageElement>();
    private placeholder = createRef<HTMLDivElement>();
    private timeout?: number;
    private sizeWatcher?: string;

    public state: IState = {
        contentUrl: null,
        thumbUrl: null,
        imgError: false,
        imgLoaded: false,
        hover: false,
        focus: false,
        placeholder: Placeholder.NoImage,
    };

    protected onClick = (ev: React.MouseEvent): void => {
        if (ev.button === 0 && !ev.metaKey) {
            ev.preventDefault();
            if (!this.props.mediaVisible) {
                this.props.setMediaVisible(true);
                return;
            }

            const content = this.props.mxEvent.getContent<ImageContent>();
            const httpUrl = this.state.contentUrl;
            if (!httpUrl) return;
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

            if (this.image.current) {
                const clientRect = this.image.current.getBoundingClientRect();

                params.thumbnailInfo = {
                    width: clientRect.width,
                    height: clientRect.height,
                    positionX: clientRect.x,
                    positionY: clientRect.y,
                };
            }

            Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
        }
    };

    private get shouldAutoplay(): boolean {
        return !(
            !this.state.contentUrl ||
            !this.props.mediaVisible ||
            !this.state.isAnimated ||
            SettingsStore.getValue("autoplayGifs")
        );
    }

    protected onImageEnter = (): void => {
        this.setState({ hover: true });
    };

    protected onImageLeave = (): void => {
        this.setState({ hover: false });
    };

    private onFocus = (): void => {
        this.setState({ focus: true });
    };

    private onBlur = (): void => {
        this.setState({ focus: false });
    };

    private reconnectedListener = createReconnectedListener((): void => {
        MatrixClientPeg.get()?.off(ClientEvent.Sync, this.reconnectedListener);
        this.setState({ imgError: false });
    });

    private onImageError = (): void => {
        // If the thumbnail failed to load then try again using the contentUrl
        if (this.state.thumbUrl) {
            this.setState({
                thumbUrl: null,
            });
            return;
        }

        this.clearBlurhashTimeout();
        this.setState({
            imgError: true,
        });
        MatrixClientPeg.safeGet().on(ClientEvent.Sync, this.reconnectedListener);
    };

    private onImageLoad = (): void => {
        this.clearBlurhashTimeout();

        let loadedImageDimensions: IState["loadedImageDimensions"];

        if (this.image.current) {
            const { naturalWidth, naturalHeight } = this.image.current;
            // this is only used as a fallback in case content.info.w/h is missing
            loadedImageDimensions = { naturalWidth, naturalHeight };
        }
        this.setState({ imgLoaded: true, loadedImageDimensions });
    };

    private getContentUrl(): string | null {
        // During export, the content url will point to the MSC, which will later point to a local url
        if (this.props.forExport) return this.media.srcMxc;
        return this.media.srcHttp;
    }

    private get media(): Media {
        return mediaFromContent(this.props.mxEvent.getContent());
    }

    private getThumbUrl(): string | null {
        // FIXME: we let images grow as wide as you like, rather than capped to 800x600.
        // So either we need to support custom timeline widths here, or reimpose the cap, otherwise the
        // thumbnail resolution will be unnecessarily reduced.
        // custom timeline widths seems preferable.
        const thumbWidth = 800;
        const thumbHeight = 600;

        const content = this.props.mxEvent.getContent<ImageContent>();
        const media = mediaFromContent(content);
        const info = content.info;

        if (info?.mimetype === "image/svg+xml" && media.hasThumbnail) {
            // Special-case to return clientside sender-generated thumbnails for SVGs, if any,
            // given we deliberately don't thumbnail them serverside to prevent billion lol attacks and similar.
            return media.getThumbnailHttp(thumbWidth, thumbHeight, "scale");
        }

        // we try to download the correct resolution for hi-res images (like retina screenshots).
        // Synapse only supports 800x600 thumbnails for now though,
        // so we'll need to download the original image for this to work  well for now.
        // First, let's try a few cases that let us avoid downloading the original, including:
        //   - When displaying a GIF, we always want to thumbnail so that we can
        //     properly respect the user's GIF autoplay setting (which relies on
        //     thumbnailing to produce the static preview image)
        //   - On a low DPI device, always thumbnail to save bandwidth
        //   - If there's no sizing info in the event, default to thumbnail
        if (this.state.isAnimated || window.devicePixelRatio === 1.0 || !info || !info.w || !info.h || !info.size) {
            return media.getThumbnailOfSourceHttp(thumbWidth, thumbHeight);
        }

        // We should only request thumbnails if the image is bigger than 800x600 (or 1600x1200 on retina) otherwise
        // the image in the timeline will just end up resampled and de-retina'd for no good reason.
        // Ideally the server would pre-gen 1600x1200 thumbnails in order to provide retina thumbnails,
        // but we don't do this currently in synapse for fear of disk space.
        // As a compromise, let's switch to non-retina thumbnails only if the original image is both
        // physically too large and going to be massive to load in the timeline (e.g. >1MB).

        const isLargerThanThumbnail = info.w > thumbWidth || info.h > thumbHeight;
        const isLargeFileSize = info.size > 1 * 1024 * 1024; // 1mb

        if (isLargeFileSize && isLargerThanThumbnail) {
            // image is too large physically and byte-wise to clutter our timeline so,
            // we ask for a thumbnail, despite knowing that it will be max 800x600
            // despite us being retina (as synapse doesn't do 1600x1200 thumbs yet).
            return media.getThumbnailOfSourceHttp(thumbWidth, thumbHeight);
        }

        // download the original image otherwise, so we can scale it client side to take pixelRatio into account.
        return media.srcHttp;
    }

    private async downloadImage(): Promise<void> {
        if (this.state.contentUrl) return; // already downloaded

        let thumbUrl: string | null;
        let contentUrl: string | null;
        if (this.props.mediaEventHelper?.media.isEncrypted) {
            try {
                [contentUrl, thumbUrl] = await Promise.all([
                    this.props.mediaEventHelper.sourceUrl.value,
                    this.props.mediaEventHelper.thumbnailUrl.value,
                ]);
            } catch (error) {
                if (this.unmounted) return;

                if (error instanceof DecryptError) {
                    logger.error("Unable to decrypt attachment: ", error);
                } else if (error instanceof DownloadError) {
                    logger.error("Unable to download attachment to decrypt it: ", error);
                } else {
                    logger.error("Error encountered when downloading encrypted attachment: ", error);
                }

                // Set a placeholder image when we can't decrypt the image.
                this.setState({ error });
                return;
            }
        } else {
            thumbUrl = this.getThumbUrl();
            contentUrl = this.getContentUrl();
        }

        const content = this.props.mxEvent.getContent<ImageContent>();
        let isAnimated = content.info?.["org.matrix.msc4230.is_animated"] ?? mayBeAnimated(content.info?.mimetype);

        // If there is no included non-animated thumbnail then we will generate our own, we can't depend on the server
        // because 1. encryption and 2. we can't ask the server specifically for a non-animated thumbnail.
        if (isAnimated && !SettingsStore.getValue("autoplayGifs")) {
            if (!thumbUrl || !content?.info?.thumbnail_info || mayBeAnimated(content.info.thumbnail_info.mimetype)) {
                const img = document.createElement("img");
                const loadPromise = new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                img.crossOrigin = "Anonymous"; // CORS allow canvas access
                img.src = contentUrl ?? "";

                try {
                    await loadPromise;
                } catch (error) {
                    logger.error("Unable to download attachment: ", error);
                    this.setState({ error: error as Error });
                    return;
                }

                try {
                    // If we didn't receive the MSC4230 is_animated flag
                    // then we need to check if the image is animated by downloading it.
                    if (
                        content.info?.["org.matrix.msc4230.is_animated"] === false ||
                        !(await blobIsAnimated(
                            content.info?.mimetype,
                            await this.props.mediaEventHelper!.sourceBlob.value,
                        ))
                    ) {
                        isAnimated = false;
                    }

                    if (isAnimated) {
                        const thumb = await createThumbnail(
                            img,
                            img.width,
                            img.height,
                            content.info?.mimetype ?? "image/jpeg",
                            false,
                        );
                        thumbUrl = URL.createObjectURL(thumb.thumbnail);
                    }
                } catch (error) {
                    // This is a non-critical failure, do not surface the error or bail the method here
                    logger.warn("Unable to generate thumbnail for animated image: ", error);
                }
            }
        }

        if (this.unmounted) return;
        this.setState({
            contentUrl,
            thumbUrl,
            isAnimated,
        });
    }

    private clearBlurhashTimeout(): void {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
    }

    public componentDidMount(): void {
        this.unmounted = false;

        if (this.props.mediaVisible) {
            // noinspection JSIgnoredPromiseFromCall
            this.downloadImage();
        }

        // Add a 150ms timer for blurhash to first appear.
        if (this.props.mxEvent.getContent().info?.[BLURHASH_FIELD]) {
            this.clearBlurhashTimeout();
            this.timeout = window.setTimeout(() => {
                if (!this.state.imgLoaded || !this.state.imgError) {
                    this.setState({
                        placeholder: Placeholder.Blurhash,
                    });
                }
            }, 150);
        }

        this.sizeWatcher = SettingsStore.watchSetting("Images.size", null, () => {
            this.forceUpdate(); // we don't really have a reliable thing to update, so just update the whole thing
        });
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (!prevProps.mediaVisible && this.props.mediaVisible) {
            // noinspection JSIgnoredPromiseFromCall
            this.downloadImage();
        }
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        MatrixClientPeg.get()?.off(ClientEvent.Sync, this.reconnectedListener);
        this.clearBlurhashTimeout();
        SettingsStore.unwatchSetting(this.sizeWatcher);
        if (this.state.isAnimated && this.state.thumbUrl) {
            URL.revokeObjectURL(this.state.thumbUrl);
        }
    }

    protected getBanner(content: ImageContent): ReactNode {
        // Hide it for the threads list & the file panel where we show it as text anyway.
        if (
            [TimelineRenderingType.ThreadsList, TimelineRenderingType.File].includes(this.context.timelineRenderingType)
        ) {
            return null;
        }

        return (
            <span className="mx_MImageBody_banner">
                {presentableTextForFile(content, _t("common|image"), true, true)}
            </span>
        );
    }

    protected messageContent(
        contentUrl: string | null,
        thumbUrl: string | null,
        content: ImageContent,
        forcedHeight?: number,
    ): ReactNode {
        if (!thumbUrl) thumbUrl = contentUrl; // fallback

        // magic number
        // edge case for this not to be set by conditions below
        let infoWidth = 500;
        let infoHeight = 500;
        let infoSvg = false;

        if (content.info?.w && content.info?.h) {
            infoWidth = content.info.w;
            infoHeight = content.info.h;
            infoSvg = content.info.mimetype === "image/svg+xml";
        } else if (thumbUrl && contentUrl) {
            // Whilst the image loads, display nothing. We also don't display a blurhash image
            // because we don't really know what size of image we'll end up with.
            //
            // Once loaded, use the loaded image dimensions stored in `loadedImageDimensions`.
            //
            // By doing this, the image "pops" into the timeline, but is still restricted
            // by the same width and height logic below.
            if (!this.state.loadedImageDimensions) {
                let imageElement: JSX.Element;
                if (!this.props.mediaVisible) {
                    imageElement = (
                        <HiddenMediaPlaceholder onClick={this.onClick}>
                            {_t("timeline|m.image|show_image")}
                        </HiddenMediaPlaceholder>
                    );
                } else {
                    imageElement = (
                        <img
                            style={{ display: "none" }}
                            src={thumbUrl}
                            ref={this.image}
                            alt={content.body}
                            onError={this.onImageError}
                            onLoad={this.onImageLoad}
                        />
                    );
                }
                return this.wrapImage(contentUrl, imageElement);
            }
            infoWidth = this.state.loadedImageDimensions.naturalWidth;
            infoHeight = this.state.loadedImageDimensions.naturalHeight;
        }

        // The maximum size of the thumbnail as it is rendered as an <img>,
        // accounting for any height constraints
        const { w: maxWidth, h: maxHeight } = suggestedImageSize(
            SettingsStore.getValue("Images.size") as ImageSize,
            { w: infoWidth, h: infoHeight },
            forcedHeight ?? this.props.maxImageHeight,
        );

        let img: JSX.Element | undefined;
        let placeholder: JSX.Element | undefined;
        let gifLabel: JSX.Element | undefined;

        if (!this.props.forExport && !this.state.imgLoaded) {
            const classes = classNames("mx_MImageBody_placeholder", {
                "mx_MImageBody_placeholder--blurhash": this.props.mxEvent.getContent().info?.[BLURHASH_FIELD],
            });

            placeholder = (
                <div className={classes} ref={this.placeholder}>
                    {this.getPlaceholder(maxWidth, maxHeight)}
                </div>
            );
        }

        let showPlaceholder = Boolean(placeholder);

        const hoverOrFocus = this.state.hover || this.state.focus;
        if (thumbUrl && !this.state.imgError) {
            let url = thumbUrl;
            if (hoverOrFocus && this.shouldAutoplay) {
                url = this.state.contentUrl!;
            }

            // Restrict the width of the thumbnail here, otherwise it will fill the container
            // which has the same width as the timeline
            // mx_MImageBody_thumbnail resizes img to exactly container size
            img = (
                <img
                    className="mx_MImageBody_thumbnail"
                    src={url}
                    ref={this.image}
                    alt={content.body}
                    onError={this.onImageError}
                    onLoad={this.onImageLoad}
                    onMouseEnter={this.onImageEnter}
                    onMouseLeave={this.onImageLeave}
                />
            );
        }

        if (!this.props.mediaVisible) {
            img = (
                <div style={{ width: maxWidth, height: maxHeight }}>
                    <HiddenMediaPlaceholder onClick={this.onClick}>
                        {_t("timeline|m.image|show_image")}
                    </HiddenMediaPlaceholder>
                </div>
            );
            showPlaceholder = false; // because we're hiding the image, so don't show the placeholder.
        }

        if (this.state.isAnimated && !SettingsStore.getValue("autoplayGifs") && !hoverOrFocus) {
            // XXX: Arguably we may want a different label when the animated image is WEBP and not GIF
            gifLabel = <p className="mx_MImageBody_gifLabel">GIF</p>;
        }

        let banner: ReactNode | undefined;
        if (this.props.mediaVisible && hoverOrFocus) {
            banner = this.getBanner(content);
        }

        // many SVGs don't have an intrinsic size if used in <img> elements.
        // due to this we have to set our desired width directly.
        // this way if the image is forced to shrink, the height adapts appropriately.
        const sizing = infoSvg ? { maxHeight, maxWidth, width: maxWidth } : { maxHeight, maxWidth };

        if (!this.props.forExport) {
            placeholder = (
                <SwitchTransition mode="out-in">
                    <CSSTransition
                        classNames="mx_rtg--fade"
                        key={`img-${showPlaceholder}`}
                        timeout={300}
                        nodeRef={this.placeholder}
                    >
                        {
                            showPlaceholder ? (
                                placeholder
                            ) : (
                                <div ref={this.placeholder} />
                            ) /* Transition always expects a child */
                        }
                    </CSSTransition>
                </SwitchTransition>
            );
        }

        const tooltipProps = this.getTooltipProps();
        let thumbnail = (
            <div
                className="mx_MImageBody_thumbnail_container"
                style={{ maxHeight, maxWidth, aspectRatio: `${infoWidth}/${infoHeight}` }}
                tabIndex={tooltipProps ? 0 : undefined}
            >
                {placeholder}

                <div style={sizing}>
                    {img}
                    {gifLabel}
                    {banner}
                </div>

                {/* HACK: This div fills out space while the image loads, to prevent scroll jumps */}
                {!this.props.forExport && !this.state.imgLoaded && !placeholder && (
                    <div style={{ height: maxHeight, width: maxWidth }} />
                )}
            </div>
        );

        if (tooltipProps) {
            // We specify isTriggerInteractive=true and make the div interactive manually as a workaround for
            // https://github.com/element-hq/compound/issues/294
            thumbnail = (
                <Tooltip {...tooltipProps} isTriggerInteractive={true}>
                    {thumbnail}
                </Tooltip>
            );
        }

        return this.wrapImage(contentUrl, thumbnail);
    }

    // Overridden by MStickerBody
    protected wrapImage(contentUrl: string | null | undefined, children: JSX.Element): ReactNode {
        if (contentUrl) {
            return (
                <a
                    href={contentUrl}
                    target={this.props.forExport ? "_blank" : undefined}
                    onClick={this.onClick}
                    onFocus={this.onFocus}
                    onBlur={this.onBlur}
                >
                    {children}
                </a>
            );
        }
        return children;
    }

    // Overridden by MStickerBody
    protected getPlaceholder(width: number, height: number): ReactNode {
        const blurhash = this.props.mxEvent.getContent().info?.[BLURHASH_FIELD];

        if (blurhash) {
            if (this.state.placeholder === Placeholder.NoImage) {
                return null;
            } else if (this.state.placeholder === Placeholder.Blurhash) {
                return <Blurhash className="mx_Blurhash" hash={blurhash} width={width} height={height} />;
            }
        }
        return <Spinner w={32} h={32} />;
    }

    // Overridden by MStickerBody
    protected getTooltipProps(): ComponentProps<typeof Tooltip> | null {
        return null;
    }

    // Overridden by MStickerBody
    protected getFileBody(): ReactNode {
        if (this.props.forExport) return null;
        /*
         * In the room timeline or the thread context we don't need the download
         * link as the message action bar will fulfill that
         */
        const hasMessageActionBar =
            this.context.timelineRenderingType === TimelineRenderingType.Room ||
            this.context.timelineRenderingType === TimelineRenderingType.Pinned ||
            this.context.timelineRenderingType === TimelineRenderingType.Search ||
            this.context.timelineRenderingType === TimelineRenderingType.Thread ||
            this.context.timelineRenderingType === TimelineRenderingType.ThreadsList;
        if (!hasMessageActionBar) {
            return <MFileBody {...this.props} showGenericPlaceholder={false} />;
        }
    }

    public render(): React.ReactNode {
        const content = this.props.mxEvent.getContent<ImageContent>();

        if (this.state.error) {
            let errorText = _t("timeline|m.image|error");
            if (this.state.error instanceof DecryptError) {
                errorText = _t("timeline|m.image|error_decrypting");
            } else if (this.state.error instanceof DownloadError) {
                errorText = _t("timeline|m.image|error_downloading");
            }

            return <MediaProcessingError className="mx_MImageBody">{errorText}</MediaProcessingError>;
        }

        let contentUrl = this.state.contentUrl;
        let thumbUrl: string | null;
        if (this.props.forExport) {
            contentUrl = this.props.mxEvent.getContent().url ?? this.props.mxEvent.getContent().file?.url;
            thumbUrl = contentUrl;
        } else if (this.state.isAnimated && SettingsStore.getValue("autoplayGifs")) {
            thumbUrl = contentUrl;
        } else {
            thumbUrl = this.state.thumbUrl ?? this.state.contentUrl;
        }

        const thumbnail = this.messageContent(contentUrl, thumbUrl, content);
        const fileBody = this.getFileBody();

        return (
            <div className="mx_MImageBody">
                {thumbnail}
                {fileBody}
            </div>
        );
    }
}

// Wrap MImageBody component so we can use a hook here.
const MImageBody: React.FC<IBodyProps> = (props) => {
    const [mediaVisible, setVisible] = useMediaVisible(props.mxEvent.getId()!);
    return <MImageBodyInner mediaVisible={mediaVisible} setMediaVisible={setVisible} {...props} />;
};

export default MImageBody;
