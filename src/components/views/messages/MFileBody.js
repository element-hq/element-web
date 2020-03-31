/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd

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
import createReactClass from 'create-react-class';
import filesize from 'filesize';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import {decryptFile} from '../../../utils/DecryptFile';
import Tinter from '../../../Tinter';
import request from 'browser-request';
import Modal from '../../../Modal';
import AccessibleButton from "../elements/AccessibleButton";


// A cached tinted copy of require("../../../../res/img/download.svg")
let tintedDownloadImageURL;
// Track a list of mounted MFileBody instances so that we can update
// the require("../../../../res/img/download.svg") when the tint changes.
let nextMountId = 0;
const mounts = {};

/**
 * Updates the tinted copy of require("../../../../res/img/download.svg") when the tint changes.
 */
function updateTintedDownloadImage() {
    // Download the svg as an XML document.
    // We could cache the XML response here, but since the tint rarely changes
    // it's probably not worth it.
    // Also note that we can't use fetch here because fetch doesn't support
    // file URLs, which the download image will be if we're running from
    // the filesystem (like in an Electron wrapper).
    request({uri: require("../../../../res/img/download.svg")}, (err, response, body) => {
        if (err) return;

        const svg = new DOMParser().parseFromString(body, "image/svg+xml");
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
    });
}

Tinter.registerTintable(updateTintedDownloadImage);

// User supplied content can contain scripts, we have to be careful that
// we don't accidentally run those script within the same origin as the
// client. Otherwise those scripts written by remote users can read
// the access token and end-to-end keys that are in local storage.
//
// For attachments downloaded directly from the homeserver we can use
// Content-Security-Policy headers to disable script execution.
//
// But attachments with end-to-end encryption are more difficult to handle.
// We need to decrypt the attachment on the client and then display it.
// To display the attachment we need to turn the decrypted bytes into a URL.
//
// There are two ways to turn bytes into URLs, data URL and blob URLs.
// Data URLs aren't suitable for downloading a file because Chrome has a
// 2MB limit on the size of URLs that can be viewed in the browser or
// downloaded. This limit does not seem to apply when the url is used as
// the source attribute of an image tag.
//
// Blob URLs are generated using window.URL.createObjectURL and unfortunately
// for our purposes they inherit the origin of the page that created them.
// This means that any scripts that run when the URL is viewed will be able
// to access local storage.
//
// The easiest solution is to host the code that generates the blob URL on
// a different domain to the client.
// Another possibility is to generate the blob URL within a sandboxed iframe.
// The downside of using a second domain is that it complicates hosting,
// the downside of using a sandboxed iframe is that the browers are overly
// restrictive in what you are allowed to do with the generated URL.

/**
 * Get the current CSS style for a DOMElement.
 * @param {HTMLElement} element The element to get the current style of.
 * @return {string} The CSS style encoded as a string.
 */
function computedStyle(element) {
    if (!element) {
        return "";
    }
    const style = window.getComputedStyle(element, null);
    let cssText = style.cssText;
    if (cssText == "") {
        // Firefox doesn't implement ".cssText" for computed styles.
        // https://bugzilla.mozilla.org/show_bug.cgi?id=137687
        for (let i = 0; i < style.length; i++) {
            cssText += style[i] + ":";
            cssText += style.getPropertyValue(style[i]) + ";";
        }
    }
    return cssText;
}

