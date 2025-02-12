/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC } from "react";
import { type Room, JoinRule, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { _t } from "../../../languageHandler";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import { useRoomState } from "../../../hooks/useRoomState";
import { useRoomMemberCount, useMyRoomMembership } from "../../../hooks/useRoomMembers";
import AccessibleButton from "../elements/AccessibleButton";
import { isVideoRoom as calcIsVideoRoom } from "../../../utils/video-rooms";

interface IProps {
    room: Room;
}

const RoomInfoLine: FC<IProps> = ({ room }) => {
    // summary will begin as undefined whilst loading and go null if it fails to load or we are not invited.
    const summary = useAsyncMemo(async (): Promise<Awaited<ReturnType<MatrixClient["getRoomSummary"]>> | null> => {
        if (room.getMyMembership() !== KnownMembership.Invite) return null;
        try {
            return await room.client.getRoomSummary(room.roomId);
        } catch {
            return null;
        }
    }, [room]);
    const joinRule = useRoomState(room, (state) => state.getJoinRule());
    const membership = useMyRoomMembership(room);
    const memberCount = useRoomMemberCount(room);

    const isVideoRoom = calcIsVideoRoom(room);

    let iconClass: string;
    let roomType: string;
    if (isVideoRoom) {
        iconClass = "mx_RoomInfoLine_video";
        roomType = _t("common|video_room");
    } else if (joinRule === JoinRule.Public) {
        iconClass = "mx_RoomInfoLine_public";
        roomType = room.isSpaceRoom() ? _t("common|public_space") : _t("common|public_room");
    } else {
        iconClass = "mx_RoomInfoLine_private";
        roomType = room.isSpaceRoom() ? _t("common|private_space") : _t("common|private_room");
    }

    let members: JSX.Element | undefined;
    if (membership === KnownMembership.Invite && summary) {
        // Don't trust local state and instead use the summary API
        members = (
            <span className="mx_RoomInfoLine_members">
                {_t("common|n_members", { count: summary.num_joined_members })}
            </span>
        );
    } else if (memberCount && summary !== undefined) {
        // summary is not still loading
        const viewMembers = (): void =>
            RightPanelStore.instance.setCard({
                phase: RightPanelPhases.MemberList,
            });

        members = (
            <AccessibleButton kind="link" className="mx_RoomInfoLine_members" onClick={viewMembers}>
                {_t("common|n_members", { count: memberCount })}
            </AccessibleButton>
        );
    }

    return (
        <div className={`mx_RoomInfoLine ${iconClass}`}>
            {roomType}
            {members}
        </div>
    );
};

export default RoomInfoLine;
