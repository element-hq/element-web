/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type JSX,
    type ComponentProps,
    type ReactNode,
    useState,
    useEffect,
    useRef,
    useCallback,
    useContext,
    useMemo,
} from "react";
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
import { mediaFromContent } from "../../../customisations/Media";
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

interface MImageBodyInnerState {
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

interface MImageBodyInnerOptions {
    onClick?: (ev: React.MouseEvent) => void;
    wrapImage?: (contentUrl: string | null | undefined, children: JSX.Element) => ReactNode;
    getPlaceholder?: (width: number, height: number) => ReactNode;
    getTooltipProps?: () => ComponentProps<typeof Tooltip> | null;
    getFileBody?: () => ReactNode;
    getBanner?: (content: ImageContent) => ReactNode;
}

/**
 * @private Only use for inheritance. Use the default export for presentation.
 */
export const MImageBodyInner: React.FC<IProps & MImageBodyInnerOptions> = (props) => {
    const context = useContext(RoomContext);
    const unmountedRef = useRef(false);
    const imageRef = useRef<HTMLImageElement>(null);
    const placeholderRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | undefined>(undefined);
    const sizeWatcherRef = useRef<string | undefined>(undefined);
    const reconnectedListenerRef = useRef<((syncState: any, prevState: any) => void) | undefined>(undefined);

    const [state, setState] = useState<MImageBodyInnerState>({
        contentUrl: null,
        thumbUrl: null,
        imgError: false,
        imgLoaded: false,
        hover: false,
        focus: false,
        placeholder: Placeholder.NoImage,
    });

    const media = useMemo(() => mediaFromContent(props.mxEvent.getContent()), [props.mxEvent]);

    const getContentUrl = useCallback((): string | null => {
        // During export, the content url will point to the MSC, which will later point to a local url
        if (props.forExport) return media.srcMxc;
        return media.srcHttp;
    }, [props.forExport, media]);

    const shouldAutoplay = useMemo((): boolean => {
        return !(
            !state.contentUrl ||
            !props.mediaVisible ||
            !state.isAnimated ||
            SettingsStore.getValue("autoplayGifs")
        );
    }, [state.contentUrl, props.mediaVisible, state.isAnimated]);

    const clearBlurhashTimeout = useCallback((): void => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = undefined;
        }
    }, []);

    const onImageEnter = useCallback((): void => {
        setState((prev) => ({ ...prev, hover: true }));
    }, []);

    const onImageLeave = useCallback((): void => {
        setState((prev) => ({ ...prev, hover: false }));
    }, []);

    const onFocus = useCallback((): void => {
        setState((prev) => ({ ...prev, focus: true }));
    }, []);

    const onBlur = useCallback((): void => {
        setState((prev) => ({ ...prev, focus: false }));
    }, []);

    const onImageError = useCallback((): void => {
        // If the thumbnail failed to load then try again using the contentUrl
        if (state.thumbUrl) {
            setState((prev) => ({ ...prev, thumbUrl: null }));
            return;
        }

        clearBlurhashTimeout();
        setState((prev) => ({ ...prev, imgError: true }));

        if (reconnectedListenerRef.current) {
            MatrixClientPeg.safeGet().on(ClientEvent.Sync, reconnectedListenerRef.current);
        }
    }, [state.thumbUrl, clearBlurhashTimeout]);

    const onImageLoad = useCallback((): void => {
        clearBlurhashTimeout();

        let loadedImageDimensions: MImageBodyInnerState["loadedImageDimensions"];

        if (imageRef.current) {
            const { naturalWidth, naturalHeight } = imageRef.current;
            // this is only used as a fallback in case content.info.w/h is missing
            loadedImageDimensions = { naturalWidth, naturalHeight };
        }
        setState((prev) => ({ ...prev, imgLoaded: true, loadedImageDimensions }));
    }, [clearBlurhashTimeout]);

    const getThumbUrl = useCallback((): string | null => {
        // FIXME: we let images grow as wide as you like, rather than capped to 800x600.
        // So either we need to support custom timeline widths here, or reimpose the cap, otherwise the
        // thumbnail resolution will be unnecessarily reduced.
        // custom timeline widths seems preferable.
        const thumbWidth = 800;
        const thumbHeight = 600;

        const content = props.mxEvent.getContent<ImageContent>();
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
        if (state.isAnimated || window.devicePixelRatio === 1.0 || !info || !info.w || !info.h || !info.size) {
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
    }, [props.mxEvent, state.isAnimated]);

    const downloadImage = useCallback(async (): Promise<void> => {
        let dlThumbUrl: string | null;
        let dlContentUrl: string | null;

        try {
            if (props.mediaEventHelper?.media.isEncrypted) {
                [dlContentUrl, dlThumbUrl] = await Promise.all([
                    props.mediaEventHelper.sourceUrl.value,
                    props.mediaEventHelper.thumbnailUrl.value,
                ]);
            } else {
                dlThumbUrl = getThumbUrl();
                dlContentUrl = getContentUrl();
            }

            if (unmountedRef.current) return;

            const eventContent = props.mxEvent.getContent<ImageContent>();
            let isAnimated =
                eventContent.info?.["org.matrix.msc4230.is_animated"] ?? mayBeAnimated(eventContent.info?.mimetype);

            // If there is no included non-animated thumbnail then we will generate our own, we can't depend on the server
            // because 1. encryption and 2. we can't ask the server specifically for a non-animated thumbnail.
            if (isAnimated && !SettingsStore.getValue("autoplayGifs")) {
                if (
                    !dlThumbUrl ||
                    !eventContent?.info?.thumbnail_info ||
                    mayBeAnimated(eventContent.info.thumbnail_info.mimetype)
                ) {
                    const img = document.createElement("img");
                    const loadPromise = new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    img.crossOrigin = "Anonymous"; // CORS allow canvas access
                    img.src = dlContentUrl ?? "";

                    try {
                        await loadPromise;
                    } catch (error) {
                        // Non-animated thumbnail generation failed, fall back to the original thumbnail.
                        logger.warn("Failed to generate thumbnail for animation", error);
                        // Continue with the original contentUrl if loading fails.
                    }

                    try {
                        if (props.mediaEventHelper) {
                            const sourceBlob = await props.mediaEventHelper.sourceBlob.value;
                            if (await blobIsAnimated(sourceBlob)) {
                                const thumbnail = await createThumbnail(
                                    img,
                                    img.width,
                                    img.height,
                                    "image/jpeg",
                                    false,
                                );
                                if (thumbnail.thumbnail) {
                                    dlThumbUrl = URL.createObjectURL(thumbnail.thumbnail);
                                }
                            } else {
                                isAnimated = false;
                            }
                        }
                    } catch (error) {
                        logger.warn("Failed to thumbnail image", error);
                        // Continue with the original thumbUrl if thumbnailing fails.
                    }
                }
            }

            if (unmountedRef.current) return;
            setState((prev) => ({
                ...prev,
                contentUrl: dlContentUrl,
                thumbUrl: dlThumbUrl,
                isAnimated,
            }));
        } catch (error) {
            if (unmountedRef.current) return;

            if (error instanceof DecryptError) {
                logger.error("Error decrypting image", error);
            } else if (error instanceof DownloadError) {
                logger.error("Error downloading image", error);
            } else {
                logger.error("Unknown error loading image", error);
            }

            // Set a placeholder image when we can't decrypt the image.
            setState((prev) => ({ ...prev, error }));
        }
    }, [props.mediaEventHelper, getThumbUrl, getContentUrl, props.mxEvent]);

    useEffect(() => {
        reconnectedListenerRef.current = createReconnectedListener(() => {
            setState((prev) => ({ ...prev, imgError: false }));
        });
    }, []);

    useEffect(() => {
        unmountedRef.current = false;

        if (props.mediaVisible && !state.contentUrl) {
            downloadImage();
        }

        // Add a 150ms timer for blurhash to first appear.
        if (props.mxEvent.getContent().info?.[BLURHASH_FIELD]) {
            clearBlurhashTimeout();
            timeoutRef.current = window.setTimeout(() => {
                setState((prev) => {
                    if (!prev.imgLoaded && !prev.imgError) {
                        return { ...prev, placeholder: Placeholder.Blurhash };
                    }
                    return prev;
                });
            }, 150);
        }

        sizeWatcherRef.current = SettingsStore.watchSetting("Images.size", null, () => {
            // Force update since we don't really have a reliable thing to update
            setState((prev) => ({ ...prev }));
        });

        return () => {
            unmountedRef.current = true;
            MatrixClientPeg.get()?.off(ClientEvent.Sync, reconnectedListenerRef.current!);
            clearBlurhashTimeout();
            if (sizeWatcherRef.current) {
                SettingsStore.unwatchSetting(sizeWatcherRef.current);
            }
            if (state.isAnimated && state.thumbUrl) {
                URL.revokeObjectURL(state.thumbUrl);
            }
        };
    }, [
        props.mxEvent,
        props.mediaVisible,
        downloadImage,
        clearBlurhashTimeout,
        state.isAnimated,
        state.thumbUrl,
        state.contentUrl,
    ]);

    const defaultOnClick = useCallback(
        (ev: React.MouseEvent): void => {
            if (ev.button === 0 && !ev.metaKey) {
                ev.preventDefault();
                if (!props.mediaVisible) {
                    props.setMediaVisible(true);
                    return;
                }

                const content = props.mxEvent.getContent<ImageContent>();
                const httpUrl = state.contentUrl;
                if (!httpUrl) return;
                const params: Omit<ComponentProps<typeof ImageView>, "onFinished"> = {
                    src: httpUrl,
                    name: content.body && content.body.length > 0 ? content.body : _t("common|attachment"),
                    mxEvent: props.mxEvent,
                    permalinkCreator: props.permalinkCreator,
                };

                if (content.info) {
                    params.width = content.info.w;
                    params.height = content.info.h;
                    params.fileSize = content.info.size;
                }

                if (imageRef.current) {
                    const clientRect = imageRef.current.getBoundingClientRect();

                    params.thumbnailInfo = {
                        width: clientRect.width,
                        height: clientRect.height,
                        positionX: clientRect.x,
                        positionY: clientRect.y,
                    };
                }

                Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
            }
        },
        [props, state.contentUrl],
    );

    const onClick = props.onClick || defaultOnClick;

    const getBanner = useCallback(
        (content: ImageContent): ReactNode => {
            // Hide it for the threads list & the file panel where we show it as text anyway.
            if (
                [TimelineRenderingType.ThreadsList, TimelineRenderingType.File].includes(context.timelineRenderingType)
            ) {
                return null;
            }

            return (
                <span className="mx_MImageBody_banner">
                    {presentableTextForFile(content, _t("common|image"), true, true)}
                </span>
            );
        },
        [context.timelineRenderingType],
    );

    const getPlaceholder = useCallback(
        (width: number, height: number): ReactNode => {
            if (props.getPlaceholder) {
                return props.getPlaceholder(width, height);
            }

            const blurhash = props.mxEvent.getContent().info?.[BLURHASH_FIELD];

            if (blurhash) {
                if (state.placeholder === Placeholder.NoImage) {
                    return null;
                } else if (state.placeholder === Placeholder.Blurhash) {
                    return <Blurhash className="mx_Blurhash" hash={blurhash} width={width} height={height} />;
                }
            }
            return <Spinner w={32} h={32} />;
        },
        [props, state.placeholder],
    );

    const getTooltipProps = useCallback((): ComponentProps<typeof Tooltip> | null => {
        if (props.getTooltipProps) {
            return props.getTooltipProps();
        }
        return null;
    }, [props]);

    const getFileBody = useCallback((): ReactNode => {
        if (props.getFileBody) {
            return props.getFileBody();
        }

        if (props.forExport) return null;
        /*
         * In the room timeline or the thread context we don't need the download
         * link as the message action bar will fulfill that
         */
        const hasMessageActionBar =
            context.timelineRenderingType === TimelineRenderingType.Room ||
            context.timelineRenderingType === TimelineRenderingType.Pinned ||
            context.timelineRenderingType === TimelineRenderingType.Search ||
            context.timelineRenderingType === TimelineRenderingType.Thread ||
            context.timelineRenderingType === TimelineRenderingType.ThreadsList;
        if (!hasMessageActionBar) {
            return <MFileBody {...props} showGenericPlaceholder={false} />;
        }
    }, [props, context.timelineRenderingType]);

    const wrapImage = useCallback(
        (contentUrl: string | null | undefined, children: JSX.Element): ReactNode => {
            if (props.wrapImage) {
                return props.wrapImage(contentUrl, children);
            }

            if (contentUrl) {
                return (
                    <a
                        href={contentUrl}
                        target={props.forExport ? "_blank" : undefined}
                        onClick={onClick}
                        onFocus={onFocus}
                        onBlur={onBlur}
                    >
                        {children}
                    </a>
                );
            }
            return children;
        },
        [props, onClick, onFocus, onBlur],
    );

    const messageContent = useCallback(
        (
            contentUrl: string | null,
            thumbUrl: string | null,
            content: ImageContent,
            forcedHeight?: number,
        ): ReactNode => {
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
                if (!state.loadedImageDimensions) {
                    let imageElement: JSX.Element;
                    if (!props.mediaVisible) {
                        imageElement = (
                            <HiddenMediaPlaceholder onClick={onClick}>
                                {_t("timeline|m.image|show_image")}
                            </HiddenMediaPlaceholder>
                        );
                    } else {
                        imageElement = (
                            <img
                                style={{ display: "none" }}
                                src={thumbUrl}
                                ref={imageRef}
                                alt={content.body}
                                onError={onImageError}
                                onLoad={onImageLoad}
                            />
                        );
                    }
                    return wrapImage(contentUrl, imageElement);
                }
                infoWidth = state.loadedImageDimensions.naturalWidth;
                infoHeight = state.loadedImageDimensions.naturalHeight;
            }

            // The maximum size of the thumbnail as it is rendered as an <img>,
            // accounting for any height constraints
            const { w: maxWidth, h: maxHeight } = suggestedImageSize(
                SettingsStore.getValue("Images.size") as ImageSize,
                { w: infoWidth, h: infoHeight },
                forcedHeight ?? props.maxImageHeight,
            );

            let img: JSX.Element | undefined;
            let placeholder: JSX.Element | undefined;
            let gifLabel: JSX.Element | undefined;

            if (!props.forExport && !state.imgLoaded) {
                const classes = classNames("mx_MImageBody_placeholder", {
                    "mx_MImageBody_placeholder--blurhash": props.mxEvent.getContent().info?.[BLURHASH_FIELD],
                });

                placeholder = (
                    <div className={classes} ref={placeholderRef}>
                        {getPlaceholder(maxWidth, maxHeight)}
                    </div>
                );
            }

            let showPlaceholder = Boolean(placeholder);

            const hoverOrFocus = state.hover || state.focus;
            if (thumbUrl && !state.imgError) {
                let url = thumbUrl;
                if (hoverOrFocus && shouldAutoplay) {
                    url = state.contentUrl!;
                }

                // Restrict the width of the thumbnail here, otherwise it will fill the container
                // which has the same width as the timeline
                // mx_MImageBody_thumbnail resizes img to exactly container size
                img = (
                    <img
                        className="mx_MImageBody_thumbnail"
                        src={url}
                        ref={imageRef}
                        alt={content.body}
                        onError={onImageError}
                        onLoad={onImageLoad}
                        onMouseEnter={onImageEnter}
                        onMouseLeave={onImageLeave}
                    />
                );
            }

            if (!props.mediaVisible) {
                img = (
                    <div style={{ width: maxWidth, height: maxHeight }}>
                        <HiddenMediaPlaceholder onClick={onClick}>
                            {_t("timeline|m.image|show_image")}
                        </HiddenMediaPlaceholder>
                    </div>
                );
                showPlaceholder = false; // because we're hiding the image, so don't show the placeholder.
            }

            if (state.isAnimated && !SettingsStore.getValue("autoplayGifs") && !hoverOrFocus) {
                // XXX: Arguably we may want a different label when the animated image is WEBP and not GIF
                gifLabel = <p className="mx_MImageBody_gifLabel">GIF</p>;
            }

            let banner: ReactNode | undefined;
            if (props.mediaVisible && hoverOrFocus) {
                banner = getBanner(content);
            }

            // many SVGs don't have an intrinsic size if used in <img> elements.
            // due to this we have to set our desired width directly.
            // this way if the image is forced to shrink, the height adapts appropriately.
            const sizing = infoSvg ? { maxHeight, maxWidth, width: maxWidth } : { maxHeight, maxWidth };

            if (!props.forExport) {
                placeholder = (
                    <SwitchTransition mode="out-in">
                        <CSSTransition
                            classNames="mx_rtg--fade"
                            key={`img-${showPlaceholder}`}
                            timeout={300}
                            nodeRef={placeholderRef}
                        >
                            {
                                showPlaceholder ? (
                                    placeholder
                                ) : (
                                    <div ref={placeholderRef} />
                                ) /* Transition always expects a child */
                            }
                        </CSSTransition>
                    </SwitchTransition>
                );
            }

            const tooltipProps = getTooltipProps();
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
                    {!props.forExport && !state.imgLoaded && !placeholder && (
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

            return wrapImage(contentUrl, thumbnail);
        },
        [
            state,
            props,
            shouldAutoplay,
            imageRef,
            placeholderRef,
            onImageError,
            onImageLoad,
            onImageEnter,
            onImageLeave,
            wrapImage,
            getPlaceholder,
            getBanner,
            onClick,
            getTooltipProps,
        ],
    );

    // Render
    const content = props.mxEvent.getContent<ImageContent>();

    if (state.error) {
        let errorText = _t("timeline|m.image|error");
        if (state.error instanceof DecryptError) {
            errorText = _t("timeline|m.image|error_decrypting");
        } else if (state.error instanceof DownloadError) {
            errorText = _t("timeline|m.image|error_downloading");
        }

        return <MediaProcessingError className="mx_MImageBody">{errorText}</MediaProcessingError>;
    }

    let contentUrl = state.contentUrl;
    let thumbUrl: string | null;
    if (props.forExport) {
        contentUrl = props.mxEvent.getContent().url ?? props.mxEvent.getContent().file?.url;
        thumbUrl = contentUrl;
    } else if (state.isAnimated && SettingsStore.getValue("autoplayGifs")) {
        thumbUrl = contentUrl;
    } else {
        thumbUrl = state.thumbUrl ?? state.contentUrl;
    }

    const thumbnail = messageContent(contentUrl, thumbUrl, content);
    const fileBody = getFileBody();

    return (
        <div className="mx_MImageBody">
            {thumbnail}
            {fileBody}
        </div>
    );
};

// Wrap MImageBody component so we can use a hook here.
const MImageBody: React.FC<IBodyProps> = (props) => {
    const [mediaVisible, setVisible] = useMediaVisible(props.mxEvent);
    return <MImageBodyInner mediaVisible={mediaVisible} setMediaVisible={setVisible} {...props} />;
};

export default MImageBody;
