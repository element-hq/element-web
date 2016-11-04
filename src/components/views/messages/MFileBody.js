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
            decryptedUrl: null,
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
        var content = this.props.mxEvent.getContent();
        if (content.file !== undefined) {
            return this.state.decryptedUrl;
        } else {
            return MatrixClientPeg.get().mxcUrlToHttp(content.url);
        }
    },

    componentDidMount: function() {
        var content = this.props.mxEvent.getContent();
        var self = this;
        if (content.file !== undefined && this.state.decryptedUrl === null) {
            DecryptFile.decryptFile(content.file).then(function(url) {
                self.setState({
                    decryptedUrl: url,
                });
            }).catch(function (err) {
                console.warn("Unable to decrypt attachment: ", err)
                // Set a placeholder image when we can't decrypt the image.
                self.refs.image.src = "img/warning.svg";
            });
        }
    },

    render: function() {
        var content = this.props.mxEvent.getContent();

        var text = this.presentableTextForFile(content);

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

        var contentUrl = this._getContentUrl();

        if (contentUrl) {
            if (this.props.tileShape === "file_grid") {
                return (
                    <span className="mx_MFileBody">
                        <div className="mx_MImageBody_download">
                            <a className="mx_ImageBody_downloadLink" href={contentUrl} target="_blank" rel="noopener">
                                { content.body && content.body.length > 0 ? content.body : "Attachment" }
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
                            <a href={contentUrl} target="_blank" rel="noopener">
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
