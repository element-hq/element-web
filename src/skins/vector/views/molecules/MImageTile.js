/*
Copyright 2015 OpenMarket Ltd

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

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var Modal = require('matrix-react-sdk/lib/Modal');
var sdk = require('matrix-react-sdk')

module.exports = React.createClass({
    displayName: 'MImageTile',

    thumbHeight: function(fullWidth, fullHeight, thumbWidth, thumbHeight) {
        if (!fullWidth || !fullHeight) {
            // Cannot calculate thumbnail height for image: missing w/h in metadata. We can't even
            // log this because it's spammy
            return undefined;
        }
        if (fullWidth < thumbWidth && fullHeight < thumbHeight) {
            // no scaling needs to be applied
            return fullHeight;
        }
        var widthMulti = thumbWidth / fullWidth;
        var heightMulti = thumbHeight / fullHeight;
        if (widthMulti < heightMulti) {
            // width is the dominant dimension so scaling will be fixed on that
            return Math.floor(widthMulti * fullHeight);
        }
        else {
            // height is the dominant dimension so scaling will be fixed on that
            return Math.floor(heightMulti * fullHeight);
        }
    },

    onClick: function(ev) {
        if (ev.button == 0 && !ev.metaKey) {
            ev.preventDefault();
            var content = this.props.mxEvent.getContent();
            var httpUrl = MatrixClientPeg.get().mxcUrlToHttp(content.url);
            var ImageView = sdk.getComponent("atoms.ImageView");
            Modal.createDialog(ImageView, {
                src: httpUrl,
                width: content.info.w,
                height: content.info.h,
                mxEvent: this.props.mxEvent,
            }, "mx_Dialog_lightbox");
        }
    },

    render: function() {
        var content = this.props.mxEvent.getContent();
        var cli = MatrixClientPeg.get();

        var thumbHeight = null;
        if (content.info) thumbHeight = this.thumbHeight(content.info.w, content.info.h, 480, 360);

        var imgStyle = {};
        if (thumbHeight) imgStyle['height'] = thumbHeight;

        var thumbUrl = cli.mxcUrlToHttp(content.url, 480, 360);
        if (thumbUrl) {
            return (
                <span className="mx_MImageTile">
                    <a href={cli.mxcUrlToHttp(content.url)} onClick={ this.onClick }>
                        <img className="mx_MImageTile_thumbnail" src={thumbUrl} alt={content.body} style={imgStyle} />
                    </a>
                    <div className="mx_MImageTile_download">
                        <a href={cli.mxcUrlToHttp(content.url)} target="_blank">
                            <img src="img/download.png" width="10" height="12"/>
                            Download {content.body} ({ content.info && content.info.size ? filesize(content.info.size) : "Unknown size" })
                        </a>
                    </div>
                </span>
            );
        } else if (content.body) {
            return (
                <span className="mx_MImageTile">
                    Image '{content.body}' cannot be displayed.
                </span>
            );
        } else {
            return (
                <span className="mx_MImageTile">
                    This image cannot be displayed.
                </span>
            );
        }
    },
});
