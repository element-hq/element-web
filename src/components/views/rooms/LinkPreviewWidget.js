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

const React = require('react');
import PropTypes from 'prop-types';

const sdk = require('../../../index');
const MatrixClientPeg = require('../../../MatrixClientPeg');
const ImageUtils = require('../../../ImageUtils');
const Modal = require('../../../Modal');

const linkify = require('linkifyjs');
const linkifyElement = require('linkifyjs/element');
const linkifyMatrix = require('../../../linkify-matrix');
linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'LinkPreviewWidget',

    propTypes: {
        link: PropTypes.string.isRequired, // the URL being previewed
        mxEvent: PropTypes.object.isRequired, // the Event associated with the preview
        onCancelClick: PropTypes.func, // called when the preview's cancel ('hide') button is clicked
        onWidgetLoad: PropTypes.func, // called when the preview's contents has loaded
    },

    getInitialState: function() {
        return {
            preview: null,
        };
    },

    componentWillMount: function() {
        this.unmounted = false;
        MatrixClientPeg.get().getUrlPreview(this.props.link, this.props.mxEvent.getTs()).then((res)=>{
            if (this.unmounted) {
                return;
            }
            this.setState(
                { preview: res },
                this.props.onWidgetLoad,
            );
        }, (error)=>{
            console.error("Failed to get preview for " + this.props.link + " " + error);
        }).done();
    },

    componentDidMount: function() {
        if (this.refs.description) {
            linkifyElement(this.refs.description, linkifyMatrix.options);
        }
    },

    componentDidUpdate: function() {
        if (this.refs.description) {
            linkifyElement(this.refs.description, linkifyMatrix.options);
        }
    },

    componentWillUnmount: function() {
        this.unmounted = true;
    },

    onImageClick: function(ev) {
        const p = this.state.preview;
        if (ev.button != 0 || ev.metaKey) return;
        ev.preventDefault();
        const ImageView = sdk.getComponent("elements.ImageView");

        let src = p["og:image"];
        if (src && src.startsWith("mxc://")) {
            src = MatrixClientPeg.get().mxcUrlToHttp(src);
        }

        const params = {
            src: src,
            width: p["og:image:width"],
            height: p["og:image:height"],
            name: p["og:title"] || p["og:description"] || this.props.link,
            fileSize: p["matrix:image:size"],
            link: this.props.link,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox");
    },

    render: function() {
        const p = this.state.preview;
        if (!p || Object.keys(p).length === 0) {
            return <div />;
        }

        // FIXME: do we want to factor out all image displaying between this and MImageBody - especially for lightboxing?
        let image = p["og:image"];
        const imageMaxWidth = 100; const imageMaxHeight = 100;
        if (image && image.startsWith("mxc://")) {
            image = MatrixClientPeg.get().mxcUrlToHttp(image, imageMaxWidth, imageMaxHeight);
        }

        let thumbHeight = imageMaxHeight;
        if (p["og:image:width"] && p["og:image:height"]) {
            thumbHeight = ImageUtils.thumbHeight(p["og:image:width"], p["og:image:height"], imageMaxWidth, imageMaxHeight);
        }

        let img;
        if (image) {
            img = <div className="mx_LinkPreviewWidget_image" style={{ height: thumbHeight }}>
                    <img style={{ maxWidth: imageMaxWidth, maxHeight: imageMaxHeight }} src={image} onClick={this.onImageClick} />
                  </div>;
        }

        return (
            <div className="mx_LinkPreviewWidget" >
                { img }
                <div className="mx_LinkPreviewWidget_caption">
                    <div className="mx_LinkPreviewWidget_title"><a href={this.props.link} target="_blank" rel="noopener">{ p["og:title"] }</a></div>
                    <div className="mx_LinkPreviewWidget_siteName">{ p["og:site_name"] ? (" - " + p["og:site_name"]) : null }</div>
                    <div className="mx_LinkPreviewWidget_description" ref="description">
                        { p["og:description"] }
                    </div>
                </div>
                <img className="mx_LinkPreviewWidget_cancel mx_filterFlipColor"
                    src="img/cancel.svg" width="18" height="18"
                    onClick={this.props.onCancelClick} />
            </div>
        );
    },
});
