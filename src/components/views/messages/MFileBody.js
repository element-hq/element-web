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
import filesize from 'filesize';
import MatrixClientPeg from '../../../MatrixClientPeg';
import sdk from '../../../index';
import {decryptFile} from '../../../utils/DecryptFile';
import Tinter from '../../../Tinter';
import 'isomorphic-fetch';
import q from 'q';

// A cached tinted copy of "img/download.svg"
var tintedDownloadImageURL;
// Track a list of mounted MFileBody instances so that we can update
// the "img/download.svg" when the tint changes.
var nextMountId = 0;
const mounts = {};

/**
 * Updates the tinted copy of "img/download.svg" when the tint changes.
 */
function updateTintedDownloadImage() {
    // Download the svg as an XML document.
    // We could cache the XML response here, but since the tint rarely changes
    // it's probably not worth it.
    q(fetch("img/download.svg")).then(function(response) {
        return response.text();
    }).then(function(svgText) {
        const svg = new DOMParser().parseFromString(svgText, "image/svg+xml");
        // Apply the fixups to the XML.
        const fixups = Tinter.calcSvgFixups([{contentDocument: svg}]);
        Tinter.applySvgFixups(fixups);
        // Encoded the fixed up SVG as a data URL.
        const svgString = new XMLSerializer().serializeToString(svg);
        tintedDownloadImageURL = "data:image/svg+xml;base64," + window.btoa(svgString);
        // Notify each mounted MFileBody that the URL has changed.
        Object.keys(mounts).forEach(function(id) {
            mounts[id].tint();
        });
    }).done();
}

Tinter.registerTintable(updateTintedDownloadImage);

module.exports = React.createClass({
    displayName: 'MFileBody',

    getInitialState: function() {
        return {
            decryptedUrl: (this.props.decryptedUrl ? this.props.decryptedUrl : null),
        };
    },

    /**
     * Extracts a human readable label for the file attachment to use as
     * link text.
     *
     * @params {Object} content The "content" key of the matrix event.
     * @return {string} the human readable link text for the attachment.
     */
    presentableTextForFile: function(content) {
        var linkText = 'Attachment';
        if (content.body && content.body.length > 0) {
            // The content body should be the name of the file including a
            // file extension.
            linkText = content.body;
        }

        if (content.info && content.info.size) {
            // If we know the size of the file then add it as human readable
            // string to the end of the link text so that the user knows how
            // big a file they are downloading.
            // The content.info also contains a MIME-type but we don't display
            // it since it is "ugly", users generally aren't aware what it
            // means and the type of the attachment can usually be inferrered
            // from the file extension.
            linkText += ' (' + filesize(content.info.size) + ')';
        }
        return linkText;
    },

    _getContentUrl: function() {
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined) {
            return this.state.decryptedUrl;
        } else {
            return MatrixClientPeg.get().mxcUrlToHttp(content.url);
        }
    },

    componentDidMount: function() {
        // Add this to the list of mounted components to receive notifications
        // when the tint changes.
        this.id = nextMountId++;
        mounts[this.id] = this;
        this.tint();
        // Check whether we need to decrypt the file content.
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined && this.state.decryptedUrl === null) {
            decryptFile(content.file).done((url) => {
                this.setState({
                    decryptedUrl: url,
                });
            }, (err) => {
                console.warn("Unable to decrypt attachment: ", err)
                // Set a placeholder image when we can't decrypt the image.
                this.refs.image.src = "img/warning.svg";
            });
        }
    },

    componentWillUnmount: function() {
        // Remove this from the list of mounted components
        delete mounts[this.id];
    },

    tint: function() {
        // Update our tinted copy of "img/download.svg"
        if (this.refs.downloadImage) {
            this.refs.downloadImage.src = tintedDownloadImageURL;
        }
    },

    render: function() {
        const content = this.props.mxEvent.getContent();

        const text = this.presentableTextForFile(content);

        if (content.file !== undefined && this.state.decryptedUrl === null) {

            // Need to decrypt the attachment
            // The attachment is decrypted in componentDidMount.
            // For now add an img tag with a spinner.
            return (
                <span className="mx_MFileBody" ref="body">
                <img src="img/spinner.gif" ref="image"
                    alt={content.body} />
                </span>
            );
        }

        const contentUrl = this._getContentUrl();

        const fileName = content.body && content.body.length > 0 ? content.body : "Attachment";

        var downloadAttr = undefined;
        if (this.state.decryptedUrl) {
            // If the file is encrypted then we MUST download it rather than displaying it
            // because Firefox is vunerable to XSS attacks in data:// URLs
            // and all browsers are vunerable to XSS attacks in blob: URLs
            // created with window.URL.createObjectURL
            // See https://bugzilla.mozilla.org/show_bug.cgi?id=255107
            // See https://w3c.github.io/FileAPI/#originOfBlobURL
            //
            // This is not a problem for unencrypted links because they are
            // either fetched from a different domain so are safe because of
            // the same-origin policy or they are fetch from the same domain,
            // in which case we trust that the homeserver will set a
            // Content-Security-Policy that disables script execution.
            // It is reasonable to trust the homeserver in that case since
            // it is the same domain that controls this javascript.
            //
            // We can't apply the same workaround for encrypted files because
            // we can't supply HTTP headers when the user clicks on a blob:
            // or data:// uri.
            //
            // We should probably provide a download attribute anyway so that
            // the file will have the correct name when the user tries to
            // download it. We can't provide a Content-Disposition header
            // like we would for HTTP.
            downloadAttr = fileName;
        }

        if (contentUrl) {
            if (this.props.tileShape === "file_grid") {
                return (
                    <span className="mx_MFileBody">
                        <div className="mx_MImageBody_download">
                            <a className="mx_ImageBody_downloadLink" href={contentUrl} target="_blank" rel="noopener" download={downloadAttr}>
                                { fileName }
                            </a>
                            <div className="mx_MImageBody_size">
                                { content.info && content.info.size ? filesize(content.info.size) : "" }
                            </div>
                        </div>
                    </span>
                );
            }
            else {
                return (
                    <span className="mx_MFileBody">
                        <div className="mx_MImageBody_download">
                            <a href={contentUrl} target="_blank" rel="noopener" download={downloadAttr}>
                                <img src={tintedDownloadImageURL} width="12" height="14" ref="downloadImage"/>
                                Download {text}
                            </a>
                        </div>
                    </span>
                );
            }
        } else {
            var extra = text ? (': ' + text) : '';
            return <span className="mx_MFileBody">
                Invalid file{extra}
            </span>
        }
    },
});
