/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React, {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import PropTypes from 'prop-types';
import * as AvatarLogic from '../../../Avatar';
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from '../elements/AccessibleButton';
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {useEventEmitter} from "../../../hooks/useEventEmitter";
import {toPx} from "../../../utils/units";

const useImageUrl = ({url, urls, idName, name, defaultToInitialLetter}) => {
    const [imageUrls, setUrls] = useState([]);
    const [urlsIndex, setIndex] = useState();

    const onError = () => {
        const nextIndex = urlsIndex + 1;
        if (nextIndex < imageUrls.length) {
            // try the next one
            setIndex(nextIndex);
        }
    };

    const defaultImageUrl = useMemo(() => AvatarLogic.defaultAvatarUrlForString(idName || name), [idName, name]);

    useEffect(() => {
        // work out the full set of urls to try to load. This is formed like so:
        // imageUrls: [ props.url, ...props.urls, default image ]

        let _urls = [];
        if (!SettingsStore.getValue("lowBandwidth")) {
            _urls = urls || [];

            if (url) {
                _urls.unshift(url); // put in urls[0]
            }
        }

        if (defaultToInitialLetter) {
            _urls.push(defaultImageUrl); // lowest priority
        }

        // deduplicate URLs
        _urls = Array.from(new Set(_urls));

        setIndex(0);
        setUrls(_urls);
    }, [url, ...(urls || [])]); // eslint-disable-line react-hooks/exhaustive-deps

    const cli = useContext(MatrixClientContext);
    const onClientSync = useCallback((syncState, prevState) => {
        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
        const reconnected = syncState !== "ERROR" && prevState !== syncState;
        if (reconnected && urlsIndex > 0 ) { // Did we fall back?
            // Start from the highest priority URL again
            setIndex(0);
        }
    }, [urlsIndex]);
    useEventEmitter(cli, "sync", onClientSync);

    const imageUrl = imageUrls[urlsIndex];
    return [imageUrl, imageUrl === defaultImageUrl, onError];
};

const BaseAvatar = (props) => {
    const {
        name,
        idName,
        title,
        url,
        urls,
        width=40,
        height=40,
        resizeMethod="crop", // eslint-disable-line no-unused-vars
        defaultToInitialLetter=true,
        onClick,
        inputRef,
        ...otherProps
    } = props;

    const [imageUrl, isDefault, onError] = useImageUrl({url, urls, idName, name, defaultToInitialLetter});

    if (isDefault) {
        const initialLetter = AvatarLogic.getInitialLetter(name);
        const textNode = (
            <span
                className="mx_BaseAvatar_initial"
                aria-hidden="true"
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
            <img
                className="mx_BaseAvatar_image"
                src={imageUrl}
                alt=""
                title={title}
                onError={onError}
                style={{
                    width: toPx(width),
                    height: toPx(height),
                }}
                aria-hidden="true" />
        );

        if (onClick != null) {
            return (
                <AccessibleButton
                    {...otherProps}
                    element="span"
                    className="mx_BaseAvatar"
                    onClick={onClick}
                    inputRef={inputRef}
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
                onError={onError}
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
                onError={onError}
                style={{
                    width: toPx(width),
                    height: toPx(height),
                }}
                title={title} alt=""
                ref={inputRef}
                {...otherProps} />
        );
    }
};

BaseAvatar.displayName = "BaseAvatar";

BaseAvatar.propTypes = {
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
    onClick: PropTypes.func,
    inputRef: PropTypes.oneOfType([
        // Either a function
        PropTypes.func,
        // Or the instance of a DOM native element
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]),
};

export default BaseAvatar;
