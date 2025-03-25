/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2019 , 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement, useContext } from "react";
import classNames from "classnames";
import { type Room, type RoomMember } from "matrix-js-sdk/src/matrix";
import { Tooltip } from "@vector-im/compound-web";
import { LinkIcon, UserSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { usePermalink } from "../../../hooks/usePermalink";
import RoomAvatar from "../avatars/RoomAvatar";
import MemberAvatar from "../avatars/MemberAvatar";
import { _t } from "../../../languageHandler";

export enum PillType {
    UserMention = "TYPE_USER_MENTION",
    RoomMention = "TYPE_ROOM_MENTION",
    AtRoomMention = "TYPE_AT_ROOM_MENTION", // '@room' mention
    EventInSameRoom = "TYPE_EVENT_IN_SAME_ROOM",
    EventInOtherRoom = "TYPE_EVENT_IN_OTHER_ROOM",
    Keyword = "TYPE_KEYWORD", // Used to highlight keywords that triggered a notification rule
}

const linkIcon = <LinkIcon className="mx_Pill_LinkIcon mx_BaseAvatar" />;

const PillRoomAvatar: React.FC<{
    shouldShowPillAvatar: boolean;
    room: Room | null;
}> = ({ shouldShowPillAvatar, room }) => {
    if (!shouldShowPillAvatar) {
        return null;
    }

    if (room) {
        return <RoomAvatar room={room} size="16px" aria-hidden="true" />;
    }
    return linkIcon;
};

const PillMemberAvatar: React.FC<{
    shouldShowPillAvatar: boolean;
    member: RoomMember | null;
}> = ({ shouldShowPillAvatar, member }) => {
    if (!shouldShowPillAvatar) {
        return null;
    }

    if (member) {
        return <MemberAvatar member={member} size="16px" aria-hidden="true" hideTitle />;
    }
    return <UserSolidIcon className="mx_Pill_UserIcon mx_BaseAvatar" />;
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
    // Explicitly-provided text to display in the pill
    text?: string;
}

export const Pill: React.FC<PillProps> = ({
    type: propType,
    url,
    inMessage,
    room,
    shouldShowPillAvatar = true,
    text: customPillText,
}) => {
    const cli = useContext(MatrixClientContext);
    const {
        event,
        member,
        onClick,
        resourceId,
        targetRoom,
        text: linkText,
        type,
    } = usePermalink({
        room,
        type: propType,
        url,
    });
    const text = customPillText ?? linkText;

    if (!type || !text) {
        return null;
    }

    const classes = classNames("mx_Pill", {
        mx_AtRoomPill: type === PillType.AtRoomMention,
        mx_RoomPill: type === PillType.RoomMention,
        mx_SpacePill: type === "space" || targetRoom?.isSpaceRoom(),
        mx_UserPill: type === PillType.UserMention,
        mx_UserPill_me: resourceId === cli.getUserId(),
        mx_EventPill: type === PillType.EventInOtherRoom || type === PillType.EventInSameRoom,
        mx_KeywordPill: type === PillType.Keyword,
    });

    let avatar: ReactElement | null = null;
    let pillText: string | null = text;

    switch (type) {
        case PillType.EventInOtherRoom:
            {
                avatar = <PillRoomAvatar shouldShowPillAvatar={shouldShowPillAvatar} room={targetRoom} />;
                pillText = _t("pill|permalink_other_room", {
                    room: text,
                });
            }
            break;
        case PillType.EventInSameRoom:
            {
                if (event) {
                    avatar = <PillMemberAvatar shouldShowPillAvatar={shouldShowPillAvatar} member={member} />;
                    pillText = _t("pill|permalink_this_room", {
                        user: text,
                    });
                } else {
                    avatar = linkIcon;
                    pillText = _t("common|message");
                }
            }
            break;
        case PillType.AtRoomMention:
        case PillType.RoomMention:
        case "space":
            avatar = <PillRoomAvatar shouldShowPillAvatar={shouldShowPillAvatar} room={targetRoom} />;
            break;
        case PillType.UserMention:
            avatar = <PillMemberAvatar shouldShowPillAvatar={shouldShowPillAvatar} member={member} />;
            break;
        case PillType.Keyword:
            break;
        default:
            return null;
    }

    const isAnchor = !!inMessage && !!url;
    return (
        <bdi>
            <Tooltip
                description={resourceId ?? ""}
                open={resourceId ? undefined : false}
                placement="right"
                isTriggerInteractive={isAnchor}
            >
                {isAnchor ? (
                    <a className={classes} href={url} onClick={onClick}>
                        {avatar}
                        <span className="mx_Pill_text">{pillText}</span>
                    </a>
                ) : (
                    <span className={classes}>
                        {avatar}
                        <span className="mx_Pill_text">{pillText}</span>
                    </span>
                )}
            </Tooltip>
        </bdi>
    );
};
