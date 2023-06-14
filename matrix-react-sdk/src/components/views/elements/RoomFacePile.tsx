/*
Copyright 2021-2022 The Matrix.org Foundation C.I.C.

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

import React, { FC, HTMLAttributes, useContext } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { sortBy } from "lodash";

import { _t } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";
import FacePile from "./FacePile";
import { useRoomMembers } from "../../../hooks/useRoomMembers";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

const DEFAULT_NUM_FACES = 5;

const isKnownMember = (member: RoomMember): boolean => !!DMRoomMap.shared().getDMRoomsForUserId(member.userId)?.length;

interface IProps extends HTMLAttributes<HTMLSpanElement> {
    room: Room;
    onlyKnownUsers?: boolean;
    numShown?: number;
}

const RoomFacePile: FC<IProps> = ({ room, onlyKnownUsers = true, numShown = DEFAULT_NUM_FACES, ...props }) => {
    const cli = useContext(MatrixClientContext);
    const isJoined = room.getMyMembership() === "join";
    let members = useRoomMembers(room);
    const count = members.length;

    // sort users with an explicit avatar first
    const iteratees = [(member: RoomMember) => (member.getMxcAvatarUrl() ? 0 : 1)];
    if (onlyKnownUsers) {
        members = members.filter(isKnownMember);
    } else {
        // sort known users first
        iteratees.unshift((member) => (isKnownMember(member) ? 0 : 1));
    }

    // exclude ourselves from the shown members list
    const shownMembers = sortBy(
        members.filter((m) => m.userId !== cli.getUserId()),
        iteratees,
    ).slice(0, numShown);
    if (shownMembers.length < 1) return null;

    // We reverse the order of the shown faces in CSS to simplify their visual overlap,
    // reverse members in tooltip order to make the order between the two match up.
    const commaSeparatedMembers = shownMembers
        .map((m) => m.name)
        .reverse()
        .join(", ");

    const tooltip = (
        <div>
            <div className="mx_Tooltip_title">
                {props.onClick ? _t("View all %(count)s members", { count }) : _t("%(count)s members", { count })}
            </div>
            <div className="mx_Tooltip_sub">
                {isJoined
                    ? _t("Including you, %(commaSeparatedMembers)s", { commaSeparatedMembers })
                    : _t("Including %(commaSeparatedMembers)s", { commaSeparatedMembers })}
            </div>
        </div>
    );

    return (
        <FacePile
            members={shownMembers}
            faceSize={28}
            overflow={members.length > numShown}
            tooltip={tooltip}
            {...props}
        >
            {onlyKnownUsers && (
                <span className="mx_FacePile_summary">
                    {_t("%(count)s people you know have already joined", { count: members.length })}
                </span>
            )}
        </FacePile>
    );
};

export default RoomFacePile;
