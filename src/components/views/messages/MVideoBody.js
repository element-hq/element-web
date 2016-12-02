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
import MFileBody from './MFileBody';
import MatrixClientPeg from '../../../MatrixClientPeg';
import Model from '../../../Modal';
import sdk from '../../../index';
import { decryptFile, readBlobAsDataUri } from '../../../utils/DecryptFile';
import q from 'q';

module.exports = React.createClass({
    displayName: 'MVideoBody',

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
        var widthMulti = thumbWidth / fullWidth;
        var heightMulti = thumbHeight / fullHeight;
        if (widthMulti < heightMulti) {
            // width is the dominant dimension so scaling will be fixed on that
            return widthMulti;
        }
        else {
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
        } else if (content.info.thumbnail_url) {
            return MatrixClientPeg.get().mxcUrlToHttp(content.info.thumbnail_url);
        } else {
            return null;
        }
    },

    componentDidMount: function() {
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined && this.state.decryptedUrl === null) {
            var thumbnailPromise = q(null);
            if (content.info.thumbnail_file) {
                thumbnailPromise = decryptFile(
                    content.info.thumbnail_file
                ).then(function(blob) {
                    return readBlobAsDataUri(blob);
                });
            }
            var decryptedBlob;
            thumbnailPromise.then((thumbnailUrl) => {
                return decryptFile(content.file).then(function(blob) {
                    decryptedBlob = blob;
                    return readBlobAsDataUri(blob);
                }).then((contentUrl) => {
                    this.setState({
                        decryptedUrl: contentUrl,
                        decryptedThumbnailUrl: thumbnailUrl,
                        decryptedBlob: decryptedBlob,
                    });
                });
            }).catch((err) => {
                console.warn("Unable to decrypt attachment: ", err)
                // Set a placeholder image when we can't decrypt the image.
                this.setState({
                    error: err,
                });
            }).done();
        }
    },

    render: function() {
        const content = this.props.mxEvent.getContent();

        if (this.state.error !== null) {
            return (
                <span className="mx_MVideoBody" ref="body">
                    <img src="img/warning.svg" width="16" height="16"/>
                    Error decrypting video
                </span>
            );
        }

        if (content.file !== undefined && this.state.decryptedUrl === null) {
            // Need to decrypt the attachment
            // The attachment is decrypted in componentDidMount.
            // For now add an img tag with a spinner.
            return (
                <span className="mx_MVideoBody" ref="body">
                    <div className="mx_MImageBody_thumbnail" ref="image" style={{
                        "display": "flex",
                        "align-items": "center",
                        "justify-items": "center",
                        "width": "100%",
                    }}>
                        <img src="img/spinner.gif" alt={content.body} width="16" height="16"/>
                    </div>
                </span>
            );
        }

        const contentUrl = this._getContentUrl();
        const thumbUrl = this._getThumbUrl();

        var height = null;
        var width = null;
        var poster = null;
        var preload = "metadata";
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
                    controls preload={preload} autoPlay={false}
                    height={height} width={width} poster={poster}>
                </video>
                <MFileBody {...this.props} decryptedBlob={this.state.decryptedBlob} />
            </span>
        );
    },
});
