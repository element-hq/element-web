/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import { MatrixClient } from 'matrix-js-sdk';

import MFileBody from './MFileBody';
import Modal from '../../../Modal';
import sdk from '../../../index';
import { decryptFile } from '../../../utils/DecryptFile';
import Promise from 'bluebird';
import { _t } from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";

const THUMBNAIL_MAX_HEIGHT = 600;

export default class extends React.Component {
    displayName: 'MImageBody'

    static propTypes = {
        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,

        /* called when the image has loaded */
        onWidgetLoad: PropTypes.func.isRequired,
    }

    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    }

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
        };
    }

    componentWillMount() {
        this.unmounted = false;
        this.context.matrixClient.on('sync', this.onClientSync);
    }

    // FIXME: factor this out and aplpy it to MVideoBody and MAudioBody too!
    onClientSync(syncState, prevState) {
        if (this.unmounted) return;
        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING or PREPARED.
        const reconnected = syncState !== "ERROR" && prevState !== syncState;
        if (reconnected && this.state.imgError) {
            // Load the image again
            this.setState({
                imgError: false,
            });
        }
    }

    onClick(ev) {
        if (ev.button == 0 && !ev.metaKey) {
            ev.preventDefault();
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
        if (!this._isGif() || SettingsStore.getValue("autoplayGifsAndVideos")) {
            return;
        }
        const imgElement = e.target;
        imgElement.src = this._getContentUrl();
    }

    onImageLeave(e) {
        if (!this._isGif() || SettingsStore.getValue("autoplayGifsAndVideos")) {
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
        this.props.onWidgetLoad();
    }

    _getContentUrl() {
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined) {
            return this.state.decryptedUrl;
        } else {
            return this.context.matrixClient.mxcUrlToHttp(content.url);
        }
    }

    _getThumbUrl() {
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined) {
            // Don't use the thumbnail for clients wishing to autoplay gifs.
            if (this.state.decryptedThumbnailUrl) {
                return this.state.decryptedThumbnailUrl;
            }
            return this.state.decryptedUrl;
        } else if (content.info &&
                   content.info.mimetype == "image/svg+xml" &&
                   content.info.thumbnail_url) {
            // special case to return client-generated thumbnails for SVGs, if any,
            // given we deliberately don't thumbnail them serverside to prevent
            // billion lol attacks and similar
            return this.context.matrixClient.mxcUrlToHttp(
                content.info.thumbnail_url, 800, 600,
            );
        } else {
            return this.context.matrixClient.mxcUrlToHttp(content.url, 800, 600);
        }
    }

    componentDidMount() {
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined && this.state.decryptedUrl === null) {
            let thumbnailPromise = Promise.resolve(null);
            if (content.info.thumbnail_file) {
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
                    this.setState({
                        decryptedUrl: contentUrl,
                        decryptedThumbnailUrl: thumbnailUrl,
                        decryptedBlob: decryptedBlob,
                    });
                });
            }).catch((err) => {
                console.warn("Unable to decrypt attachment: ", err);
                // Set a placeholder image when we can't decrypt the image.
                this.setState({
                    error: err,
                });
            }).done();
        }
        this._afterComponentDidMount();
    }

    // To be overridden by subclasses (e.g. MStickerBody) for further
    // initialisation after componentDidMount
    _afterComponentDidMount() {
    }

    componentWillUnmount() {
        this.unmounted = true;
        this.context.matrixClient.removeListener('sync', this.onClientSync);
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
        // The maximum height of the thumbnail as it is rendered as an <img>
        const maxHeight = Math.min(THUMBNAIL_MAX_HEIGHT, content.info.h);
        // The maximum width of the thumbnail, as dictated by it's natural
        // maximum height.
        const maxWidth = content.info.w * maxHeight / content.info.h;

        let img = null;
        // e2e image hasn't been decrypted yet
        if (content.file !== undefined && this.state.decryptedUrl === null) {
            img = <div className="mx_MImageBody_thumbnail mx_MImageBody_thumbnail_spinner" ref="image">
                <img src="img/spinner.gif" alt={content.body} width="32" height="32" />
            </div>;
        } else if (thumbUrl && !this.state.imgError) {
            // Restrict the width of the thumbnail here, otherwise it will fill the container
            // which has the same width as the timeline
            img = <img className="mx_MImageBody_thumbnail" src={thumbUrl} ref="image"
                style={{ "max-width": maxWidth + "px" }}
                alt={content.body}
                onError={this.onImageError}
                onLoad={this.onImageLoad}
                onMouseEnter={this.onImageEnter}
                onMouseLeave={this.onImageLeave} />;
        }
        const thumbnail = img ?
            <a href={contentUrl} onClick={this.onClick}>
                <div className="mx_MImageBody_thumbnail_container" style={{ "max-height": maxHeight + "px" }} >
                    { /* Calculate aspect ratio, using %padding will size _container correctly */ }
                    <div style={{ paddingBottom: (100 * content.info.h / content.info.w) + '%' }}></div>

                    { /* mx_MImageBody_thumbnail resizes img to exactly container size */ }
                    { img }
                </div>
            </a> : null;

        return (
            <span className="mx_MImageBody" ref="body">
                { thumbnail }
                <MFileBody {...this.props} decryptedBlob={this.state.decryptedBlob} />
            </span>
      );
    }

    render() {
        const content = this.props.mxEvent.getContent();

        if (this.state.error !== null) {
            return (
                <span className="mx_MImageBody" ref="body">
                    <img src="img/warning.svg" width="16" height="16" />
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

        return this._messageContent(contentUrl, thumbUrl, content);
    }
}
