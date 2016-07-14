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

var React = require('react');

var sdk = require('../../../index');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var ImageUtils = require('../../../ImageUtils');
var Modal = require('../../../Modal');

var linkify = require('linkifyjs');
var linkifyElement = require('linkifyjs/element');
var linkifyMatrix = require('../../../linkify-matrix');
linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'LinkPreviewWidget',

    propTypes: {
        link: React.PropTypes.string.isRequired, // the URL being previewed
        mxEvent: React.PropTypes.object.isRequired, // the Event associated with the preview
        onCancelClick: React.PropTypes.func, // called when the preview's cancel ('hide') button is clicked
        onWidgetLoad: React.PropTypes.func, // called when the preview's contents has loaded
    },

    getInitialState: function() {
        return {
            preview: null
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
                this.props.onWidgetLoad
            );
        }, (error)=>{
            console.error("Failed to get preview for " + this.props.link + " " + error);
        }).done();
    },

    componentDidMount: function() {
        if (this.refs.description)
            linkifyElement(this.refs.description, linkifyMatrix.options);
    },

    componentDidUpdate: function() {
        if (this.refs.description)
            linkifyElement(this.refs.description, linkifyMatrix.options);
    },

    componentWillUnmount: function() {
        this.unmounted = true;
    },

    render: function() {
        var p = this.state.preview;
        if (!p) return <div/>;

        // FIXME: do we want to factor out all image displaying between this and MImageBody - especially for lightboxing?
        var image = p["og:image"];
        var imageMaxWidth = 600, imageMaxHeight = 400;
        if (image && image.startsWith("mxc://")) {
            image = MatrixClientPeg.get().mxcUrlToHttp(image, imageMaxWidth, imageMaxHeight);
        }

        var thumbHeight = imageMaxHeight;
        if (p["og:image:width"] && p["og:image:height"]) {
            thumbHeight = ImageUtils.thumbHeight(p["og:image:width"], p["og:image:height"], imageMaxWidth, imageMaxHeight);
        }

        var img;
        if (image) {
            img = (
                <div className="mx_LinkPreviewWidget_image" style={{ height: thumbHeight }}>
                    <a href={ this.props.link } target="_blank">
                        <img style={{ maxWidth: imageMaxWidth, maxHeight: imageMaxHeight }} src={ image } />
                    </a>
                </div>
            );
        }

        return (
            <div className="mx_LinkPreviewWidget" >
                <div className="mx_LinkPreviewWidget_caption">
                    <div className="mx_LinkPreviewWidget_title"><a href={ this.props.link } target="_blank">{ p["og:title"] }</a></div>
                    <div className="mx_LinkPreviewWidget_siteName">{ p["og:site_name"] ? ("from " + p["og:site_name"]) : null }</div>
                </div>
                { img }
                <div className="mx_LinkPreviewWidget_description" ref="description">{ p["og:description"] } <a href={ this.props.link } target="_blank">Read more</a></div>
                <img className="mx_LinkPreviewWidget_indicator" src="img/icon-link.svg" width="13" height="16" />
            </div>
        );
    }
});
