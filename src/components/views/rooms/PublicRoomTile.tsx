/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { useCallback, useContext, useEffect, useState } from "react";
import { IPublicRoomsChunkRoom } from "matrix-js-sdk/src/client";

import BaseAvatar from "../avatars/BaseAvatar";
import { mediaFromMxc } from "../../../customisations/Media";
import { linkifyAndSanitizeHtml } from "../../../HtmlUtils";
import { getDisplayAliasForRoom } from "../../structures/RoomDirectory";
import AccessibleButton from "../elements/AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { _t } from "../../../languageHandler";

const MAX_NAME_LENGTH = 80;
const MAX_TOPIC_LENGTH = 800;

interface IProps {
    room: IPublicRoomsChunkRoom;
    removeFromDirectory?: (room: IPublicRoomsChunkRoom) => void;
    showRoom: (room: IPublicRoomsChunkRoom, roomAlias?: string, autoJoin?: boolean, shouldPeek?: boolean) => void;
}

export const PublicRoomTile = ({
    room,
    showRoom,
    removeFromDirectory,
}: IProps) => {
    const client = useContext(MatrixClientContext);

    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [topic, setTopic] = useState("");

    const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

    const isGuest = client.isGuest();

    useEffect(() => {
        const clientRoom = client.getRoom(room.room_id);

        setHasJoinedRoom(clientRoom?.getMyMembership() === "join");

        let name = room.name || getDisplayAliasForRoom(room) || _t('Unnamed room');
        if (name.length > MAX_NAME_LENGTH) {
            name = `${name.substring(0, MAX_NAME_LENGTH)}...`;
        }
        setName(name);

        let topic = room.topic || '';
        // Additional truncation based on line numbers is done via CSS,
        // but to ensure that the DOM is not polluted with a huge string
        // we give it a hard limit before rendering.
        if (topic.length > MAX_TOPIC_LENGTH) {
            topic = `${topic.substring(0, MAX_TOPIC_LENGTH)}...`;
        }
        topic = linkifyAndSanitizeHtml(topic);
        setTopic(topic);
        if (room.avatar_url) {
            setAvatarUrl(mediaFromMxc(room.avatar_url).getSquareThumbnailHttp(32));
        }
    }, [room, client]);

    const onRoomClicked = useCallback((ev: React.MouseEvent) => {
        // If room was shift-clicked, remove it from the room directory
        if (ev.shiftKey) {
            ev.preventDefault();
            removeFromDirectory?.(room);
        }
    }, [room, removeFromDirectory]);

    const onPreviewClick = useCallback((ev: React.MouseEvent) => {
        showRoom(room, null, false, true);
        ev.stopPropagation();
    }, [room, showRoom]);

    const onViewClick = useCallback((ev: React.MouseEvent) => {
        showRoom(room);
        ev.stopPropagation();
    }, [room, showRoom]);

    const onJoinClick = useCallback((ev: React.MouseEvent) => {
        showRoom(room, null, true);
        ev.stopPropagation();
    }, [room, showRoom]);

    let previewButton;
    let joinOrViewButton;

    // Element Web currently does not allow guests to join rooms, so we
    // instead show them preview buttons for all rooms. If the room is not
    // world readable, a modal will appear asking you to register first. If
    // it is readable, the preview appears as normal.
    if (!hasJoinedRoom && (room.world_readable || isGuest)) {
        previewButton = (
            <AccessibleButton kind="secondary" onClick={onPreviewClick}>
                { _t("Preview") }
            </AccessibleButton>
        );
    }
    if (hasJoinedRoom) {
        joinOrViewButton = (
            <AccessibleButton kind="secondary" onClick={onViewClick}>
                { _t("View") }
            </AccessibleButton>
        );
    } else if (!isGuest) {
        joinOrViewButton = (
            <AccessibleButton kind="primary" onClick={onJoinClick}>
                { _t("Join") }
            </AccessibleButton>
        );
    }

    return <div
        role="listitem"
        className="mx_RoomDirectory_listItem"
    >
        <div
            onMouseDown={onRoomClicked}
            className="mx_RoomDirectory_roomAvatar"
        >
            <BaseAvatar
                width={32}
                height={32}
                resizeMethod='crop'
                name={name}
                idName={name}
                url={avatarUrl}
            />
        </div>
        <div
            onMouseDown={onRoomClicked}
            className="mx_RoomDirectory_roomDescription"
        >
            <div className="mx_RoomDirectory_name">
                { name }
            </div>&nbsp;
            <div
                className="mx_RoomDirectory_topic"
                dangerouslySetInnerHTML={{ __html: topic }}
            />
            <div className="mx_RoomDirectory_alias">
                { getDisplayAliasForRoom(room) }
            </div>
        </div>
        <div
            onMouseDown={onRoomClicked}
            className="mx_RoomDirectory_roomMemberCount"
        >
            { room.num_joined_members }
        </div>
        <div
            onMouseDown={onRoomClicked}
            className="mx_RoomDirectory_preview"
        >
            { previewButton }
        </div>
        <div
            onMouseDown={onRoomClicked}
            className="mx_RoomDirectory_join"
        >
            { joinOrViewButton }
        </div>
    </div>;
};
