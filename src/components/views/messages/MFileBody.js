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
var MatrixClientPeg = require('../../../MatrixClientPeg');
var sdk = require('../../../index');
var DecryptFile = require('../../../utils/DecryptFile');


module.exports = React.createClass({
    displayName: 'MFileBody',

    getInitialState: function() {
        return {
            decryptedUrl: (this.props.decryptedUrl ? this.props.decryptedUrl : null),
        };
    },

    presentableTextForFile: function(content) {
        var linkText = 'Attachment';
        if (content.body && content.body.length > 0) {
            linkText = content.body;
        }

        var additionals = [];
        if (content.info) {
            // if (content.info.mimetype && content.info.mimetype.length > 0) {
            //    additionals.push(content.info.mimetype);
            // }
            if (content.info.size) {
                additionals.push(filesize(content.info.size));
            }
        }

        if (additionals.length > 0) {
            linkText += ' (' + additionals.join(', ') + ')';
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
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined && this.state.decryptedUrl === null) {
            DecryptFile.decryptFile(content.file).done((url) => {
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

    render: function() {
        const content = this.props.mxEvent.getContent();

        const text = this.presentableTextForFile(content);

        var TintableSvg = sdk.getComponent("elements.TintableSvg");
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
                                <TintableSvg src="img/download.svg" width="12" height="14"/>
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
