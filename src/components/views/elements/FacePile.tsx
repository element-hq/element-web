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

import React, { HTMLAttributes, ReactNode, useContext } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { sortBy } from "lodash";

import MemberAvatar from "../avatars/MemberAvatar";
import { _t } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";
import TextWithTooltip from "../elements/TextWithTooltip";
import { useRoomMembers } from "../../../hooks/useRoomMembers";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

const DEFAULT_NUM_FACES = 5;

interface IProps extends HTMLAttributes<HTMLSpanElement> {
    room: Room;
    onlyKnownUsers?: boolean;
    numShown?: number;
}

const isKnownMember = (member: RoomMember) => !!DMRoomMap.shared().getDMRoomsForUserId(member.userId)?.length;

const FacePile = ({ room, onlyKnownUsers = true, numShown = DEFAULT_NUM_FACES, ...props }: IProps) => {
    const cli = useContext(MatrixClientContext);
    let members = useRoomMembers(room);

    // sort users with an explicit avatar first
    const iteratees = [member => !!member.getMxcAvatarUrl()];
    if (onlyKnownUsers) {
        members = members.filter(isKnownMember);
    } else {
        // sort known users first
        iteratees.unshift(member => isKnownMember(member));
    }

    // exclude ourselves from the shown members list
    const shownMembers = sortBy(members.filter(m => m.userId !== cli.getUserId()), iteratees).slice(0, numShown);
    if (shownMembers.length < 1) return null;

    // We reverse the order of the shown faces in CSS to simplify their visual overlap,
    // reverse members in tooltip order to make the order between the two match up.
    const commaSeparatedMembers = shownMembers.map(m => m.rawDisplayName).reverse().join(", ");

    let tooltip: ReactNode;
    if (props.onClick) {
        tooltip = <div>
            <div className="mx_Tooltip_title">
                { _t("View all %(count)s members", { count: members.length }) }
            </div>
            <div className="mx_Tooltip_sub">
                { _t("Including %(commaSeparatedMembers)s", { commaSeparatedMembers }) }
            </div>
        </div>;
    } else {
        tooltip = _t("%(count)s members including %(commaSeparatedMembers)s", {
            count: members.length,
            commaSeparatedMembers,
        });
    }

    return <div {...props} className="mx_FacePile">
        <TextWithTooltip class="mx_FacePile_faces" tooltip={tooltip} tooltipProps={{ yOffset: 32 }}>
            { members.length > numShown ? <span className="mx_FacePile_face mx_FacePile_more" /> : null }
            { shownMembers.map(m =>
                <MemberAvatar key={m.userId} member={m} width={28} height={28} className="mx_FacePile_face" /> )}
        </TextWithTooltip>
        { onlyKnownUsers && <span className="mx_FacePile_summary">
            { _t("%(count)s people you know have already joined", { count: members.length }) }
        </span> }
    </div>;
};

export default FacePile;
