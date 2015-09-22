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

var ImageViewController = require('../../../../controllers/atoms/ImageView')

module.exports = React.createClass({
    displayName: 'ImageView',
    mixins: [ImageViewController],

    // XXX: keyboard shortcuts for managing dialogs should be done by the modal dialog base class omehow, surely...
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

    render: function() {

        // XXX: can't we just do max-width: 80%, max-height: 80% on the CSS?
        
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

        return (
            <img className="mx_ImageView" src={this.props.src} style={style} />
        );
    }
});
