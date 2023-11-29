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

import { IPublicRoomsChunkRoom } from "matrix-js-sdk/src/matrix";
import { linkifyAndSanitizeHtml } from "matrix-react-sdk/src/HtmlUtils";
import { _t } from "matrix-react-sdk/src/languageHandler";
import React from "react";

import RoomName from "../../elements/RoomName";

const MAX_NAME_LENGTH = 80;
const MAX_TOPIC_LENGTH = 800;

interface Props {
    room: IPublicRoomsChunkRoom;
    labelId: string;
    descriptionId: string;
    detailsId: string;
}

export function PublicRoomResultDetails({ room, labelId, descriptionId, detailsId }: Props): JSX.Element {
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
                    <RoomName room={room} maxLength={MAX_NAME_LENGTH} />
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
