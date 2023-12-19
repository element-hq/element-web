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

import React, { forwardRef, useCallback, useContext, useEffect, useState } from "react";
import classNames from "classnames";
import { ClientEvent } from "matrix-js-sdk/src/matrix";
import { Avatar } from "@vector-im/compound-web";

import SettingsStore from "../../../settings/SettingsStore";
import { ButtonEvent } from "../elements/AccessibleButton";
import RoomContext from "../../../contexts/RoomContext";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { _t } from "../../../languageHandler";

interface IProps {
    name?: React.ComponentProps<typeof Avatar>["name"]; // The name (first initial used as default)
    idName?: React.ComponentProps<typeof Avatar>["id"]; // ID for generating hash colours
    title?: string; // onHover title text
    url?: string | null; // highest priority of them all, shortcut to set in urls[0]
    urls?: string[]; // [highest_priority, ... , lowest_priority]
    type?: React.ComponentProps<typeof Avatar>["type"];
    size: string;
    onClick?: (ev: ButtonEvent) => void;
    className?: string;
    tabIndex?: number;
    altText?: string;
}

const calculateUrls = (url?: string | null, urls?: string[], lowBandwidth = false): string[] => {
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

const useImageUrl = ({ url, urls }: { url?: string | null; urls?: string[] }): [string, () => void] => {
    // Since this is a hot code path and the settings store can be slow, we
    // use the cached lowBandwidth value from the room context if it exists
    const roomContext = useContext(RoomContext);
    const lowBandwidth = roomContext ? roomContext.lowBandwidth : SettingsStore.getValue("lowBandwidth");

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
    const onClientSync = useCallback((syncState, prevState) => {
        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
        const reconnected = syncState !== "ERROR" && prevState !== syncState;
        if (reconnected) {
            setIndex(0);
        }
    }, []);
    useTypedEventEmitter(cli, ClientEvent.Sync, onClientSync);

    const imageUrl = imageUrls[urlsIndex];
    return [imageUrl, onError];
};

const BaseAvatar = forwardRef<HTMLElement, IProps>((props, ref) => {
    const {
        name,
        idName,
        title,
        url,
        urls,
        size = "40px",
        onClick,
        className,
        type = "round",
        altText = _t("common|avatar"),
        ...otherProps
    } = props;

    const [imageUrl, onError] = useImageUrl({ url, urls });

    const extraProps: Partial<React.ComponentProps<typeof Avatar>> = {};

    if (onClick) {
        extraProps["aria-live"] = "off";
        extraProps["role"] = "button";
    } else if (!imageUrl) {
        extraProps["role"] = "presentation";
        extraProps["aria-label"] = undefined;
    } else {
        extraProps["role"] = undefined;
    }

    return (
        <Avatar
            ref={ref}
            src={imageUrl}
            id={idName ?? ""}
            name={name ?? ""}
            type={type}
            size={size}
            className={classNames("mx_BaseAvatar", className)}
            aria-label={altText}
            onError={onError}
            title={title}
            onClick={onClick}
            {...extraProps}
            {...otherProps}
            data-testid="avatar-img"
        />
    );
});

export default BaseAvatar;
export type BaseAvatarType = React.FC<IProps>;
