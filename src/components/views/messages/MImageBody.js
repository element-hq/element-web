/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';

import MFileBody from './MFileBody';
import Modal from '../../../Modal';
import * as sdk from '../../../index';
import { decryptFile } from '../../../utils/DecryptFile';
import { _t } from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import InlineSpinner from '../elements/InlineSpinner';

export default class MImageBody extends React.Component {
    static propTypes = {
        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,

        /* called when the image has loaded */
        onHeightChanged: PropTypes.func.isRequired,

        /* the maximum image height to use */
        maxImageHeight: PropTypes.number,
    };

    static contextType = MatrixClientContext;

    constructor(props) {
        super(props);

        this.onImageError = this.onImageError.bind(this);
        this.onImageLoad = this.onImageLoad.bind(this);
        this.onImageEnter = this.onImageEnter.bind(this);
        this.onImageLeave = this.onImageLeave.bind(this);
        this.onClientSync = this.onClientSync.bind(this);
        this.onClick = this.onClick.bind(this);
        this._isGif = this._isGif.bind(this);

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
        };

        this._image = createRef();
    }

    // FIXME: factor this out and aplpy it to MVideoBody and MAudioBody too!
    onClientSync(syncState, prevState) {
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
    }

    showImage() {
        localStorage.setItem("mx_ShowImage_" + this.props.mxEvent.getId(), "true");
        this.setState({showImage: true});
    }

    onClick(ev) {
        if (ev.button === 0 && !ev.metaKey) {
            ev.preventDefault();
            if (!this.state.showImage) {
                this.showImage();
                return;
            }

            const content = this.props.mxEvent.getContent();
            const httpUrl = this._getContentUrl();
            const ImageView = sdk.getComponent("elements.ImageView");
            const params = {
                src: httpUrl,
                name: content.body && content.body.length > 0 ? content.body : _t('Attachment'),
                mxEvent: this.props.mxEvent,
            };

            if (content.info) {
                params.width = content.info.w;
                params.height = content.info.h;
                params.fileSize = content.info.size;
            }

            Modal.createDialog(ImageView, params, "mx_Dialog_lightbox");
        }
    }

    _isGif() {
        const content = this.props.mxEvent.getContent();
        return (
          content &&
          content.info &&
          content.info.mimetype === "image/gif"
        );
    }

    onImageEnter(e) {
        this.setState({ hover: true });

        if (!this.state.showImage || !this._isGif() || SettingsStore.getValue("autoplayGifsAndVideos")) {
            return;
        }
        const imgElement = e.target;
        imgElement.src = this._getContentUrl();
    }

    onImageLeave(e) {
        this.setState({ hover: false });

        if (!this.state.showImage || !this._isGif() || SettingsStore.getValue("autoplayGifsAndVideos")) {
            return;
        }
        const imgElement = e.target;
        imgElement.src = this._getThumbUrl();
    }

    onImageError() {
        this.setState({
            imgError: true,
        });
    }

    onImageLoad() {
        this.props.onHeightChanged();

        let loadedImageDimensions;

        if (this._image.current) {
            const { naturalWidth, naturalHeight } = this._image.current;
            // this is only used as a fallback in case content.info.w/h is missing
            loadedImageDimensions = { naturalWidth, naturalHeight };
        }

        this.setState({ imgLoaded: true, loadedImageDimensions });
    }

    _getContentUrl() {
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined) {
            return this.state.decryptedUrl;
        } else {
            return this.context.mxcUrlToHttp(content.url);
        }
    }

    _getThumbUrl() {
        // FIXME: the dharma skin lets images grow as wide as you like, rather than capped to 800x600.
        // So either we need to support custom timeline widths here, or reimpose the cap, otherwise the
        // thumbnail resolution will be unnecessarily reduced.
        // custom timeline widths seems preferable.
        const pixelRatio = window.devicePixelRatio;
        const thumbWidth = Math.round(800 * pixelRatio);
        const thumbHeight = Math.round(600 * pixelRatio);

        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined) {
            // Don't use the thumbnail for clients wishing to autoplay gifs.
            if (this.state.decryptedThumbnailUrl) {
                return this.state.decryptedThumbnailUrl;
            }
            return this.state.decryptedUrl;
        } else if (content.info && content.info.mimetype === "image/svg+xml" && content.info.thumbnail_url) {
            // special case to return clientside sender-generated thumbnails for SVGs, if any,
            // given we deliberately don't thumbnail them serverside to prevent
            // billion lol attacks and similar
            return this.context.mxcUrlToHttp(
                content.info.thumbnail_url,
                thumbWidth,
                thumbHeight,
            );
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
                this._isGif() ||
                pixelRatio === 1.0 ||
                (!info || !info.w || !info.h || !info.size)
            ) {
                return this.context.mxcUrlToHttp(content.url, thumbWidth, thumbHeight);
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
                const isLargeFileSize = info.size > 1*1024*1024;

                if (isLargeFileSize && isLargerThanThumbnail) {
                    // image is too large physically and bytewise to clutter our timeline so
                    // we ask for a thumbnail, despite knowing that it will be max 800x600
                    // despite us being retina (as synapse doesn't do 1600x1200 thumbs yet).
                    return this.context.mxcUrlToHttp(
                        content.url,
                        thumbWidth,
                        thumbHeight,
                    );
                } else {
                    // download the original image otherwise, so we can scale it client side
                    // to take pixelRatio into account.
                    // ( no width/height means we want the original image)
                    return this.context.mxcUrlToHttp(
                        content.url,
                    );
                }
            }
        }
    }

    componentDidMount() {
        this.unmounted = false;
        this.context.on('sync', this.onClientSync);

        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined && this.state.decryptedUrl === null) {
            let thumbnailPromise = Promise.resolve(null);
            if (content.info && content.info.thumbnail_file) {
                thumbnailPromise = decryptFile(
                    content.info.thumbnail_file,
                ).then(function(blob) {
                    return URL.createObjectURL(blob);
                });
            }
            let decryptedBlob;
            thumbnailPromise.then((thumbnailUrl) => {
                return decryptFile(content.file).then(function(blob) {
                    decryptedBlob = blob;
                    return URL.createObjectURL(blob);
                }).then((contentUrl) => {
                    if (this.unmounted) return;
                    this.setState({
                        decryptedUrl: contentUrl,
                        decryptedThumbnailUrl: thumbnailUrl,
                        decryptedBlob: decryptedBlob,
                    });
                });
            }).catch((err) => {
                if (this.unmounted) return;
                console.warn("Unable to decrypt attachment: ", err);
                // Set a placeholder image when we can't decrypt the image.
                this.setState({
                    error: err,
                });
            });
        }

        // Remember that the user wanted to show this particular image
        if (!this.state.showImage && localStorage.getItem("mx_ShowImage_" + this.props.mxEvent.getId()) === "true") {
            this.setState({showImage: true});
        }

        this._afterComponentDidMount();
    }

    // To be overridden by subclasses (e.g. MStickerBody) for further
    // initialisation after componentDidMount
    _afterComponentDidMount() {
    }

    componentWillUnmount() {
        this.unmounted = true;
        this.context.removeListener('sync', this.onClientSync);
        this._afterComponentWillUnmount();

        if (this.state.decryptedUrl) {
            URL.revokeObjectURL(this.state.decryptedUrl);
        }
        if (this.state.decryptedThumbnailUrl) {
            URL.revokeObjectURL(this.state.decryptedThumbnailUrl);
        }
    }

    // To be overridden by subclasses (e.g. MStickerBody) for further
    // cleanup after componentWillUnmount
    _afterComponentWillUnmount() {
    }

    _messageContent(contentUrl, thumbUrl, content) {
        let infoWidth;
        let infoHeight;

        if (content && content.info && content.info.w && content.info.h) {
            infoWidth = content.info.w;
            infoHeight = content.info.h;
        } else {
            // Whilst the image loads, display nothing.
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
                        <img style={{display: 'none'}} src={thumbUrl} ref={this._image}
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
        const maxHeight = Math.min(this.props.maxImageHeight || 600, infoHeight);
        // The maximum width of the thumbnail, as dictated by its natural
        // maximum height.
        const maxWidth = infoWidth * maxHeight / infoHeight;

        let img = null;
        let placeholder = null;
        let gifLabel = null;

        // e2e image hasn't been decrypted yet
        if (content.file !== undefined && this.state.decryptedUrl === null) {
            placeholder = <InlineSpinner w={32} h={32} />;
        } else if (!this.state.imgLoaded) {
            // Deliberately, getSpinner is left unimplemented here, MStickerBody overides
            placeholder = this.getPlaceholder();
        }

        let showPlaceholder = Boolean(placeholder);

        if (thumbUrl && !this.state.imgError) {
            // Restrict the width of the thumbnail here, otherwise it will fill the container
            // which has the same width as the timeline
            // mx_MImageBody_thumbnail resizes img to exactly container size
            img = (
                <img className="mx_MImageBody_thumbnail" src={thumbUrl} ref={this._image}
                     style={{ maxWidth: maxWidth + "px" }}
                     alt={content.body}
                     onError={this.onImageError}
                     onLoad={this.onImageLoad}
                     onMouseEnter={this.onImageEnter}
                     onMouseLeave={this.onImageLeave} />
            );
        }

        if (!this.state.showImage) {
            img = <HiddenImagePlaceholder style={{ maxWidth: maxWidth + "px" }} />;
            showPlaceholder = false; // because we're hiding the image, so don't show the sticker icon.
        }

        if (this._isGif() && !SettingsStore.getValue("autoplayGifsAndVideos") && !this.state.hover) {
            gifLabel = <p className="mx_MImageBody_gifLabel">GIF</p>;
        }

        const thumbnail = (
            <div className="mx_MImageBody_thumbnail_container" style={{ maxHeight: maxHeight + "px" }} >
                { /* Calculate aspect ratio, using %padding will size _container correctly */ }
                <div style={{ paddingBottom: (100 * infoHeight / infoWidth) + '%' }} />
                { showPlaceholder &&
                    <div className="mx_MImageBody_thumbnail" style={{
                        // Constrain width here so that spinner appears central to the loaded thumbnail
                        maxWidth: infoWidth + "px",
                    }}>
                        <div className="mx_MImageBody_thumbnail_spinner">
                            { placeholder }
                        </div>
                    </div>
                }

                <div style={{display: !showPlaceholder ? undefined : 'none'}}>
                    { img }
                    { gifLabel }
                </div>

                { this.state.hover && this.getTooltip() }
            </div>
        );

        return this.wrapImage(contentUrl, thumbnail);
    }

    // Overidden by MStickerBody
    wrapImage(contentUrl, children) {
        return <a href={contentUrl} onClick={this.onClick}>
            {children}
        </a>;
    }

    // Overidden by MStickerBody
    getPlaceholder() {
        // MImageBody doesn't show a placeholder whilst the image loads, (but it could do)
        return null;
    }

    // Overidden by MStickerBody
    getTooltip() {
        return null;
    }

    // Overidden by MStickerBody
    getFileBody() {
        return <MFileBody {...this.props} decryptedBlob={this.state.decryptedBlob} />;
    }

    render() {
        const content = this.props.mxEvent.getContent();

        if (this.state.error !== null) {
            return (
                <span className="mx_MImageBody">
                    <img src={require("../../../../res/img/warning.svg")} width="16" height="16" />
                    { _t("Error decrypting image") }
                </span>
            );
        }

        const contentUrl = this._getContentUrl();
        let thumbUrl;
        if (this._isGif() && SettingsStore.getValue("autoplayGifsAndVideos")) {
          thumbUrl = contentUrl;
        } else {
          thumbUrl = this._getThumbUrl();
        }

        const thumbnail = this._messageContent(contentUrl, thumbUrl, content);
        const fileBody = this.getFileBody();

        return <span className="mx_MImageBody">
            { thumbnail }
            { fileBody }
        </span>;
    }
}

export class HiddenImagePlaceholder extends React.PureComponent {
    static propTypes = {
        hover: PropTypes.bool,
    };

    render() {
        let className = 'mx_HiddenImagePlaceholder';
        if (this.props.hover) className += ' mx_HiddenImagePlaceholder_hover';
        return (
            <div className={className}>
                <div className='mx_HiddenImagePlaceholder_button'>
                    <span className='mx_HiddenImagePlaceholder_eye' />
                    <span>{_t("Show image")}</span>
                </div>
            </div>
        );
    }
}
