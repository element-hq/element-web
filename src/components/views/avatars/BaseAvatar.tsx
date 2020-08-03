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
import classNames from 'classnames';
import * as AvatarLogic from '../../../Avatar';
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from '../elements/AccessibleButton';
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {useEventEmitter} from "../../../hooks/useEventEmitter";
import {toPx} from "../../../utils/units";

interface IProps {
    name: string; // The name (first initial used as default)
    idName?: string; // ID for generating hash colours
    title?: string; // onHover title text
    url?: string; // highest priority of them all, shortcut to set in urls[0]
    urls?: string[]; // [highest_priority, ... , lowest_priority]
    width?: number;
    height?: number;
    // XXX: resizeMethod not actually used.
    resizeMethod?: string;
    defaultToInitialLetter?: boolean; // true to add default url
    onClick?: React.MouseEventHandler;
    inputRef?: React.RefObject<HTMLImageElement & HTMLSpanElement>;
    className?: string;
}

const useImageUrl = ({url, urls}): [string, () => void] => {
    const [imageUrls, setUrls] = useState<string[]>([]);
    const [urlsIndex, setIndex] = useState<number>();

    const onError = useCallback(() => {
        setIndex(i => i + 1); // try the next one
    }, []);
    const memoizedUrls = useMemo(() => urls, [JSON.stringify(urls)]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        // work out the full set of urls to try to load. This is formed like so:
        // imageUrls: [ props.url, ...props.urls ]

        let _urls = [];
        if (!SettingsStore.getValue("lowBandwidth")) {
            _urls = memoizedUrls || [];

            if (url) {
                _urls.unshift(url); // put in urls[0]
            }
        }

        // deduplicate URLs
        _urls = Array.from(new Set(_urls));

        setIndex(0);
        setUrls(_urls);
    }, [url, memoizedUrls]); // eslint-disable-line react-hooks/exhaustive-deps

    const cli = useContext(MatrixClientContext);
    const onClientSync = useCallback((syncState, prevState) => {
        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
        const reconnected = syncState !== "ERROR" && prevState !== syncState;
        if (reconnected) {
            setIndex(0);
        }
    }, []);
    useEventEmitter(cli, "sync", onClientSync);

    const imageUrl = imageUrls[urlsIndex];
    return [imageUrl, onError];
};

const BaseAvatar = (props: IProps) => {
    const {
        name,
        idName,
        title,
        url,
        urls,
        width = 40,
        height = 40,
        resizeMethod = "crop", // eslint-disable-line no-unused-vars
        defaultToInitialLetter = true,
        onClick,
        inputRef,
        className,
        ...otherProps
    } = props;

    const [imageUrl, onError] = useImageUrl({url, urls});

    if (!imageUrl && defaultToInitialLetter) {
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
                src={AvatarLogic.defaultAvatarUrlForString(idName || name)}
                alt=""
                title={title}
                onError={onError}
                style={{
                    width: toPx(width),
                    height: toPx(height),
                }}
                aria-hidden="true" />
        );

        if (onClick) {
            return (
                <AccessibleButton
                    {...otherProps}
                    element="span"
                    className={classNames("mx_BaseAvatar", className)}
                    onClick={onClick}
                    inputRef={inputRef}
                >
                    { textNode }
                    { imgNode }
                </AccessibleButton>
            );
        } else {
            return (
                <span
                    className={classNames("mx_BaseAvatar", className)}
                    ref={inputRef}
                    {...otherProps}
                    role="presentation"
                >
                    { textNode }
                    { imgNode }
                </span>
            );
        }
    }

    if (onClick) {
        return (
            <AccessibleButton
                className={classNames("mx_BaseAvatar mx_BaseAvatar_image", className)}
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
                className={classNames("mx_BaseAvatar mx_BaseAvatar_image", className)}
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

export default BaseAvatar;
export type BaseAvatarType = React.FC<IProps>;
