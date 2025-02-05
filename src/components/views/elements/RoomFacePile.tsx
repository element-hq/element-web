/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, type HTMLAttributes, useContext } from "react";
import { type Room, type RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { sortBy } from "lodash";

import { _t } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";
import FacePile from "./FacePile";
import { useRoomMembers } from "../../../hooks/useRoomMembers";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { type ButtonEvent } from "./AccessibleButton";

const DEFAULT_NUM_FACES = 5;

const isKnownMember = (member: RoomMember): boolean => !!DMRoomMap.shared().getDMRoomsForUserId(member.userId)?.length;

interface IProps extends HTMLAttributes<HTMLSpanElement> {
    room: Room;
    onlyKnownUsers?: boolean;
    numShown?: number;
    onClick?: (e: ButtonEvent) => void | Promise<void>;
}

const RoomFacePile: FC<IProps> = ({ room, onlyKnownUsers = true, numShown = DEFAULT_NUM_FACES, ...props }) => {
    const cli = useContext(MatrixClientContext);
    const isJoined = room.getMyMembership() === KnownMembership.Join;
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

    return (
        <FacePile
            members={shownMembers}
            size="28px"
            overflow={members.length > numShown}
            tooltipLabel={
                props.onClick ? _t("room|face_pile_tooltip_label", { count }) : _t("common|n_members", { count })
            }
            tooltipShortcut={
                isJoined
                    ? _t("room|face_pile_tooltip_shortcut_joined", { commaSeparatedMembers })
                    : _t("room|face_pile_tooltip_shortcut", { commaSeparatedMembers })
            }
            {...props}
        >
            {onlyKnownUsers && (
                <span className="mx_FacePile_summary">{_t("room|face_pile_summary", { count: members.length })}</span>
            )}
        </FacePile>
    );
};

export default RoomFacePile;
