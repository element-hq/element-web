/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import MFileBody from './MFileBody';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { decryptFile } from '../../../utils/DecryptFile';
import { _t } from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";
import InlineSpinner from '../elements/InlineSpinner';

export default createReactClass({
    displayName: 'MVideoBody',

    propTypes: {
        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,

        /* called when the video has loaded */
        onHeightChanged: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            decryptedUrl: null,
            decryptedThumbnailUrl: null,
            decryptedBlob: null,
            error: null,
        };
    },

    thumbScale: function(fullWidth, fullHeight, thumbWidth, thumbHeight) {
        if (!fullWidth || !fullHeight) {
            // Cannot calculate thumbnail height for image: missing w/h in metadata. We can't even
            // log this because it's spammy
            return undefined;
        }
        if (fullWidth < thumbWidth && fullHeight < thumbHeight) {
            // no scaling needs to be applied
            return 1;
        }
        const widthMulti = thumbWidth / fullWidth;
        const heightMulti = thumbHeight / fullHeight;
        if (widthMulti < heightMulti) {
            // width is the dominant dimension so scaling will be fixed on that
            return widthMulti;
        } else {
            // height is the dominant dimension so scaling will be fixed on that
            return heightMulti;
        }
    },

    _getContentUrl: function() {
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined) {
            return this.state.decryptedUrl;
        } else {
            return MatrixClientPeg.get().mxcUrlToHttp(content.url);
        }
    },

    _getThumbUrl: function() {
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined) {
            return this.state.decryptedThumbnailUrl;
        } else if (content.info && content.info.thumbnail_url) {
            return MatrixClientPeg.get().mxcUrlToHttp(content.info.thumbnail_url);
        } else {
            return null;
        }
    },

    componentDidMount: function() {
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
                    this.setState({
                        decryptedUrl: contentUrl,
                        decryptedThumbnailUrl: thumbnailUrl,
                        decryptedBlob: decryptedBlob,
                    });
                    this.props.onHeightChanged();
                });
            }).catch((err) => {
                console.warn("Unable to decrypt attachment: ", err);
                // Set a placeholder image when we can't decrypt the image.
                this.setState({
                    error: err,
                });
            });
        }
    },

    componentWillUnmount: function() {
        if (this.state.decryptedUrl) {
            URL.revokeObjectURL(this.state.decryptedUrl);
        }
        if (this.state.decryptedThumbnailUrl) {
            URL.revokeObjectURL(this.state.decryptedThumbnailUrl);
        }
    },

    render: function() {
        const content = this.props.mxEvent.getContent();

        if (this.state.error !== null) {
            return (
                <span className="mx_MVideoBody">
                    <img src={require("../../../../res/img/warning.svg")} width="16" height="16" />
                    { _t("Error decrypting video") }
                </span>
            );
        }

        if (content.file !== undefined && this.state.decryptedUrl === null) {
            // Need to decrypt the attachment
            // The attachment is decrypted in componentDidMount.
            // For now add an img tag with a spinner.
            return (
                <span className="mx_MVideoBody">
                    <div className="mx_MImageBody_thumbnail mx_MImageBody_thumbnail_spinner">
                        <InlineSpinner />
                    </div>
                </span>
            );
        }

        const contentUrl = this._getContentUrl();
        const thumbUrl = this._getThumbUrl();
        const autoplay = SettingsStore.getValue("autoplayGifsAndVideos");
        let height = null;
        let width = null;
        let poster = null;
        let preload = "metadata";
        if (content.info) {
            const scale = this.thumbScale(content.info.w, content.info.h, 480, 360);
            if (scale) {
                width = Math.floor(content.info.w * scale);
                height = Math.floor(content.info.h * scale);
            }

            if (thumbUrl) {
                poster = thumbUrl;
                preload = "none";
            }
        }
        return (
            <span className="mx_MVideoBody">
                <video className="mx_MVideoBody" src={contentUrl} alt={content.body}
                    controls preload={preload} muted={autoplay} autoPlay={autoplay}
                    height={height} width={width} poster={poster}>
                </video>
                <MFileBody {...this.props} decryptedBlob={this.state.decryptedBlob} />
            </span>
        );
    },
});
