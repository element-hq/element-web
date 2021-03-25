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

import React from "react";
import { Room } from "matrix-js-sdk/src/models/room";

import MemberAvatar from "../avatars/MemberAvatar";
import { _t } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";

const DEFAULT_NUM_FACES = 5;

interface IProps {
    room: Room;
    numShown?: number;
}

const FacePile = ({ room, numShown = DEFAULT_NUM_FACES }: IProps) => {
    const knownMembers = room.getJoinedMembers().filter(member => {
        return !!DMRoomMap.shared().getDMRoomsForUserId(member.userId)?.length;
    });

    if (knownMembers.length < 1) return null;
    const shownMembers = knownMembers.slice(0, numShown);

    return <div className="mx_FacePile">
        <div className="mx_FacePile_faces">
            { shownMembers.map(member => <MemberAvatar key={member.userId} member={member} width={28} height={28} />) }
        </div>
        <span>
            { _t("%(count)s people you know have already joined", { count: knownMembers.length }) }
        </span>
    </div>
};

export default FacePile;
