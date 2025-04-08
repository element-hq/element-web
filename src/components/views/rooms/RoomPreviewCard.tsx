/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type FC, useContext, useState } from "react";
import { type Room, JoinRule } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { _t } from "../../../languageHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import { EffectiveMembership, getEffectiveMembership } from "../../../utils/membership";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useDispatcher } from "../../../hooks/useDispatcher";
import { useRoomState } from "../../../hooks/useRoomState";
import { useMyRoomMembership } from "../../../hooks/useRoomMembers";
import AccessibleButton from "../elements/AccessibleButton";
import InlineSpinner from "../elements/InlineSpinner";
import RoomName from "../elements/RoomName";
import RoomTopic from "../elements/RoomTopic";
import RoomFacePile from "../elements/RoomFacePile";
import RoomAvatar from "../avatars/RoomAvatar";
import MemberAvatar from "../avatars/MemberAvatar";
import { BetaPill } from "../beta/BetaCard";
import RoomInfoLine from "./RoomInfoLine";
import { isVideoRoom as calcIsVideoRoom } from "../../../utils/video-rooms";

interface IProps {
    room: Room;
    onJoinButtonClicked: () => void;
    onRejectButtonClicked: () => void;
}

// XXX This component is currently only used for spaces and video rooms, though
// surely we should expand its use to all rooms for consistency? This already
// handles the text room case, though we would need to add support for ignoring
// and viewing invite reasons to achieve parity with the default invite screen.
const RoomPreviewCard: FC<IProps> = ({ room, onJoinButtonClicked, onRejectButtonClicked }) => {
    const cli = useContext(MatrixClientContext);
    const isVideoRoom = calcIsVideoRoom(room);
    const myMembership = useMyRoomMembership(room);
    useDispatcher(defaultDispatcher, (payload) => {
        if (payload.action === Action.JoinRoomError && payload.roomId === room.roomId) {
            setBusy(false); // stop the spinner, join failed
        }
    });

    const [busy, setBusy] = useState(false);

    const joinRule = useRoomState(room, (state) => state.getJoinRule());
    const cannotJoin =
        getEffectiveMembership(myMembership) === EffectiveMembership.Leave && joinRule !== JoinRule.Public;

    const viewLabs = (): void =>
        defaultDispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Labs,
        });

    let inviterSection: JSX.Element | null = null;
    let joinButtons: JSX.Element;
    if (myMembership === KnownMembership.Join) {
        joinButtons = (
            <AccessibleButton
                kind="danger_outline"
                onClick={() => {
                    defaultDispatcher.dispatch({
                        action: "leave_room",
                        room_id: room.roomId,
                    });
                }}
            >
                {_t("action|leave")}
            </AccessibleButton>
        );
    } else if (myMembership === KnownMembership.Invite) {
        const inviteSender = room.getMember(cli.getUserId()!)?.events.member?.getSender();

        if (inviteSender) {
            const inviter = room.getMember(inviteSender);

            inviterSection = (
                <div className="mx_RoomPreviewCard_inviter">
                    <MemberAvatar member={inviter} fallbackUserId={inviteSender} size="32px" />
                    <div>
                        <div className="mx_RoomPreviewCard_inviter_name">
                            {_t(
                                "room|invites_you_text",
                                {},
                                {
                                    inviter: () => <strong>{inviter?.name || inviteSender}</strong>,
                                },
                            )}
                        </div>
                        {inviter ? <div className="mx_RoomPreviewCard_inviter_mxid">{inviteSender}</div> : null}
                    </div>
                </div>
            );
        }

        joinButtons = (
            <>
                <AccessibleButton
                    kind="primary_outline"
                    onClick={() => {
                        setBusy(true);
                        onRejectButtonClicked();
                    }}
                >
                    {_t("action|decline")}
                </AccessibleButton>
                <AccessibleButton
                    kind="primary"
                    onClick={() => {
                        setBusy(true);
                        onJoinButtonClicked();
                    }}
                >
                    {_t("action|accept")}
                </AccessibleButton>
            </>
        );
    } else {
        joinButtons = (
            <AccessibleButton
                kind="primary"
                onClick={() => {
                    onJoinButtonClicked();
                    if (!cli.isGuest()) {
                        // user will be shown a modal that won't fire a room join error
                        setBusy(true);
                    }
                }}
                disabled={cannotJoin}
            >
                {_t("action|join")}
            </AccessibleButton>
        );
    }

    if (busy) {
        joinButtons = <InlineSpinner />;
    }

    let avatarRow: JSX.Element;
    if (isVideoRoom) {
        avatarRow = (
            <>
                <RoomAvatar room={room} size="50px" viewAvatarOnClick />
                <div className="mx_RoomPreviewCard_video" />
                <BetaPill onClick={viewLabs} tooltipTitle={_t("labs|video_rooms_beta")} />
            </>
        );
    } else if (room.isSpaceRoom()) {
        avatarRow = <RoomAvatar room={room} size="80px" viewAvatarOnClick />;
    } else {
        avatarRow = <RoomAvatar room={room} size="50px" viewAvatarOnClick />;
    }

    return (
        <div className="mx_RoomPreviewCard">
            {inviterSection}
            <div className="mx_RoomPreviewCard_avatar">{avatarRow}</div>
            <h1 className="mx_RoomPreviewCard_name">
                <RoomName room={room} />
            </h1>
            <RoomInfoLine room={room} />
            <RoomTopic room={room} className="mx_RoomPreviewCard_topic" />
            {room.getJoinRule() === "public" && <RoomFacePile room={room} />}
            {cannotJoin ? (
                <div className="mx_RoomPreviewCard_notice">
                    {_t("room|join_failed_needs_invite", { roomName: room.name })}
                </div>
            ) : null}
            <div className="mx_RoomPreviewCard_joinButtons">{joinButtons}</div>
        </div>
    );
};

export default RoomPreviewCard;
