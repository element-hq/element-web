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

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

var DateUtils = require('../../../../DateUtils');
var filesize = require('filesize');

module.exports = React.createClass({
    displayName: 'ImageView',

    // XXX: keyboard shortcuts for managing dialogs should be done by the modal dialog base class somehow, surely...
    componentDidMount: function() {
        document.addEventListener("keydown", this.onKeyDown);
    },

    componentWillUnmount: function() {
        document.removeEventListener("keydown", this.onKeyDown);
    },

    onKeyDown: function(ev) {
        if (ev.keyCode == 27) { // escape
            ev.stopPropagation();
            ev.preventDefault();
            this.props.onFinished();
        }
    },

    onRedactClick: function() {
        var self = this;
        MatrixClientPeg.get().redactEvent(
            this.props.mxEvent.getRoomId(), this.props.mxEvent.getId()
        ).done(function() {
            if (self.props.onFinished) self.props.onFinished();
        }, function(e) {
            var ErrorDialog = sdk.getComponent("organisms.ErrorDialog");
            // display error message stating you couldn't delete this.
            var code = e.errcode || e.statusCode;
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: "You cannot delete this image. (" + code + ")"
            });
        });
    },

    render: function() {

/*
        // In theory max-width: 80%, max-height: 80% on the CSS should work
        // but in practice, it doesn't, so do it manually:

        var width = this.props.width || 500;
        var height = this.props.height || 500;

        var maxWidth = document.documentElement.clientWidth * 0.8;
        var maxHeight = document.documentElement.clientHeight * 0.8;

        var widthFrac = width / maxWidth;
        var heightFrac = height / maxHeight;

        var displayWidth;
        var displayHeight;
        if (widthFrac > heightFrac) {
            displayWidth = Math.min(width, maxWidth);
            displayHeight = (displayWidth / width) * height;
        } else {
            displayHeight = Math.min(height, maxHeight);
            displayWidth = (displayHeight / height) * width;
        }

        var style = {
            width: displayWidth,
            height: displayHeight
        };
*/
        var style;

        return (
            <div className="mx_ImageView">
                <div className="mx_ImageView_lhs">
                </div>
                <div className="mx_ImageView_content">
                    <img src={this.props.src} width={this.props.width} height={this.props.height}/>
                    <div className="mx_ImageView_labelWrapper">
                        <div className="mx_ImageView_label">
                            <div className="mx_ImageView_shim">
                            </div>
                            <div className="mx_ImageView_name">
                                { this.props.mxEvent.getContent().body }
                            </div>
                            <div className="mx_ImageView_metadata">
                                Uploaded on { DateUtils.formatDate(new Date(this.props.mxEvent.getTs())) } by { this.props.mxEvent.getSender() }
                            </div>
                            <a className="mx_ImageView_link" href={ this.props.src } target="_blank">
                                <div className="mx_ImageView_download">
                                        Download this file ({ filesize(this.props.mxEvent.getContent().info.size) })
                                </div>
                            </a>
                            <div className="mx_ImageView_button">
                                <a className="mx_ImageView_link" href={ this.props.src } target="_blank">
                                    View full screen
                                </a>
                            </div>
                            <div className="mx_ImageView_button" onClick={this.onRedactClick}>
                                Redact
                            </div>
                            <div className="mx_ImageView_shim">
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mx_ImageView_rhs">
                </div>
            </div>
        );
    }
});
