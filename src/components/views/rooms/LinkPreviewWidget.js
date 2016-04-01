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

var MatrixClientPeg = require('../../../MatrixClientPeg');

var linkify = require('linkifyjs');
var linkifyElement = require('linkifyjs/element');
var linkifyMatrix = require('../../../linkify-matrix');
linkifyMatrix(linkify);

module.exports = React.createClass({
    displayName: 'LinkPreviewWidget',

    propTypes: {
        link: React.PropTypes.string.isRequired
    },

    getInitialState: function() {
        return {
            preview: null
        };
    },

    componentWillMount: function() {
        MatrixClientPeg.get().getUrlPreview(this.props.link).then((res)=>{
            this.setState({ preview: res });
        }, (error)=>{
            console.error("Failed to get preview for " + this.props.link + " " + error);
        });
    },

    componentDidMount: function() {
        if (this.refs.description)
            linkifyElement(this.refs.description, linkifyMatrix.options);
    },

    componentDidUpdate: function() {
        if (this.refs.description)
            linkifyElement(this.refs.description, linkifyMatrix.options);
    },

    render: function() {
        var p = this.state.preview;
        if (!p) return <div/>;
        var img = p["og:image"]
        if (img && img.startsWith("mxc://")) img = MatrixClientPeg.get().mxcUrlToHttp(img, 100, 100)
        return (
            <div className="mx_LinkPreviewWidget">
                <div className="mx_LinkPreviewWidget_image">
                    <a href={ this.props.link } target="_blank"><img style={{ maxWidth: 100, maxHeight: 100 }} src={ img }/></a>
                </div>
                <div className="mx_LinkPreviewWidget_caption">
                    <div className="mx_LinkPreviewWidget_title"><a href={ this.props.link } target="_blank">{ p["og:title"] }</a></div>
                    <div className="mx_LinkPreviewWidget_siteName">{ p["og:site_name"] ? (" - " + p["og:site_name"]) : null }</div>
                    <div className="mx_LinkPreviewWidget_description" ref="description">
                        { p["og:description"] }
                    </div>
                </div>
            </div>
        );
    }
});
