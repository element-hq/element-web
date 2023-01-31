/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015, 2016, 2018, 2019, 2020, 2023 The Matrix.org Foundation C.I.C.

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

import React, { CSSProperties, useCallback, useContext, useEffect, useState } from "react";
import classNames from "classnames";
import { ResizeMethod } from "matrix-js-sdk/src/@types/partials";
import { ClientEvent } from "matrix-js-sdk/src/client";
import { SyncState } from "matrix-js-sdk/src/sync";

import * as AvatarLogic from "../../../Avatar";
import AccessibleButton from "../elements/AccessibleButton";
import RoomContext from "../../../contexts/RoomContext";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { toPx } from "../../../utils/units";
import { _t } from "../../../languageHandler";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";

interface IProps {
    /** The name (first initial used as default) */
    name: string;
    /** ID for generating hash colours */
    idName?: string;
    /** onHover title text */
    title?: string;
    /** highest priority of them all, shortcut to set in urls[0] */
    url?: string;
    /** [highest_priority, ... , lowest_priority] */
    urls?: string[];
    width?: number;
    height?: number;
    /** @deprecated not actually used */
    resizeMethod?: ResizeMethod;
    /** true to add default url */
    defaultToInitialLetter?: boolean;
    onClick?: React.ComponentPropsWithoutRef<typeof AccessibleTooltipButton>["onClick"];
    inputRef?: React.RefObject<HTMLImageElement & HTMLSpanElement>;
    className?: string;
    tabIndex?: number;
    style?: CSSProperties;
}

const calculateUrls = (url: string | undefined, urls: string[] | undefined, lowBandwidth: boolean): string[] => {
    // work out the full set of urls to try to load. This is formed like so:
    // imageUrls: [ props.url, ...props.urls ]

    let _urls: string[] = [];
    if (!lowBandwidth) {
        _urls = urls || [];

        if (url) {
            // copy urls and put url first
            _urls = [url, ..._urls];
        }
    }

    // deduplicate URLs
    return Array.from(new Set(_urls));
};

/**
 * Hook for cycling through a changing set of images.
 *
 * The set of images is updated whenever `url` or `urls` change, the user's
 * `lowBandwidth` preference changes, or the client reconnects.
 *
 * Returns `[imageUrl, onError]`. When `onError` is called, the next image in
 * the set will be displayed.
 */
const useImageUrl = ({
    url,
    urls,
}: {
    url: string | undefined;
    urls: string[] | undefined;
}): [string | undefined, () => void] => {
    // Since this is a hot code path and the settings store can be slow, we
    // use the cached lowBandwidth value from the room context if it exists
    const roomContext = useContext(RoomContext);
    const lowBandwidth = roomContext.lowBandwidth;

    const [imageUrls, setUrls] = useState<string[]>(calculateUrls(url, urls, lowBandwidth));
    const [urlsIndex, setIndex] = useState<number>(0);

    const onError = useCallback(() => {
        setIndex((i) => i + 1); // try the next one
    }, []);

    useEffect(() => {
        setUrls(calculateUrls(url, urls, lowBandwidth));
        setIndex(0);
    }, [url, JSON.stringify(urls)]); // eslint-disable-line react-hooks/exhaustive-deps

    const cli = useContext(MatrixClientContext);
    const onClientSync = useCallback((syncState: SyncState, prevState: SyncState | null) => {
        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
        const reconnected = syncState !== SyncState.Error && prevState !== syncState;
        if (reconnected) {
            setIndex(0);
        }
    }, []);
    useTypedEventEmitter(cli, ClientEvent.Sync, onClientSync);

    const imageUrl = imageUrls[urlsIndex];
    return [imageUrl, onError];
};

const BaseAvatar: React.FC<IProps> = (props) => {
    const {
        name,
        idName,
        title,
        url,
        urls,
        width = 40,
        height = 40,
        defaultToInitialLetter = true,
        onClick,
        inputRef,
        className,
        style: parentStyle,
        resizeMethod: _unused, // to keep it from being in `otherProps`
        ...otherProps
    } = props;

    const style = {
        ...parentStyle,
        width: toPx(width),
        height: toPx(height),
    };

    const [imageUrl, onError] = useImageUrl({ url, urls });

    if (!imageUrl && defaultToInitialLetter && name) {
        const avatar = <TextAvatar name={name} idName={idName} width={width} height={height} title={title} />;

        if (onClick) {
            return (
                <AccessibleButton
                    aria-label={_t("Avatar")}
                    aria-live="off"
                    {...otherProps}
                    element="span"
                    className={classNames("mx_BaseAvatar", className)}
                    onClick={onClick}
                    inputRef={inputRef}
                    style={style}
                >
                    {avatar}
                </AccessibleButton>
            );
        } else {
            return (
                <span
                    className={classNames("mx_BaseAvatar", className)}
                    ref={inputRef}
                    {...otherProps}
                    style={style}
                    role="presentation"
                >
                    {avatar}
                </span>
            );
        }
    }

    if (onClick) {
        return (
            <AccessibleButton
                className={classNames("mx_BaseAvatar mx_BaseAvatar_image", className)}
                element="img"
                src={imageUrl}
                onClick={onClick}
                onError={onError}
                style={style}
                title={title}
                alt={_t("Avatar")}
                inputRef={inputRef}
                data-testid="avatar-img"
                {...otherProps}
            />
        );
    } else {
        return (
            <img
                className={classNames("mx_BaseAvatar mx_BaseAvatar_image", className)}
                src={imageUrl}
                onError={onError}
                style={style}
                title={title}
                alt=""
                ref={inputRef}
                data-testid="avatar-img"
                {...otherProps}
            />
        );
    }
};

export default BaseAvatar;
export type BaseAvatarType = React.FC<IProps>;

const TextAvatar: React.FC<{
    name: string;
    idName?: string;
    width: number;
    height: number;
    title?: string;
}> = ({ name, idName, width, height, title }) => {
    const initialLetter = AvatarLogic.getInitialLetter(name);

    return (
        <span
            className="mx_BaseAvatar_image mx_BaseAvatar_initial"
            aria-hidden="true"
            style={{
                backgroundColor: AvatarLogic.getColorForString(idName || name),
                width: toPx(width),
                height: toPx(height),
                fontSize: toPx(width * 0.65),
                lineHeight: toPx(height),
            }}
            title={title}
            data-testid="avatar-img"
        >
            {initialLetter}
        </span>
    );
};
