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
        name: React.PropTypes.string.isRequired, // The name (first initial used as default)
        idName: React.PropTypes.string, // ID for generating hash colours
        title: React.PropTypes.string, // onHover title text
        url: React.PropTypes.string, // highest priority of them all, shortcut to set in urls[0]
        urls: React.PropTypes.array, // [highest_priority, ... , lowest_priority]
        width: React.PropTypes.number,
        height: React.PropTypes.number,
        resizeMethod: React.PropTypes.string,
        defaultToInitialLetter: React.PropTypes.bool // true to add default url
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
        return this._getState(this.props);
    },

    componentWillReceiveProps: function(nextProps) {
        // work out if we need to call setState (if the image URLs array has changed)
        var newState = this._getState(nextProps);
        var newImageUrls = newState.imageUrls;
        var oldImageUrls = this.state.imageUrls;
        if (newImageUrls.length !== oldImageUrls.length) {
            this.setState(newState); // detected a new entry
        }
        else {
            // check each one to see if they are the same
            for (var i = 0; i < newImageUrls.length; i++) {
                if (oldImageUrls[i] !== newImageUrls[i]) {
                    this.setState(newState); // detected a diff
                    break;
                }
            }
        }
    },

    _getState: function(props) {
        // work out the full set of urls to try to load. This is formed like so:
        // imageUrls: [ props.url, props.urls, default image ]

        var urls = props.urls || [];
        if (props.url) {
            urls.unshift(props.url); // put in urls[0]
        }

        var defaultImageUrl = null;
        if (props.defaultToInitialLetter) {
            defaultImageUrl = AvatarLogic.defaultAvatarUrlForString(
                props.idName || props.name
            );
            urls.push(defaultImageUrl); // lowest priority
        }
        return {
            imageUrls: urls,
            defaultImageUrl: defaultImageUrl,
            urlsIndex: 0
        };
    },

    onError: function(ev) {
        var nextIndex = this.state.urlsIndex + 1;
        if (nextIndex < this.state.imageUrls.length) {
            // try the next one
            this.setState({
                urlsIndex: nextIndex
            });
        }
    },

    _getInitialLetter: function() {
        var name = this.props.name;
        //For large characters (exceeding 2 bytes), this function will get the correct character.
        //However, this does NOT get the second character correctly if a large character is before it.
        var initial = String.fromCodePoint(name.codePointAt(0));
        if ((initial === '@' || initial === '#') && name[1]) {
            initial = String.fromCodePoint(name.codePointAt(1));
        }
        return initial.toUpperCase();
    },

    render: function() {
        var name = this.props.name;

        var imageUrl = this.state.imageUrls[this.state.urlsIndex];

        if (imageUrl === this.state.defaultImageUrl) {
            var initialLetter = this._getInitialLetter();
            return (
                <span className="mx_BaseAvatar" {...this.props}>
                    <span className="mx_BaseAvatar_initial" aria-hidden="true"
                            style={{ fontSize: (this.props.width * 0.65) + "px",
                                    width: this.props.width + "px",
                                    lineHeight: this.props.height + "px" }}>
                        { initialLetter }
                    </span>
                    <img className="mx_BaseAvatar_image" src={imageUrl}
                        title={this.props.title} onError={this.onError}
                        width={this.props.width} height={this.props.height} />
                </span>
            );
        }
        return (
            <img className="mx_BaseAvatar mx_BaseAvatar_image" src={imageUrl}
                onError={this.onError}
                width={this.props.width} height={this.props.height}
                title={this.props.title}
                {...this.props} />
        );
    }
});
