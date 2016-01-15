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
var AvatarLogic = require("../../../Avatar");

module.exports = React.createClass({
    displayName: 'BaseAvatar',

    propTypes: {
        name: React.PropTypes.string.isRequired,
        idName: React.PropTypes.string, // ID for generating hash colours
        title: React.PropTypes.string,
        url: React.PropTypes.string, // highest priority of them all
        urls: React.PropTypes.array, // [highest_priority, ... , lowest_priority]
        width: React.PropTypes.number,
        height: React.PropTypes.number,
        resizeMethod: React.PropTypes.string,
        defaultToInitialLetter: React.PropTypes.bool
    },

    getDefaultProps: function() {
        return {
            width: 40,
            height: 40,
            resizeMethod: 'crop',
            defaultToInitialLetter: true
        }
    },

    getInitialState: function() {
        var defaultImageUrl = null;
        if (this.props.defaultToInitialLetter) {
            defaultImageUrl = AvatarLogic.defaultAvatarUrlForString(
                this.props.idName || this.props.name
            );
        }
        return {
            imageUrl: this.props.url || (this.props.urls ? this.props.urls[0] : null),
            defaultImageUrl: defaultImageUrl,
            urlsIndex: 0
        };
    },

    componentWillReceiveProps: function(nextProps) {
        // retry all the urls again, they may have changed.
        if (this.props.urls && this.state.urlsIndex > 0) {
            this.setState({
                urlsIndex: 0,
                imageUrl: this.props.urls[0]
            });
        }
    },

    onError: function(ev) {
        var failedUrl = ev.target.src;

        if (this.props.urls) {
            var nextIndex = this.state.urlsIndex + 1;
            if (nextIndex < this.props.urls.length) {
                // try another
                this.setState({
                    urlsIndex: nextIndex,
                    imageUrl: this.props.urls[nextIndex]
                });
                return;
            }
        }

        // either no urls array or we've reached the end of it, we may have a default
        // we can use...
        if (this.props.defaultToInitialLetter) {
            if (failedUrl === this.state.defaultImageUrl) {
                return; // don't tightloop if the browser can't load the default URL
            }
            this.setState({ imageUrl: this.state.defaultImageUrl })
        }
    },

    _getInitialLetter: function() {
        var name = this.props.name;
        var initial = name[0];
        if (initial === '@' && name[1]) {
            initial = name[1];
        }
        return initial.toUpperCase();
    },

    render: function() {
        var name = this.props.name;

        if (this.state.imageUrl === this.state.defaultImageUrl) {
            var initialLetter = this._getInitialLetter();
            return (
                <span className="mx_MemberAvatar" {...this.props}>
                    <span className="mx_MemberAvatar_initial" aria-hidden="true"
                            style={{ fontSize: (this.props.width * 0.65) + "px",
                                    width: this.props.width + "px",
                                    lineHeight: this.props.height + "px" }}>
                        { initialLetter }
                    </span>
                    <img className="mx_MemberAvatar_image" src={this.state.imageUrl}
                        title={this.props.title} onError={this.onError}
                        width={this.props.width} height={this.props.height} />
                </span>
            );            
        }
        return (
            <img className="mx_MemberAvatar mx_MemberAvatar_image" src={this.state.imageUrl}
                onError={this.onError}
                width={this.props.width} height={this.props.height}
                title={this.props.title}
                {...this.props} />
        );
    }
});
