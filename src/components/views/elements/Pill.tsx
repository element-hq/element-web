/*
Copyright 2017 - 2019, 2021 The Matrix.org Foundation C.I.C.

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

import React, { useState } from "react";
import classNames from "classnames";
import { Room } from "matrix-js-sdk/src/models/room";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import Tooltip, { Alignment } from "../elements/Tooltip";
import { usePermalink } from "../../../hooks/usePermalink";

export enum PillType {
    UserMention = "TYPE_USER_MENTION",
    RoomMention = "TYPE_ROOM_MENTION",
    AtRoomMention = "TYPE_AT_ROOM_MENTION", // '@room' mention
}

export const pillRoomNotifPos = (text: string): number => {
    return text.indexOf("@room");
};

export const pillRoomNotifLen = (): number => {
    return "@room".length;
};

export interface PillProps {
    // The Type of this Pill. If url is given, this is auto-detected.
    type?: PillType;
    // The URL to pillify (no validation is done)
    url?: string;
    /** Whether the pill is in a message. It will act as a link then. */
    inMessage?: boolean;
    // The room in which this pill is being rendered
    room?: Room;
    // Whether to include an avatar in the pill
    shouldShowPillAvatar?: boolean;
}

export const Pill: React.FC<PillProps> = ({ type: propType, url, inMessage, room, shouldShowPillAvatar }) => {
    const [hover, setHover] = useState(false);
    const { avatar, onClick, resourceId, text, type } = usePermalink({
        room,
        type: propType,
        url,
    });

    if (!type) {
        return null;
    }

    const classes = classNames("mx_Pill", {
        mx_AtRoomPill: type === PillType.AtRoomMention,
        mx_RoomPill: type === PillType.RoomMention,
        mx_SpacePill: type === "space",
        mx_UserPill: type === PillType.UserMention,
        mx_UserPill_me: resourceId === MatrixClientPeg.get().getUserId(),
    });

    const onMouseOver = (): void => {
        setHover(true);
    };

    const onMouseLeave = (): void => {
        setHover(false);
    };

    const tip = hover && resourceId ? <Tooltip label={resourceId} alignment={Alignment.Right} /> : null;

    return (
        <bdi>
            <MatrixClientContext.Provider value={MatrixClientPeg.get()}>
                {inMessage && url ? (
                    <a
                        className={classes}
                        href={url}
                        onClick={onClick}
                        onMouseOver={onMouseOver}
                        onMouseLeave={onMouseLeave}
                    >
                        {shouldShowPillAvatar && avatar}
                        <span className="mx_Pill_linkText">{text}</span>
                        {tip}
                    </a>
                ) : (
                    <span className={classes} onMouseOver={onMouseOver} onMouseLeave={onMouseLeave}>
                        {shouldShowPillAvatar && avatar}
                        <span className="mx_Pill_linkText">{text}</span>
                        {tip}
                    </span>
                )}
            </MatrixClientContext.Provider>
        </bdi>
    );
};
