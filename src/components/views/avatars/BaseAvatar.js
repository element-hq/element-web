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

import React from 'react';
import PropTypes from 'prop-types';
import { MatrixClient } from 'matrix-js-sdk';
import AvatarLogic from '../../../Avatar';
import sdk from '../../../index';
import AccessibleButton from '../elements/AccessibleButton';

module.exports = React.createClass({
    displayName: 'BaseAvatar',

    propTypes: {
        name: PropTypes.string.isRequired, // The name (first initial used as default)
        idName: PropTypes.string, // ID for generating hash colours
        title: PropTypes.string, // onHover title text
        url: PropTypes.string, // highest priority of them all, shortcut to set in urls[0]
        urls: PropTypes.array, // [highest_priority, ... , lowest_priority]
        width: PropTypes.number,
        height: PropTypes.number,
        // XXX resizeMethod not actually used.
        resizeMethod: PropTypes.string,
        defaultToInitialLetter: PropTypes.bool, // true to add default url
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getDefaultProps: function() {
        return {
            width: 40,
            height: 40,
            resizeMethod: 'crop',
            defaultToInitialLetter: true,
        };
    },

    getInitialState: function() {
        return this._getState(this.props);
    },

    componentWillMount() {
        this.unmounted = false;
        this.context.matrixClient.on('sync', this.onClientSync);
    },

    componentWillUnmount() {
        this.unmounted = true;
        this.context.matrixClient.removeListener('sync', this.onClientSync);
    },

    componentWillReceiveProps: function(nextProps) {
        // work out if we need to call setState (if the image URLs array has changed)
        const newState = this._getState(nextProps);
        const newImageUrls = newState.imageUrls;
        const oldImageUrls = this.state.imageUrls;
        if (newImageUrls.length !== oldImageUrls.length) {
            this.setState(newState); // detected a new entry
        } else {
            // check each one to see if they are the same
            for (let i = 0; i < newImageUrls.length; i++) {
                if (oldImageUrls[i] !== newImageUrls[i]) {
                    this.setState(newState); // detected a diff
                    break;
                }
            }
        }
    },

    onClientSync(syncState, prevState) {
        if (this.unmounted) return;

        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING or PREPARED.
        const reconnected = syncState !== "ERROR" && prevState !== syncState;
        if (reconnected &&
            // Did we fall back?
            this.state.urlsIndex > 0
        ) {
            // Start from the highest priority URL again
            this.setState({
                urlsIndex: 0,
            });
        }
    },

    _getState: function(props) {
        // work out the full set of urls to try to load. This is formed like so:
        // imageUrls: [ props.url, props.urls, default image ]

        const urls = props.urls || [];
        if (props.url) {
            urls.unshift(props.url); // put in urls[0]
        }

        let defaultImageUrl = null;
        if (props.defaultToInitialLetter) {
            defaultImageUrl = AvatarLogic.defaultAvatarUrlForString(
                props.idName || props.name,
            );
            urls.push(defaultImageUrl); // lowest priority
        }
        return {
            imageUrls: urls,
            defaultImageUrl: defaultImageUrl,
            urlsIndex: 0,
        };
    },

    onError: function(ev) {
        const nextIndex = this.state.urlsIndex + 1;
        if (nextIndex < this.state.imageUrls.length) {
            // try the next one
            this.setState({
                urlsIndex: nextIndex,
            });
        }
    },

    /**
     * returns the first (non-sigil) character of 'name',
     * converted to uppercase
     */
    _getInitialLetter: function(name) {
        if (name.length < 1) {
            return undefined;
        }

        let idx = 0;
        const initial = name[0];
        if ((initial === '@' || initial === '#' || initial === '+') && name[1]) {
            idx++;
        }

        // string.codePointAt(0) would do this, but that isn't supported by
        // some browsers (notably PhantomJS).
        let chars = 1;
        const first = name.charCodeAt(idx);

        // check if it’s the start of a surrogate pair
        if (first >= 0xD800 && first <= 0xDBFF && name[idx+1]) {
            const second = name.charCodeAt(idx+1);
            if (second >= 0xDC00 && second <= 0xDFFF) {
                chars++;
            }
        }

        const firstChar = name.substring(idx, idx+chars);
        return firstChar.toUpperCase();
    },

    render: function() {
        const EmojiText = sdk.getComponent('elements.EmojiText');
        const imageUrl = this.state.imageUrls[this.state.urlsIndex];

        const {
            name, idName, title, url, urls, width, height, resizeMethod,
            defaultToInitialLetter, onClick,
            ...otherProps
        } = this.props;

        if (imageUrl === this.state.defaultImageUrl) {
            const initialLetter = this._getInitialLetter(name);
            const textNode = (
                <EmojiText className="mx_BaseAvatar_initial" aria-hidden="true"
                    style={{ fontSize: (width * 0.65) + "px",
                    width: width + "px",
                    lineHeight: height + "px" }}
                >
                    { initialLetter }
                </EmojiText>
            );
            const imgNode = (
                <img className="mx_BaseAvatar_image" src={imageUrl}
                    alt="" title={title} onError={this.onError}
                    width={width} height={height} />
            );
            if (onClick != null) {
                return (
                    <AccessibleButton element='span' className="mx_BaseAvatar"
                        onClick={onClick} {...otherProps}
                    >
                        { textNode }
                        { imgNode }
                    </AccessibleButton>
                );
            } else {
                return (
                    <span className="mx_BaseAvatar" {...otherProps}>
                        { textNode }
                        { imgNode }
                    </span>
                );
            }
        }
        if (onClick != null) {
            return (
                <AccessibleButton className="mx_BaseAvatar mx_BaseAvatar_image"
                    element='img'
                    src={imageUrl}
                    onClick={onClick}
                    onError={this.onError}
                    width={width} height={height}
                    title={title} alt=""
                    {...otherProps} />
            );
        } else {
            return (
                <img className="mx_BaseAvatar mx_BaseAvatar_image" src={imageUrl}
                    onError={this.onError}
                    width={width} height={height}
                    title={title} alt=""
                    {...otherProps} />
            );
        }
    },
});
