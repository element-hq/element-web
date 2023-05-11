/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 Michael Telatynski <7t3chguy@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { ComponentProps, createRef, ReactNode } from "react";
import { Blurhash } from "react-blurhash";
import classNames from "classnames";
import { CSSTransition, SwitchTransition } from "react-transition-group";
import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent, ClientEventHandlerMap } from "matrix-js-sdk/src/client";

import MFileBody from "./MFileBody";
import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import Spinner from "../elements/Spinner";
import { Media, mediaFromContent } from "../../../customisations/Media";
import { BLURHASH_FIELD, createThumbnail } from "../../../utils/image-media";
import { IMediaEventContent } from "../../../customisations/models/IMediaEventContent";
import ImageView from "../elements/ImageView";
import { IBodyProps } from "./IBodyProps";
import { ImageSize, suggestedSize as suggestedImageSize } from "../../../settings/enums/ImageSize";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import { blobIsAnimated, mayBeAnimated } from "../../../utils/Image";
import { presentableTextForFile } from "../../../utils/FileUtils";
import { createReconnectedListener } from "../../../utils/connection";
import MediaProcessingError from "./shared/MediaProcessingError";
import { DecryptError, DownloadError } from "../../../utils/DecryptFile";

enum Placeholder {
    NoImage,
    Blurhash,
}

interface IState {
    contentUrl: string | null;
    thumbUrl: string | null;
    isAnimated?: boolean;
    error?: Error;
    imgError: boolean;
    imgLoaded: boolean;
    loadedImageDimensions?: {
        naturalWidth: number;
        naturalHeight: number;
    };
    hover: boolean;
    showImage: boolean;
    placeholder: Placeholder;
}

export default class MImageBody extends React.Component<IBodyProps, IState> {
    public static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;

    private unmounted = true;
    private image = createRef<HTMLImageElement>();
    private timeout?: number;
    private sizeWatcher?: string;
    private reconnectedListener: ClientEventHandlerMap[ClientEvent.Sync];

    public constructor(props: IBodyProps) {
        super(props);

        this.reconnectedListener = createReconnectedListener(this.clearError);

        this.state = {
            contentUrl: null,
            thumbUrl: null,
            imgError: false,
            imgLoaded: false,
            hover: false,
            showImage: SettingsStore.getValue("showImages"),
            placeholder: Placeholder.NoImage,
        };
    }

    protected showImage(): void {
        localStorage.setItem("mx_ShowImage_" + this.props.mxEvent.getId(), "true");
        this.setState({ showImage: true });
        this.downloadImage();
    }

