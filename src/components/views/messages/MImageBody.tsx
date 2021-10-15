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

import React, { ComponentProps, createRef } from 'react';
import { Blurhash } from "react-blurhash";

import MFileBody from './MFileBody';
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import InlineSpinner from '../elements/InlineSpinner';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { Media, mediaFromContent } from "../../../customisations/Media";
import { BLURHASH_FIELD } from "../../../ContentMessages";
import { IMediaEventContent } from '../../../customisations/models/IMediaEventContent';
import ImageView from '../elements/ImageView';
import { SyncState } from 'matrix-js-sdk/src/sync.api';
import { IBodyProps } from "./IBodyProps";
import classNames from 'classnames';
import { CSSTransition, SwitchTransition } from 'react-transition-group';

import { logger } from "matrix-js-sdk/src/logger";

interface IState {
    decryptedUrl?: string;
    decryptedThumbnailUrl?: string;
    decryptedBlob?: Blob;
    error;
    imgError: boolean;
    imgLoaded: boolean;
    loadedImageDimensions?: {
        naturalWidth: number;
        naturalHeight: number;
    };
    hover: boolean;
    showImage: boolean;
    placeholder: 'no-image' | 'blurhash';
}

@replaceableComponent("views.messages.MImageBody")
export default class MImageBody extends React.Component<IBodyProps, IState> {
    static contextType = MatrixClientContext;
    private unmounted = true;
    private image = createRef<HTMLImageElement>();
    private timeout?: number;

    constructor(props: IBodyProps) {
        super(props);

        this.state = {
            decryptedUrl: null,
            decryptedThumbnailUrl: null,
            decryptedBlob: null,
            error: null,
            imgError: false,
            imgLoaded: false,
            loadedImageDimensions: null,
            hover: false,
            showImage: SettingsStore.getValue("showImages"),
            placeholder: 'no-image',
        };
    }

