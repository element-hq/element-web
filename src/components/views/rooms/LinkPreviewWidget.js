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

module.exports = React.createClass({
    displayName: 'LinkPreviewWidget',

    propTypes: {
        link: React.PropTypes.string.isRequired
    },

    getInitialState: function() {
        return {
            preview: {}
        };
    },

    componentWillMount: function() {
        MatrixClientPeg.get().getUrlPreview(this.props.link).then((res)=>{
            this.setState({ preview: res });
        }, (error)=>{
            console.error("Failed to get preview for URL: " + error);
        });
    },

    render: function() {
        var p = this.state.preview;
        return (
            <div className="mx_LinkPreviewWidget">
                <div className="mx_LinkPreviewWidget_title">{ p["og:title"] }</div>
                <div className="mx_LinkPreviewWidget_siteName">{ p["og:site_name"] ? (" &emdash; " + p["og:site_name"]) : null }</div>
                <div className="mx_LinkPreviewWidget_image">
                    <img src={ p["og:image"] }/>
                </div>
                <div className="mx_LinkPreviewWidget_description">
                    { p["og:description"] }
                </div>

            </div>
        );
    }
});
