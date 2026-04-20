/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 Tulir Asokan <tulir@maunium.net>

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
import { ImageErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

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
import { isMimeTypeAllowed } from "../../../utils/blobs.ts";
import { FileBodyFactory, renderMBody } from "./MBodyFactory";

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

export interface ImageBodyBaseProps extends IBodyProps {
    mediaVisible: boolean;
    setMediaVisible: (visible: boolean) => void;
}

export class ImageBodyBaseInner extends React.Component<ImageBodyBaseProps, IState> {
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

            let httpUrl = this.state.contentUrl;
            if (
                this.props.mediaEventHelper?.media.isEncrypted &&
                !isMimeTypeAllowed(this.props.mediaEventHelper.sourceBlob.cachedValue?.type ?? "")
            ) {
                httpUrl = this.state.thumbUrl;
            }

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
            loadedImageDimensions = { naturalWidth, naturalHeight };
        }
        this.setState({ imgLoaded: true, loadedImageDimensions });
    };

    private getContentUrl(): string | null {
        if (this.props.forExport) return this.media.srcMxc;
        return this.media.srcHttp;
    }

    private get media(): Media {
        return mediaFromContent(this.props.mxEvent.getContent());
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
        if (this.state.contentUrl) return;

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

                this.setState({ error });
                return;
            }
        } else {
            thumbUrl = this.getThumbUrl();
            contentUrl = this.getContentUrl();
        }

        const content = this.props.mxEvent.getContent<ImageContent>();
        let isAnimated = content.info?.["org.matrix.msc4230.is_animated"] ?? mayBeAnimated(content.info?.mimetype);

        if (isAnimated && !SettingsStore.getValue("autoplayGifs")) {
            if (!thumbUrl || !content?.info?.thumbnail_info || mayBeAnimated(content.info.thumbnail_info.mimetype)) {
                const img = document.createElement("img");
                const loadPromise = new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                img.crossOrigin = "Anonymous";
                img.src = contentUrl ?? "";

                try {
                    await loadPromise;
                } catch (error) {
                    logger.error("Unable to download attachment: ", error);
                    this.setState({ error: error as Error });
                    return;
                }

                try {
                    if (
                        content.info?.["org.matrix.msc4230.is_animated"] === false ||
                        (await blobIsAnimated(await this.props.mediaEventHelper!.sourceBlob.value)) === false
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
            void this.downloadImage();
        }

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
            this.forceUpdate();
        });
    }

    public componentDidUpdate(prevProps: Readonly<ImageBodyBaseProps>): void {
        if (!prevProps.mediaVisible && this.props.mediaVisible) {
            void this.downloadImage();
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
        if (!thumbUrl) thumbUrl = contentUrl;

        let infoWidth = 500;
        let infoHeight = 500;
        let infoSvg = false;

        if (content.info?.w && content.info?.h) {
            infoWidth = content.info.w;
            infoHeight = content.info.h;
            infoSvg = content.info.mimetype === "image/svg+xml";
        } else if (thumbUrl && contentUrl) {
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
            showPlaceholder = false;
        }

        if (this.state.isAnimated && !SettingsStore.getValue("autoplayGifs") && !hoverOrFocus) {
            gifLabel = <p className="mx_MImageBody_gifLabel">GIF</p>;
        }

        let banner: ReactNode | undefined;
        if (this.props.mediaVisible && hoverOrFocus) {
            banner = this.getBanner(content);
        }

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
                        {showPlaceholder ? placeholder : <div ref={this.placeholder} />}
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

                {!this.props.forExport && !this.state.imgLoaded && !placeholder && (
                    <div style={{ height: maxHeight, width: maxWidth }} />
                )}
            </div>
        );

        if (tooltipProps) {
            thumbnail = (
                <Tooltip {...tooltipProps} isTriggerInteractive={true}>
                    {thumbnail}
                </Tooltip>
            );
        }

        return this.wrapImage(contentUrl, thumbnail);
    }

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

    protected getPlaceholder(width: number, height: number): ReactNode {
        const blurhash = this.props.mxEvent.getContent().info?.[BLURHASH_FIELD];

        if (blurhash) {
            if (this.state.placeholder === Placeholder.NoImage) {
                return null;
            } else if (this.state.placeholder === Placeholder.Blurhash) {
                return <Blurhash className="mx_Blurhash" hash={blurhash} width={width} height={height} />;
            }
        }
        return <Spinner size={32} />;
    }

    protected getTooltipProps(): ComponentProps<typeof Tooltip> | null {
        return null;
    }

    protected getFileBody(): ReactNode {
        if (this.props.forExport) return null;
        const hasMessageActionBar =
            this.context.timelineRenderingType === TimelineRenderingType.Room ||
            this.context.timelineRenderingType === TimelineRenderingType.Pinned ||
            this.context.timelineRenderingType === TimelineRenderingType.Search ||
            this.context.timelineRenderingType === TimelineRenderingType.Thread ||
            this.context.timelineRenderingType === TimelineRenderingType.ThreadsList;
        if (!hasMessageActionBar) {
            return renderMBody({ ...this.props, showFileInfo: false }, FileBodyFactory);
        }
    }

    public render(): React.ReactNode {
        const content = this.props.mxEvent.getContent<ImageContent>();

        if (
            this.props.mediaEventHelper?.media.isEncrypted &&
            !isMimeTypeAllowed(content.info?.mimetype ?? "") &&
            !content.info?.thumbnail_info
        ) {
            return renderMBody(this.props, FileBodyFactory);
        }

        if (this.state.error) {
            let errorText = _t("timeline|m.image|error");
            if (this.state.error instanceof DecryptError) {
                errorText = _t("timeline|m.image|error_decrypting");
            } else if (this.state.error instanceof DownloadError) {
                errorText = _t("timeline|m.image|error_downloading");
            }

            return (
                <MediaProcessingError className="mx_MImageBody" Icon={ImageErrorIcon}>
                    {errorText}
                </MediaProcessingError>
            );
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

const FORCED_IMAGE_HEIGHT = 44;

class MImageReplyBodyInner extends ImageBodyBaseInner {
    public onClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
    };

    public wrapImage(contentUrl: string, children: JSX.Element): JSX.Element {
        return children;
    }

    public render(): React.ReactNode {
        if (this.state.error) {
            return super.render();
        }

        const content = this.props.mxEvent.getContent<ImageContent>();
        const thumbnail = this.state.contentUrl
            ? this.messageContent(this.state.contentUrl, this.state.thumbUrl, content, FORCED_IMAGE_HEIGHT)
            : undefined;

        return <div className="mx_MImageReplyBody">{thumbnail}</div>;
    }
}

const MImageReplyBody: React.FC<IBodyProps> = (props) => {
    const [mediaVisible, setVisible] = useMediaVisible(props.mxEvent);
    return <MImageReplyBodyInner mediaVisible={mediaVisible} setMediaVisible={setVisible} {...props} />;
};

export default MImageReplyBody;