    protected onClick = (ev: React.MouseEvent): void => {
        if (ev.button === 0 && !ev.metaKey) {
            ev.preventDefault();
            if (!this.state.showImage) {
                this.showImage();
                return;
            }

            const content = this.props.mxEvent.getContent<IMediaEventContent>();
            const httpUrl = this.state.contentUrl;
            if (!httpUrl) return;
            const params: Omit<ComponentProps<typeof ImageView>, "onFinished"> = {
                src: httpUrl,
                name: content.body && content.body.length > 0 ? content.body : _t("Attachment"),
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

    protected onImageEnter = (e: React.MouseEvent<HTMLImageElement>): void => {
        this.setState({ hover: true });

        if (
            !this.state.contentUrl ||
            !this.state.showImage ||
            !this.state.isAnimated ||
            SettingsStore.getValue("autoplayGifs")
        ) {
            return;
        }
        const imgElement = e.currentTarget;
        imgElement.src = this.state.contentUrl;
    };

    protected onImageLeave = (e: React.MouseEvent<HTMLImageElement>): void => {
        this.setState({ hover: false });

        const url = this.state.thumbUrl ?? this.state.contentUrl;
        if (!url || !this.state.showImage || !this.state.isAnimated || SettingsStore.getValue("autoplayGifs")) {
            return;
        }
        const imgElement = e.currentTarget;
        imgElement.src = url;
    };

    private clearError = (): void => {
        MatrixClientPeg.get().off(ClientEvent.Sync, this.reconnectedListener);
        this.setState({ imgError: false });
    };

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
        MatrixClientPeg.get().on(ClientEvent.Sync, this.reconnectedListener);
    };

    private onImageLoad = (): void => {
        this.clearBlurhashTimeout();
        this.props.onHeightChanged?.();

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

        const content = this.props.mxEvent.getContent<IMediaEventContent>();
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
        if (this.props.mediaEventHelper.media.isEncrypted) {
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

        const content = this.props.mxEvent.getContent<IMediaEventContent>();
        let isAnimated = mayBeAnimated(content.info?.mimetype);

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
                    const blob = await this.props.mediaEventHelper.sourceBlob.value;
                    if (!(await blobIsAnimated(content.info?.mimetype, blob))) {
                        isAnimated = false;
                    }

                    if (isAnimated) {
                        const thumb = await createThumbnail(img, img.width, img.height, content.info!.mimetype, false);
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

        const showImage =
            this.state.showImage || localStorage.getItem("mx_ShowImage_" + this.props.mxEvent.getId()) === "true";

        if (showImage) {
            // noinspection JSIgnoredPromiseFromCall
            this.downloadImage();
            this.setState({ showImage: true });
        } // else don't download anything because we don't want to display anything.

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

    public componentWillUnmount(): void {
        this.unmounted = true;
        MatrixClientPeg.get().off(ClientEvent.Sync, this.reconnectedListener);
        this.clearBlurhashTimeout();
        if (this.sizeWatcher) SettingsStore.unwatchSetting(this.sizeWatcher);
        if (this.state.isAnimated && this.state.thumbUrl) {
            URL.revokeObjectURL(this.state.thumbUrl);
        }
    }

    protected getBanner(content: IMediaEventContent): ReactNode {
        // Hide it for the threads list & the file panel where we show it as text anyway.
        if (
            [TimelineRenderingType.ThreadsList, TimelineRenderingType.File].includes(this.context.timelineRenderingType)
        ) {
            return null;
        }

        return <span className="mx_MImageBody_banner">{presentableTextForFile(content, _t("Image"), true, true)}</span>;
    }

    protected messageContent(
        contentUrl: string | null,
        thumbUrl: string | null,
        content: IMediaEventContent,
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
                if (!this.state.showImage) {
                    imageElement = <HiddenImagePlaceholder />;
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

            placeholder = <div className={classes}>{this.getPlaceholder(maxWidth, maxHeight)}</div>;
        }

        let showPlaceholder = Boolean(placeholder);

        if (thumbUrl && !this.state.imgError) {
            // Restrict the width of the thumbnail here, otherwise it will fill the container
            // which has the same width as the timeline
            // mx_MImageBody_thumbnail resizes img to exactly container size
            img = (
                <img
                    className="mx_MImageBody_thumbnail"
                    src={thumbUrl}
                    ref={this.image}
                    alt={content.body}
                    onError={this.onImageError}
                    onLoad={this.onImageLoad}
                    onMouseEnter={this.onImageEnter}
                    onMouseLeave={this.onImageLeave}
                />
            );
        }

        if (!this.state.showImage) {
            img = <HiddenImagePlaceholder maxWidth={maxWidth} />;
            showPlaceholder = false; // because we're hiding the image, so don't show the placeholder.
        }

        if (this.state.isAnimated && !SettingsStore.getValue("autoplayGifs") && !this.state.hover) {
            // XXX: Arguably we may want a different label when the animated image is WEBP and not GIF
            gifLabel = <p className="mx_MImageBody_gifLabel">GIF</p>;
        }

        let banner: ReactNode | undefined;
        if (this.state.showImage && this.state.hover) {
            banner = this.getBanner(content);
        }

        // many SVGs don't have an intrinsic size if used in <img> elements.
        // due to this we have to set our desired width directly.
        // this way if the image is forced to shrink, the height adapts appropriately.
        const sizing = infoSvg ? { maxHeight, maxWidth, width: maxWidth } : { maxHeight, maxWidth };

        if (!this.props.forExport) {
            placeholder = (
                <SwitchTransition mode="out-in">
                    <CSSTransition classNames="mx_rtg--fade" key={`img-${showPlaceholder}`} timeout={300}>
                        {showPlaceholder ? placeholder : <></> /* Transition always expects a child */}
                    </CSSTransition>
                </SwitchTransition>
            );
        }

        const thumbnail = (
            <div
                className="mx_MImageBody_thumbnail_container"
                style={{ maxHeight, maxWidth, aspectRatio: `${infoWidth}/${infoHeight}` }}
            >
                {placeholder}

                <div style={sizing}>
                    {img}
                    {gifLabel}
                    {banner}
                </div>

                {/* HACK: This div fills out space while the image loads, to prevent scroll jumps */}
                {!this.props.forExport && !this.state.imgLoaded && (
                    <div style={{ height: maxHeight, width: maxWidth }} />
                )}

                {this.state.hover && this.getTooltip()}
            </div>
        );

        return this.wrapImage(contentUrl, thumbnail);
    }

    // Overridden by MStickerBody
    protected wrapImage(contentUrl: string | null | undefined, children: JSX.Element): ReactNode {
        if (contentUrl) {
            return (
                <a href={contentUrl} target={this.props.forExport ? "_blank" : undefined} onClick={this.onClick}>
                    {children}
                </a>
            );
        } else if (!this.state.showImage) {
            return (
                <div role="button" onClick={this.onClick}>
                    {children}
                </div>
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
    protected getTooltip(): ReactNode {
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
        const content = this.props.mxEvent.getContent<IMediaEventContent>();

        if (this.state.error) {
            let errorText = _t("Unable to show image due to error");
            if (this.state.error instanceof DecryptError) {
                errorText = _t("Error decrypting image");
            } else if (this.state.error instanceof DownloadError) {
                errorText = _t("Error downloading image");
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

interface PlaceholderIProps {
    hover?: boolean;
    maxWidth?: number;
}

export class HiddenImagePlaceholder extends React.PureComponent<PlaceholderIProps> {
    public render(): React.ReactNode {
        const maxWidth = this.props.maxWidth ? this.props.maxWidth + "px" : null;
        let className = "mx_HiddenImagePlaceholder";
        if (this.props.hover) className += " mx_HiddenImagePlaceholder_hover";
        return (
            <div className={className} style={{ maxWidth: `min(100%, ${maxWidth}px)` }}>
                <div className="mx_HiddenImagePlaceholder_button">
                    <span className="mx_HiddenImagePlaceholder_eye" />
                    <span>{_t("Show image")}</span>
                </div>
            </div>
        );
    }
}
