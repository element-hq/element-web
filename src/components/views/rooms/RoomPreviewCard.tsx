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

import React, { FC, useContext, useState } from "react";
import { Room, JoinRule } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { _t } from "../../../languageHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import { EffectiveMembership, getEffectiveMembership } from "../../../utils/membership";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useDispatcher } from "../../../hooks/useDispatcher";
import { useFeatureEnabled } from "../../../hooks/useSettings";
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
    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms");
    const isVideoRoom = room.isElementVideoRoom() || (elementCallVideoRoomsEnabled && room.isCallRoom());
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
                                    inviter: () => <b>{inviter?.name || inviteSender}</b>,
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
                    {_t("action|reject")}
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

    let notice: string | null = null;
    if (cannotJoin) {
        notice = _t("room|join_failed_needs_invite", {
            roomName: room.name,
        });
    } else if (isVideoRoom && !videoRoomsEnabled) {
        notice =
            myMembership === KnownMembership.Join
                ? _t("room|view_failed_enable_video_rooms")
                : _t("room|join_failed_enable_video_rooms");

        joinButtons = (
            <AccessibleButton kind="primary" onClick={viewLabs}>
                {_t("room|show_labs_settings")}
            </AccessibleButton>
        );
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
            {notice ? <div className="mx_RoomPreviewCard_notice">{notice}</div> : null}
            <div className="mx_RoomPreviewCard_joinButtons">{joinButtons}</div>
        </div>
    );
};

export default RoomPreviewCard;
