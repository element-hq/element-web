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

var React = require('react');
var filesize = require('filesize');

// Pull in the encryption lib so that we can decrypt attachments.
var encrypt = require("browser-encrypt-attachment");
// Pull in a fetch polyfill so we can download encrypted attachments.
require("isomorphic-fetch");

var MatrixClientPeg = require('../../../MatrixClientPeg');
var ImageUtils = require('../../../ImageUtils');
var Modal = require('../../../Modal');
var sdk = require('../../../index');
var dis = require("../../../dispatcher");


module.exports = React.createClass({
    displayName: 'MImageBody',

    propTypes: {
        /* the MatrixEvent to show */
        mxEvent: React.PropTypes.object.isRequired,
    },

    onClick: function onClick(ev) {
        if (ev.button == 0 && !ev.metaKey) {
            ev.preventDefault();
            var content = this.props.mxEvent.getContent();
            var httpUrl = MatrixClientPeg.get().mxcUrlToHttp(content.url);
            var ImageView = sdk.getComponent("elements.ImageView");
            var params = {
                src: httpUrl,
                mxEvent: this.props.mxEvent
            };

            if (content.info) {
                params.width = content.info.w;
                params.height = content.info.h;
                params.fileSize = content.info.size;
            }

            Modal.createDialog(ImageView, params, "mx_Dialog_lightbox");
        }
    },

    _isGif: function() {
        var content = this.props.mxEvent.getContent();
        return (content && content.info && content.info.mimetype === "image/gif");
    },

    onImageEnter: function(e) {
        if (!this._isGif()) {
            return;
        }
        var imgElement = e.target;
        imgElement.src = MatrixClientPeg.get().mxcUrlToHttp(
            this.props.mxEvent.getContent().url
        );
    },

    onImageLeave: function(e) {
        if (!this._isGif()) {
            return;
        }
        var imgElement = e.target;
        imgElement.src = this._getThumbUrl();
    },

    _getThumbUrl: function() {
        var content = this.props.mxEvent.getContent();
        return MatrixClientPeg.get().mxcUrlToHttp(content.url, 800, 600);
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        this.fixupHeight();
        var content = this.props.mxEvent.getContent();
        var self = this;
        if (content.file !== undefined) {
            // TODO: hook up an error handler to the promise.
            this.decryptFile(content.file).catch(function (err) {
                console.warn("Unable to decrypt attachment: ", err)
                // Set a placeholder image when we can't decrypt the image.
                self.refs.image.src = "img/warning.svg";
            });
        }
    },

    decryptFile: function(file) {
        var url = MatrixClientPeg.get().mxcUrlToHttp(file.url);
        var self = this;
        // Download the encrypted file as an array buffer.
        return fetch(url).then(function (response) {
            return response.arrayBuffer();
        }).then(function (responseData) {
            // Decrypt the array buffer using the information taken from
            // the event content.
            return encrypt.decryptAttachment(responseData, file);
        }).then(function(dataArray) {
            // Turn the array into a Blob and use createObjectURL to make
            // a url that we can use as an img src.
            var blob = new Blob([dataArray]);
            var blobUrl = window.URL.createObjectURL(blob);
            self.refs.image.src = blobUrl;
            self.refs.image.onload = function() {
                window.URL.revokeObjectURL(blobUrl);
            };
        });
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        if (payload.action === "timeline_resize") {
            this.fixupHeight();
        }
    },

    fixupHeight: function() {
        if (!this.refs.image) {
            console.warn("Refusing to fix up height on MImageBody with no image element");
            return;
        }

        var content = this.props.mxEvent.getContent();

        var thumbHeight = null;
        var timelineWidth = this.refs.body.offsetWidth;
        var maxHeight = 600; // let images take up as much width as they can so long as the height doesn't exceed 600px.
        // the alternative here would be 600*timelineWidth/800; to scale them down to fit inside a 4:3 bounding box

        //console.log("trying to fit image into timelineWidth of " + this.refs.body.offsetWidth + " or " + this.refs.body.clientWidth);
        if (content.info) {
            thumbHeight = ImageUtils.thumbHeight(content.info.w, content.info.h, timelineWidth, maxHeight);
        }
        this.refs.image.style.height = thumbHeight + "px";
        // console.log("Image height now", thumbHeight);
    },

    render: function() {
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        var content = this.props.mxEvent.getContent();
        var cli = MatrixClientPeg.get();

        var download;
        if (this.props.tileShape === "file_grid") {
            download = (
                <div className="mx_MImageBody_download">
                    <a className="mx_MImageBody_downloadLink" href={cli.mxcUrlToHttp(content.url)} target="_blank" rel="noopener">
                        {content.body}
                    </a>
                    <div className="mx_MImageBody_size">
                        { content.info && content.info.size ? filesize(content.info.size) : "" }
                    </div>
                </div>
            );
        }
        else {
            download = (
                <div className="mx_MImageBody_download">
                    <a href={cli.mxcUrlToHttp(content.url)} target="_blank" rel="noopener">
                        <TintableSvg src="img/download.svg" width="12" height="14"/>
                        Download {content.body} ({ content.info && content.info.size ? filesize(content.info.size) : "Unknown size" })
                    </a>
                </div>
            );
        }

        var thumbUrl = this._getThumbUrl();
        if (content.file !== undefined) {
            // Need to decrypt the attachment
            // The attachment is decrypted in componentDidMount.
            // For now add an img tag with a spinner.
            return (
                <span className="mx_MImageBody" ref="body">
                <img className="mx_MImageBody_thumbnail" src="img/spinner.gif" ref="image"
                    alt={content.body} />
                </span>
            );
        } else if (thumbUrl) {
            return (
                <span className="mx_MImageBody" ref="body">
                    <a href={cli.mxcUrlToHttp(content.url)} onClick={ this.onClick }>
                        <img className="mx_MImageBody_thumbnail" src={thumbUrl} ref="image"
                            alt={content.body}
                            onMouseEnter={this.onImageEnter}
                            onMouseLeave={this.onImageLeave} />
                    </a>
                    { download }
                </span>
            );
        } else if (content.body) {
            return (
                <span className="mx_MImageBody">
                    Image '{content.body}' cannot be displayed.
                </span>
            );
        } else {
            return (
                <span className="mx_MImageBody">
                    This image cannot be displayed.
                </span>
            );
        }
    },
});
