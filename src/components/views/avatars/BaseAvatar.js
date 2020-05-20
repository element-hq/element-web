/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import createReactClass from 'create-react-class';
import * as AvatarLogic from '../../../Avatar';
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from '../elements/AccessibleButton';
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {toPx} from "../../../utils/units";

export default createReactClass({
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
        inputRef: PropTypes.oneOfType([
            // Either a function
            PropTypes.func,
            // Or the instance of a DOM native element
            PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
        ]),
    },

    statics: {
        contextType: MatrixClientContext,
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

    componentDidMount() {
        this.unmounted = false;
        this.context.on('sync', this.onClientSync);
    },

    componentWillUnmount() {
        this.unmounted = true;
        this.context.removeListener('sync', this.onClientSync);
    },

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps: function(nextProps) {
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

    onClientSync: function(syncState, prevState) {
        if (this.unmounted) return;

        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
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

        let urls = [];
        if (!SettingsStore.getValue("lowBandwidth")) {
            urls = props.urls || [];

            if (props.url) {
                urls.unshift(props.url); // put in urls[0]
            }
        }

        let defaultImageUrl = null;
        if (props.defaultToInitialLetter) {
            defaultImageUrl = AvatarLogic.defaultAvatarUrlForString(
                props.idName || props.name,
            );
            urls.push(defaultImageUrl); // lowest priority
        }

        // deduplicate URLs
        urls = Array.from(new Set(urls));

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

    render: function() {
        const imageUrl = this.state.imageUrls[this.state.urlsIndex];

        const {
            name, idName, title, url, urls, width, height, resizeMethod,
            defaultToInitialLetter, onClick, inputRef,
            ...otherProps
        } = this.props;

        if (imageUrl === this.state.defaultImageUrl) {
            const initialLetter = AvatarLogic.getInitialLetter(name);
            const textNode = (
                <span className="mx_BaseAvatar_initial" aria-hidden="true"
                    style={{
                        fontSize: toPx(width * 0.65),
                        width: toPx(width),
                        lineHeight: toPx(height),
                    }}
                >
                    { initialLetter }
                </span>
            );
            const imgNode = (
                <img className="mx_BaseAvatar_image" src={imageUrl}
                    alt="" title={title} onError={this.onError}
                    aria-hidden="true"
                    style={{
                        width: toPx(width),
                        height: toPx(height)
                    }} />
            );
            if (onClick != null) {
                return (
                    <AccessibleButton element='span' className="mx_BaseAvatar"
                        onClick={onClick} inputRef={inputRef} {...otherProps}
                    >
                        { textNode }
                        { imgNode }
                    </AccessibleButton>
                );
            } else {
                return (
                    <span className="mx_BaseAvatar" ref={inputRef} {...otherProps}>
                        { textNode }
                        { imgNode }
                    </span>
                );
            }
        }
        if (onClick != null) {
            return (
                <AccessibleButton
                    className="mx_BaseAvatar mx_BaseAvatar_image"
                    element='img'
                    src={imageUrl}
                    onClick={onClick}
                    onError={this.onError}
                    style={{
                        width: toPx(width),
                        height: toPx(height),
                    }}
                    title={title} alt=""
                    inputRef={inputRef}
                    {...otherProps} />
            );
        } else {
            return (
                <img
                    className="mx_BaseAvatar mx_BaseAvatar_image"
                    src={imageUrl}
                    onError={this.onError}
                    style={{
                        width: toPx(width),
                        height: toPx(height),
                    }}
                    title={title} alt=""
                    ref={inputRef}
                    {...otherProps} />
            );
        }
    },
});