export default createReactClass({
    displayName: 'MFileBody',

    getInitialState: function() {
        return {
            decryptedBlob: (this.props.decryptedBlob ? this.props.decryptedBlob : null),
        };
    },

    propTypes: {
        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,
        /* already decrypted blob */
        decryptedBlob: PropTypes.object,
        /* called when the download link iframe is shown */
        onHeightChanged: PropTypes.func,
        /* the shape of the tile, used */
        tileShape: PropTypes.string,
    },

    /**
     * Extracts a human readable label for the file attachment to use as
     * link text.
     *
     * @params {Object} content The "content" key of the matrix event.
     * @return {string} the human readable link text for the attachment.
     */
    presentableTextForFile: function(content) {
        let linkText = _t("Attachment");
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
        return MatrixClientPeg.get().mxcUrlToHttp(content.url);
    },

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount: function() {
        this._iframe = createRef();
        this._dummyLink = createRef();
        this._downloadImage = createRef();
    },

    componentDidMount: function() {
        // Add this to the list of mounted components to receive notifications
        // when the tint changes.
        this.id = nextMountId++;
        mounts[this.id] = this;
        this.tint();
    },

    componentDidUpdate: function(prevProps, prevState) {
        if (this.props.onHeightChanged && !prevState.decryptedBlob && this.state.decryptedBlob) {
            this.props.onHeightChanged();
        }
    },

    componentWillUnmount: function() {
        // Remove this from the list of mounted components
        delete mounts[this.id];
    },

    tint: function() {
        // Update our tinted copy of require("../../../../res/img/download.svg")
        if (this._downloadImage.current) {
            this._downloadImage.current.src = tintedDownloadImageURL;
        }
        if (this._iframe.current) {
            // If the attachment is encrypted then the download image
            // will be inside the iframe so we wont be able to update
            // it directly.
            this._iframe.current.contentWindow.postMessage({
                imgSrc: tintedDownloadImageURL,
                style: computedStyle(this._dummyLink.current),
            }, "*");
        }
    },

    render: function() {
        const content = this.props.mxEvent.getContent();
        const text = this.presentableTextForFile(content);
        const isEncrypted = content.file !== undefined;
        const fileName = content.body && content.body.length > 0 ? content.body : _t("Attachment");
        const contentUrl = this._getContentUrl();
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const fileSize = content.info ? content.info.size : null;
        const fileType = content.info ? content.info.mimetype : "application/octet-stream";

        if (isEncrypted) {
            if (this.state.decryptedBlob === null) {
                // Need to decrypt the attachment
                // Wait for the user to click on the link before downloading
                // and decrypting the attachment.
                let decrypting = false;
                const decrypt = (e) => {
                    if (decrypting) {
                        return false;
                    }
                    decrypting = true;
                    decryptFile(content.file).then((blob) => {
                        this.setState({
                            decryptedBlob: blob,
                        });
                    }).catch((err) => {
                        console.warn("Unable to decrypt attachment: ", err);
                        Modal.createTrackedDialog('Error decrypting attachment', '', ErrorDialog, {
                            title: _t("Error"),
                            description: _t("Error decrypting attachment"),
                        });
                    }).finally(() => {
                        decrypting = false;
                    });
                };

                // This button should actually Download because usercontent/ will try to click itself
                // but it is not guaranteed between various browsers' settings.
                return (
                    <span className="mx_MFileBody">
                        <div className="mx_MFileBody_download">
                            <AccessibleButton onClick={decrypt}>
                                { _t("Decrypt %(text)s", { text: text }) }
                            </AccessibleButton>
                        </div>
                    </span>
                );
            }

            // When the iframe loads we tell it to render a download link
            const onIframeLoad = (ev) => {
                ev.target.contentWindow.postMessage({
                    imgSrc: tintedDownloadImageURL,
                    style: computedStyle(this._dummyLink.current),
                    blob: this.state.decryptedBlob,
                    // Set a download attribute for encrypted files so that the file
                    // will have the correct name when the user tries to download it.
                    // We can't provide a Content-Disposition header like we would for HTTP.
                    download: fileName,
                    textContent: _t("Download %(text)s", { text: text }),
                    // only auto-download if a user triggered this iframe explicitly
                    auto: !this.props.decryptedBlob,
                }, "*");
            };

            const url = "usercontent/"; // XXX: this path should probably be passed from the skin

            // If the attachment is encrypted then put the link inside an iframe.
            return (
                <span className="mx_MFileBody">
                    <div className="mx_MFileBody_download">
                        <div style={{display: "none"}}>
                            { /*
                              * Add dummy copy of the "a" tag
                              * We'll use it to learn how the download link
                              * would have been styled if it was rendered inline.
                              */ }
                            <a ref={this._dummyLink} />
                        </div>
                        <iframe
                            src={`${url}?origin=${encodeURIComponent(window.location.origin)}`}
                            onLoad={onIframeLoad}
                            ref={this._iframe}
                            sandbox="allow-scripts allow-downloads allow-downloads-without-user-activation" />
                    </div>
                </span>
            );
        } else if (contentUrl) {
            const downloadProps = {
                target: "_blank",
                rel: "noreferrer noopener",

                // We set the href regardless of whether or not we intercept the download
                // because we don't really want to convert the file to a blob eagerly, and
                // still want "open in new tab" and "save link as" to work.
                href: contentUrl,
            };

            // Blobs can only have up to 500mb, so if the file reports as being too large then
            // we won't try and convert it. Likewise, if the file size is unknown then we'll assume
            // it is too big. There is the risk of the reported file size and the actual file size
            // being different, however the user shouldn't normally run into this problem.
            const fileTooBig = typeof(fileSize) === 'number' ? fileSize > 524288000 : true;

            if (["application/pdf"].includes(fileType) && !fileTooBig) {
                // We want to force a download on this type, so use an onClick handler.
                downloadProps["onClick"] = (e) => {
                    console.log(`Downloading ${fileType} as blob (unencrypted)`);

                    // Avoid letting the <a> do its thing
                    e.preventDefault();
                    e.stopPropagation();

                    // Start a fetch for the download
                    // Based upon https://stackoverflow.com/a/49500465
                    fetch(contentUrl).then((response) => response.blob()).then((blob) => {
                        const blobUrl = URL.createObjectURL(blob);

                        // We have to create an anchor to download the file
                        const tempAnchor = document.createElement('a');
                        tempAnchor.download = fileName;
                        tempAnchor.href = blobUrl;
                        document.body.appendChild(tempAnchor); // for firefox: https://stackoverflow.com/a/32226068
                        tempAnchor.click();
                        tempAnchor.remove();
                    });
                };
            } else {
                // Else we are hoping the browser will do the right thing
                downloadProps["download"] = fileName;
            }

            // If the attachment is not encrypted then we check whether we
            // are being displayed in the room timeline or in a list of
            // files in the right hand side of the screen.
            if (this.props.tileShape === "file_grid") {
                return (
                    <span className="mx_MFileBody">
                        <div className="mx_MFileBody_download">
                            <a className="mx_MFileBody_downloadLink" {...downloadProps}>
                                { fileName }
                            </a>
                            <div className="mx_MImageBody_size">
                                { content.info && content.info.size ? filesize(content.info.size) : "" }
                            </div>
                        </div>
                    </span>
                );
            } else {
                return (
                    <span className="mx_MFileBody">
                        <div className="mx_MFileBody_download">
                            <a {...downloadProps}>
                                <img src={tintedDownloadImageURL} width="12" height="14" ref={this._downloadImage} />
                                { _t("Download %(text)s", { text: text }) }
                            </a>
                        </div>
                    </span>
                );
            }
        } else {
            const extra = text ? (': ' + text) : '';
            return <span className="mx_MFileBody">
                { _t("Invalid file%(extra)s", { extra: extra }) }
            </span>;
        }
    },
});
