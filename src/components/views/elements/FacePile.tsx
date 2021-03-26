/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { HTMLAttributes } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { sortBy } from "lodash";

import MemberAvatar from "../avatars/MemberAvatar";
import { _t } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";
import TextWithTooltip from "../elements/TextWithTooltip";
import { useRoomMembers } from "../../../hooks/useRoomMembers";

const DEFAULT_NUM_FACES = 5;

interface IProps extends HTMLAttributes<HTMLSpanElement> {
    room: Room;
    onlyKnownUsers?: boolean;
    numShown?: number;
}

const isKnownMember = (member: RoomMember) => !!DMRoomMap.shared().getDMRoomsForUserId(member.userId)?.length;

const FacePile = ({ room, onlyKnownUsers = true, numShown = DEFAULT_NUM_FACES, ...props }: IProps) => {
    let members = useRoomMembers(room);

    // sort users with an explicit avatar first
    const iteratees = [member => !!member.getMxcAvatarUrl()];
    if (onlyKnownUsers) {
        members = members.filter(isKnownMember);
    } else {
        // sort known users first
        iteratees.unshift(member => isKnownMember(member));
    }
    if (members.length < 1) return null;

    const shownMembers = sortBy(members, iteratees).slice(0, numShown);
    return <div {...props} className="mx_FacePile">
        <div className="mx_FacePile_faces">
            { shownMembers.map(member => {
                return <TextWithTooltip key={member.userId} tooltip={member.name}>
                    <MemberAvatar member={member} width={28} height={28} />
                </TextWithTooltip>;
            }) }
        </div>
        { onlyKnownUsers && <span>
            { _t("%(count)s people you know have already joined", { count: members.length }) }
        </span> }
    </div>
};

export default FacePile;
