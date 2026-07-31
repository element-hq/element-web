/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type Room, type RoomMember, type IPowerLevelsContent } from "matrix-js-sdk/src/matrix";

import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";

/**
 * Interface used by admin tools container subcomponents props
 */
export interface RoomAdminToolsProps {
    room: Room;
    member: RoomMember;
    isUpdating: boolean;
    startUpdating: () => void;
    stopUpdating: () => void;
}

/**
 * Interface used by admin tools container props
 */
export interface RoomAdminToolsContainerProps {
    room: Room;
    member: RoomMember;
    powerLevels: IPowerLevelsContent;
}

interface UserInfoAdminToolsContainerState {
    shouldShowKickButton: boolean;
    shouldShowBanButton: boolean;
    shouldShowMuteButton: boolean;
    shouldShowRedactButton: boolean;
    isCurrentUserInTheRoom: boolean;
}

/**
 * The view model for the user info admin tools container
 * @param {RoomAdminToolsContainerProps} props - the object containing the necceray props for the view model
 * @param {Room} props.room - the room that display the admin tools
 * @param {RoomMember} props.member - the selected member
 * @param {IPowerLevelsContent} props.powerLevels - current room power levels
 * @returns {UserInfoAdminToolsContainerState} the user info admin tools container state
 */
export const useUserInfoAdminToolsContainerViewModel = (
    props: RoomAdminToolsContainerProps,
): UserInfoAdminToolsContainerState => {
    const cli = useMatrixClientContext();
    const { room, member, powerLevels } = props;

    const editPowerLevel =
        (powerLevels.events ? powerLevels.events["m.room.power_levels"] : null) || powerLevels.state_default;

    // if these do not exist in the event then they should default to 50 as per the spec
    const { ban: banPowerLevel = 50, kick: kickPowerLevel = 50, redact: redactPowerLevel = 50 } = powerLevels;

    const me = room.getMember(cli.getUserId() || "");
    const isCurrentUserInTheRoom = me !== null;

    if (!isCurrentUserInTheRoom) {
        return {
            shouldShowKickButton: false,
            shouldShowBanButton: false,
            shouldShowMuteButton: false,
            shouldShowRedactButton: false,
            isCurrentUserInTheRoom: false,
        };
    }

    const isMe = me.userId === member.userId;
    const canAffectUser = member.powerLevel < me.powerLevel || isMe;

    return {
        shouldShowKickButton: !isMe && canAffectUser && me.powerLevel >= kickPowerLevel,
        shouldShowRedactButton: me.powerLevel >= redactPowerLevel && !room.isSpaceRoom(),
        shouldShowBanButton: !isMe && canAffectUser && me.powerLevel >= banPowerLevel,
        shouldShowMuteButton: !isMe && canAffectUser && me.powerLevel >= Number(editPowerLevel) && !room.isSpaceRoom(),
        isCurrentUserInTheRoom,
    };
};
