/*
 Copyright 2016 OpenMarket Ltd

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
import sdk from '../../../index';
import { decryptFile, readBlobAsDataUri } from '../../../utils/DecryptFile';

export default class MAudioBody extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            playing: false,
            decryptedUrl: null,
            decryptedBlob: null,
            error: null,
        }
    }
    onPlayToggle() {
        this.setState({
            playing: !this.state.playing
        });
    }

    _getContentUrl() {
        const content = this.props.mxEvent.getContent();
        if (content.file !== undefined) {
            return this.state.decryptedUrl;
        } else {
            return MatrixClientPeg.get().mxcUrlToHttp(content.url);
        }
    }

    componentDidMount() {
        var content = this.props.mxEvent.getContent();
        if (content.file !== undefined && this.state.decryptedUrl === null) {
            var decryptedBlob;
            decryptFile(content.file).then(function(blob) {
                decryptedBlob = blob;
                return readBlobAsDataUri(decryptedBlob);
            }).done((url) => {
                this.setState({
                    decryptedUrl: url,
                    decryptedBlob: decryptedBlob,
                });
            }, (err) => {
                console.warn("Unable to decrypt attachment: ", err);
                this.setState({
                    error: err,
                });
            });
        }
    }

    render() {

        const content = this.props.mxEvent.getContent();

        if (this.state.error !== null) {
            return (
                <span className="mx_MAudioBody" ref="body">
                    <img src="img/warning.svg" width="16" height="16"/>
                    Error decrypting audio
                </span>
            );
        }

        if (content.file !== undefined && this.state.decryptedUrl === null) {
            // Need to decrypt the attachment
            // The attachment is decrypted in componentDidMount.
            // For now add an img tag with a 16x16 spinner.
            // Not sure how tall the audio player is so not sure how tall it should actually be.
            return (
                <span className="mx_MAudioBody">
                    <img src="img/spinner.gif" alt={content.body} width="16" height="16"/>
                </span>
            );
        }

        const contentUrl = this._getContentUrl();

        return (
            <span className="mx_MAudioBody">
                <audio src={contentUrl} controls />
                <MFileBody {...this.props} decryptedBlob={this.state.decryptedBlob} />
            </span>
        );
    }
}