    // FIXME: factor this out and apply it to MVideoBody and MAudioBody too!
    private onClientSync = (syncState: SyncState, prevState: SyncState): void => {
        if (this.unmounted) return;
        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
        const reconnected = syncState !== "ERROR" && prevState !== syncState;
        if (reconnected && this.state.imgError) {
            // Load the image again
            this.setState({
                imgError: false,
            });
        }
    };

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
            const httpUrl = this.getContentUrl();
            const params: Omit<ComponentProps<typeof ImageView>, "onFinished"> = {
                src: httpUrl,
                name: content.body?.length > 0 ? content.body : _t('Attachment'),
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

            Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", null, true);
        }
    };

    private isGif = (): boolean => {
        const content = this.props.mxEvent.getContent();
        return content.info?.mimetype === "image/gif";
    };

    private onImageEnter = (e: React.MouseEvent<HTMLImageElement>): void => {
        this.setState({ hover: true });

        if (!this.state.showImage || !this.isGif() || SettingsStore.getValue("autoplayGifs")) {
            return;
        }
        const imgElement = e.currentTarget;
        imgElement.src = this.getContentUrl();
    };

    private onImageLeave = (e: React.MouseEvent<HTMLImageElement>): void => {
        this.setState({ hover: false });

        if (!this.state.showImage || !this.isGif() || SettingsStore.getValue("autoplayGifs")) {
            return;
        }
        const imgElement = e.currentTarget;
        imgElement.src = this.getThumbUrl();
    };

    private onImageError = (): void => {
        this.clearBlurhashTimeout();
        this.setState({
            imgError: true,
        });
    };

    private onImageLoad = (): void => {
        this.clearBlurhashTimeout();
        this.props.onHeightChanged();

        let loadedImageDimensions;

        if (this.image.current) {
            const { naturalWidth, naturalHeight } = this.image.current;
            // this is only used as a fallback in case content.info.w/h is missing
            loadedImageDimensions = { naturalWidth, naturalHeight };
        }
        this.setState({ imgLoaded: true, loadedImageDimensions });
    };

    protected getContentUrl(): string {
        const content: IMediaEventContent = this.props.mxEvent.getContent();
        // During export, the content url will point to the MSC, which will later point to a local url
        if (this.props.forExport) return content.url || content.file?.url;
        if (this.media.isEncrypted) {
            return this.state.decryptedUrl;
        } else {
            return this.media.srcHttp;
        }
    }

    private get media(): Media {
        return mediaFromContent(this.props.mxEvent.getContent());
    }

    protected getThumbUrl(): string {
        // FIXME: we let images grow as wide as you like, rather than capped to 800x600.
        // So either we need to support custom timeline widths here, or reimpose the cap, otherwise the
        // thumbnail resolution will be unnecessarily reduced.
        // custom timeline widths seems preferable.
        const thumbWidth = 800;
        const thumbHeight = 600;

        const content = this.props.mxEvent.getContent<IMediaEventContent>();
        const media = mediaFromContent(content);

        if (media.isEncrypted) {
            // Don't use the thumbnail for clients wishing to autoplay gifs.
            if (this.state.decryptedThumbnailUrl) {
                return this.state.decryptedThumbnailUrl;
            }
            return this.state.decryptedUrl;
        } else if (content.info && content.info.mimetype === "image/svg+xml" && media.hasThumbnail) {
            // special case to return clientside sender-generated thumbnails for SVGs, if any,
            // given we deliberately don't thumbnail them serverside to prevent
            // billion lol attacks and similar
            return media.getThumbnailHttp(thumbWidth, thumbHeight, 'scale');
        } else {
            // we try to download the correct resolution
            // for hi-res images (like retina screenshots).
            // synapse only supports 800x600 thumbnails for now though,
            // so we'll need to download the original image for this to work
            // well for now. First, let's try a few cases that let us avoid
            // downloading the original, including:
            //   - When displaying a GIF, we always want to thumbnail so that we can
            //     properly respect the user's GIF autoplay setting (which relies on
            //     thumbnailing to produce the static preview image)
            //   - On a low DPI device, always thumbnail to save bandwidth
            //   - If there's no sizing info in the event, default to thumbnail
            const info = content.info;
            if (
                this.isGif() ||
                window.devicePixelRatio === 1.0 ||
                (!info || !info.w || !info.h || !info.size)
            ) {
                return media.getThumbnailOfSourceHttp(thumbWidth, thumbHeight);
            } else {
                // we should only request thumbnails if the image is bigger than 800x600
                // (or 1600x1200 on retina) otherwise the image in the timeline will just
                // end up resampled and de-retina'd for no good reason.
                // Ideally the server would pregen 1600x1200 thumbnails in order to provide retina
                // thumbnails, but we don't do this currently in synapse for fear of disk space.
                // As a compromise, let's switch to non-retina thumbnails only if the original
                // image is both physically too large and going to be massive to load in the
                // timeline (e.g. >1MB).

                const isLargerThanThumbnail = (
                    info.w > thumbWidth ||
                    info.h > thumbHeight
                );
                const isLargeFileSize = info.size > 1 * 1024 * 1024; // 1mb

                if (isLargeFileSize && isLargerThanThumbnail) {
                    // image is too large physically and bytewise to clutter our timeline so
                    // we ask for a thumbnail, despite knowing that it will be max 800x600
                    // despite us being retina (as synapse doesn't do 1600x1200 thumbs yet).
                    return media.getThumbnailOfSourceHttp(thumbWidth, thumbHeight);
                } else {
                    // download the original image otherwise, so we can scale it client side
                    // to take pixelRatio into account.
                    return media.srcHttp;
                }
            }
        }
    }

    private async downloadImage() {
        if (this.props.mediaEventHelper.media.isEncrypted && this.state.decryptedUrl === null) {
            try {
                const thumbnailUrl = await this.props.mediaEventHelper.thumbnailUrl.value;
                this.setState({
                    decryptedUrl: await this.props.mediaEventHelper.sourceUrl.value,
                    decryptedThumbnailUrl: thumbnailUrl,
                    decryptedBlob: await this.props.mediaEventHelper.sourceBlob.value,
                });
            } catch (err) {
                if (this.unmounted) return;
                logger.warn("Unable to decrypt attachment: ", err);
                // Set a placeholder image when we can't decrypt the image.
                this.setState({
                    error: err,
                });
            }
        }
    }

    private clearBlurhashTimeout() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
    }

    componentDidMount() {
        this.unmounted = false;
        this.context.on('sync', this.onClientSync);

        const showImage = this.state.showImage ||
            localStorage.getItem("mx_ShowImage_" + this.props.mxEvent.getId()) === "true";

        if (showImage) {
            // noinspection JSIgnoredPromiseFromCall
            this.downloadImage();
            this.setState({ showImage: true });
        } // else don't download anything because we don't want to display anything.

        // Add a 150ms timer for blurhash to first appear.
        if (this.props.mxEvent.getContent().info?.[BLURHASH_FIELD]) {
            this.clearBlurhashTimeout();
            this.timeout = setTimeout(() => {
                if (!this.state.imgLoaded || !this.state.imgError) {
                    this.setState({
                        placeholder: 'blurhash',
                    });
                }
            }, 150);
        }
    }

    componentWillUnmount() {
        this.unmounted = true;
        this.context.removeListener('sync', this.onClientSync);
        this.clearBlurhashTimeout();
    }

    protected messageContent(
        contentUrl: string,
        thumbUrl: string,
        content: IMediaEventContent,
        forcedHeight?: number,
    ): JSX.Element {
        let infoWidth;
        let infoHeight;

        if (content && content.info && content.info.w && content.info.h) {
            infoWidth = content.info.w;
            infoHeight = content.info.h;
        } else {
            // Whilst the image loads, display nothing. We also don't display a blurhash image
            // because we don't really know what size of image we'll end up with.
            //
            // Once loaded, use the loaded image dimensions stored in `loadedImageDimensions`.
            //
            // By doing this, the image "pops" into the timeline, but is still restricted
            // by the same width and height logic below.
            if (!this.state.loadedImageDimensions) {
                let imageElement;
                if (!this.state.showImage) {
                    imageElement = <HiddenImagePlaceholder />;
                } else {
                    imageElement = (
                        <img
                            style={{ display: 'none' }}
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

        // The maximum height of the thumbnail as it is rendered as an <img>
        const maxHeight = forcedHeight || Math.min((this.props.maxImageHeight || 600), infoHeight);
        // The maximum width of the thumbnail, as dictated by its natural
        // maximum height.
        const maxWidth = infoWidth * maxHeight / infoHeight;

        let img = null;
        let placeholder = null;
        let gifLabel = null;

        if (!this.props.forExport && !this.state.imgLoaded) {
            placeholder = this.getPlaceholder(maxWidth, maxHeight);
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
                    // Force the image to be the full size of the container, even if the
                    // pixel size is smaller. The problem here is that we don't know what
                    // thumbnail size the HS is going to give us, but we have to commit to
                    // a container size immediately and not change it when the image loads
                    // or we'll get a scroll jump (or have to leave blank space).
                    // This will obviously result in an upscaled image which will be a bit
                    // blurry. The best fix would be for the HS to advertise what size thumbnails
                    // it guarantees to produce.
                    style={{ height: '100%' }}
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

        if (this.isGif() && !SettingsStore.getValue("autoplayGifs") && !this.state.hover) {
            gifLabel = <p className="mx_MImageBody_gifLabel">GIF</p>;
        }

        const classes = classNames({
            'mx_MImageBody_thumbnail': true,
            'mx_MImageBody_thumbnail--blurhash': this.props.mxEvent.getContent().info?.[BLURHASH_FIELD],
        });

        // This has incredibly broken types.
        const C = CSSTransition as any;
        const thumbnail = (
            <div className="mx_MImageBody_thumbnail_container" style={{ maxHeight: maxHeight, maxWidth: maxWidth, aspectRatio: `${infoWidth}/${infoHeight}` }}>
                <SwitchTransition mode="out-in">
                    <C
                        classNames="mx_rtg--fade"
                        key={`img-${showPlaceholder}`}
                        timeout={300}
                    >
                        { /* This weirdly looking div is necessary here, otherwise SwitchTransition fails */ }
                        <div>
                            { showPlaceholder && <div
                                className={classes}
                                style={{
                                    // Constrain width here so that spinner appears central to the loaded thumbnail
                                    maxWidth: `min(100%, ${infoWidth}px)`,
                                    maxHeight: maxHeight,
                                    aspectRatio: `${infoWidth}/${infoHeight}`,
                                }}
                            >
                                { placeholder }
                            </div> }
                        </div>
                    </C>
                </SwitchTransition>

                <div style={{
                    height: '100%',
                }}>
                    { img }
                    { gifLabel }
                </div>

                { this.state.hover && this.getTooltip() }
            </div>
        );

        return this.wrapImage(contentUrl, thumbnail);
    }

    // Overidden by MStickerBody
    protected wrapImage(contentUrl: string, children: JSX.Element): JSX.Element {
        return <a href={contentUrl} target={this.props.forExport ? "_blank" : undefined} onClick={this.onClick}>
            { children }
        </a>;
    }

    // Overidden by MStickerBody
    protected getPlaceholder(width: number, height: number): JSX.Element {
        const blurhash = this.props.mxEvent.getContent().info?.[BLURHASH_FIELD];

        if (blurhash) {
            if (this.state.placeholder === 'no-image') {
                return <div className="mx_no-image-placeholder" style={{ width: width, height: height }} />;
            } else if (this.state.placeholder === 'blurhash') {
                return <Blurhash className="mx_Blurhash" hash={blurhash} width={width} height={height} />;
            }
        }
        return (
            <InlineSpinner w={32} h={32} />
        );
    }

    // Overidden by MStickerBody
    protected getTooltip(): JSX.Element {
        return null;
    }

    // Overidden by MStickerBody
    protected getFileBody(): string | JSX.Element {
        if (this.props.forExport) return null;
        // We only ever need the download bar if we're appearing outside of the timeline
        if (this.props.tileShape) {
            return <MFileBody {...this.props} showGenericPlaceholder={false} />;
        }
    }

    render() {
        const content = this.props.mxEvent.getContent<IMediaEventContent>();

        if (this.state.error !== null) {
            return (
                <div className="mx_MImageBody">
                    <img src={require("../../../../res/img/warning.svg")} width="16" height="16" />
                    { _t("Error decrypting image") }
                </div>
            );
        }

        const contentUrl = this.getContentUrl();
        let thumbUrl;
        if (this.props.forExport || (this.isGif() && SettingsStore.getValue("autoplayGifs"))) {
            thumbUrl = contentUrl;
        } else {
            thumbUrl = this.getThumbUrl();
        }

        const thumbnail = this.messageContent(contentUrl, thumbUrl, content);
        const fileBody = this.getFileBody();

        return (
            <div className="mx_MImageBody">
                { thumbnail }
                { fileBody }
            </div>
        );
    }
}

interface PlaceholderIProps {
    hover?: boolean;
    maxWidth?: number;
}

export class HiddenImagePlaceholder extends React.PureComponent<PlaceholderIProps> {
    render() {
        const maxWidth = this.props.maxWidth ? this.props.maxWidth + "px" : null;
        let className = 'mx_HiddenImagePlaceholder';
        if (this.props.hover) className += ' mx_HiddenImagePlaceholder_hover';
        return (
            <div className={className} style={{ maxWidth: `min(100%, ${maxWidth}px)` }}>
                <div className='mx_HiddenImagePlaceholder_button'>
                    <span className='mx_HiddenImagePlaceholder_eye' />
                    <span>{ _t("Show image") }</span>
                </div>
            </div>
        );
    }
}
