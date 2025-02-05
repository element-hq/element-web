/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type IPublicRoomsChunkRoom } from "matrix-js-sdk/src/matrix";

import { linkifyAndSanitizeHtml } from "../../../../HtmlUtils";
import { _t } from "../../../../languageHandler";
import { getDisplayAliasForAliasSet } from "../../../../Rooms";

const MAX_NAME_LENGTH = 80;
const MAX_TOPIC_LENGTH = 800;

interface Props {
    room: IPublicRoomsChunkRoom;
    labelId: string;
    descriptionId: string;
    detailsId: string;
}

export function PublicRoomResultDetails({ room, labelId, descriptionId, detailsId }: Props): JSX.Element {
    let name =
        room.name ||
        getDisplayAliasForAliasSet(room.canonical_alias ?? "", room.aliases ?? []) ||
        _t("common|unnamed_room");
    if (name.length > MAX_NAME_LENGTH) {
        name = `${name.substring(0, MAX_NAME_LENGTH)}...`;
    }

    let topic = room.topic || "";
    // Additional truncation based on line numbers is done via CSS,
    // but to ensure that the DOM is not polluted with a huge string
    // we give it a hard limit before rendering.
    if (topic.length > MAX_TOPIC_LENGTH) {
        topic = `${topic.substring(0, MAX_TOPIC_LENGTH)}...`;
    }

    return (
        <div className="mx_SpotlightDialog_result_publicRoomDetails">
            <div className="mx_SpotlightDialog_result_publicRoomHeader">
                <span id={labelId} className="mx_SpotlightDialog_result_publicRoomName">
                    {name}
                </span>
                <span id={descriptionId} className="mx_SpotlightDialog_result_publicRoomAlias">
                    {room.canonical_alias ?? room.room_id}
                </span>
            </div>
            <div id={detailsId} className="mx_SpotlightDialog_result_publicRoomDescription">
                <span className="mx_SpotlightDialog_result_publicRoomMemberCount">
                    {_t("spotlight_dialog|count_of_members", {
                        count: room.num_joined_members,
                    })}
                </span>
                {topic && (
                    <>
                        &nbsp;·&nbsp;
                        <span
                            className="mx_SpotlightDialog_result_publicRoomTopic"
                            dangerouslySetInnerHTML={{ __html: linkifyAndSanitizeHtml(topic) }}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
