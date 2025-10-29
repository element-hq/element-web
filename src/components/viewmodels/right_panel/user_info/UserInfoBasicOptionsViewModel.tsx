/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useContext } from "react";
import { RoomMember, User, type Room, KnownMembership } from "matrix-js-sdk/src/matrix";

import Modal from "../../../../Modal";
import ErrorDialog from "../../../views/dialogs/ErrorDialog";
import { _t, UserFriendlyError } from "../../../../languageHandler";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import dis from "../../../../dispatcher/dispatcher";
import PosthogTrackers from "../../../../PosthogTrackers";
import { ShareDialog } from "../../../views/dialogs/ShareDialog";
import { type ComposerInsertPayload } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../../dispatcher/actions";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import MultiInviter from "../../../../utils/MultiInviter";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { useRoomPermissions } from "./UserInfoBasicViewModel";
import { DirectoryMember, startDmOnFirstMessage } from "../../../../utils/direct-messages";
import { type Member } from "../../../views/right_panel/UserInfo";

export interface UserInfoBasicOptionsState {
    // boolean to know if selected user is current user
    isMe: boolean;
    // boolean to display/hide invite button
    showInviteButton: boolean;
    // boolean to display/hide insert pill button
    showInsertPillButton: boolean | "";
    // boolean to display/hide read receipt button
    readReceiptButtonDisabled: boolean;
    // Method called when a insert pill button is clicked
    onInsertPillButton: () => void;
    // Method called when a read receipt button is clicked, will add a pill in the input message field
    onReadReceiptButton: () => void;
    // Method called when a share user button is clicked, will display modal with profile to share
    onShareUserClick: () => void;
    // Method called when a invite button is clicked, will display modal to invite user
    onInviteUserButton: (fallbackRoomId: string, evt: Event) => Promise<void>;
    // Method called when the DM button is clicked, will open a DM with the selected member
    onOpenDmForUser: (member: Member) => Promise<void>;
}

export const useUserInfoBasicOptionsViewModel = (room: Room, member: User | RoomMember): UserInfoBasicOptionsState => {
    const cli = useContext(MatrixClientContext);

    // selected member is current user
    const isMe = member.userId === cli.getUserId();

    // Those permissions are updated when a change is done on the room current state and the selected user
    const roomPermissions = useRoomPermissions(cli, room, member as RoomMember);

    const isSpace = room?.isSpaceRoom();

    // read receipt button stay disable for a room space or if all events where read (null)
    const readReceiptButtonDisabled = isSpace || !room?.getEventReadUpTo(member.userId);

    // always show exempt when room is a space
    const showInsertPillButton = member instanceof RoomMember && member.roomId && !isSpace;

    // show invite button only if current user has the permission to invite and the selected user membership is LEAVE
    const showInviteButton =
        member instanceof RoomMember &&
        roomPermissions.canInvite &&
        (member?.membership ?? KnownMembership.Leave) === KnownMembership.Leave;

    const onReadReceiptButton = function (): void {
        const room = member instanceof RoomMember ? cli.getRoom(member.roomId) : null;
        if (!room || readReceiptButtonDisabled) return;

        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            highlighted: true,
            // this could return null, the default prevents a type error
            event_id: room.getEventReadUpTo(member.userId) || undefined,
            room_id: room.roomId,
            metricsTrigger: undefined, // room doesn't change
        });
    };

    const onInsertPillButton = function (): void {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            userId: member.userId,
            timelineRenderingType: TimelineRenderingType.Room,
        });
    };

    const onInviteUserButton = async (fallbackRoomId: string, ev: Event): Promise<void> => {
        try {
            const roomId = member instanceof RoomMember && member.roomId ? member.roomId : fallbackRoomId;

            // We use a MultiInviter to re-use the invite logic, even though we're only inviting one user.
            const inviter = new MultiInviter(cli, roomId || "");
            await inviter.invite([member.userId]).then(() => {
                if (inviter.getCompletionState(member.userId) !== "invited") {
                    const errorStringFromInviterUtility = inviter.getErrorText(member.userId);
                    if (errorStringFromInviterUtility) {
                        throw new Error(errorStringFromInviterUtility);
                    } else {
                        throw new UserFriendlyError("slash_command|invite_failed", {
                            user: member.userId,
                            roomId,
                            cause: undefined,
                        });
                    }
                }
            });
        } catch (err) {
            const description = err instanceof Error ? err.message : _t("invite|failed_generic");

            Modal.createDialog(ErrorDialog, {
                title: _t("invite|failed_title"),
                description,
            });
        }

        PosthogTrackers.trackInteraction("WebRightPanelRoomUserInfoInviteButton", ev);
    };

    const onShareUserClick = (): void => {
        Modal.createDialog(ShareDialog, {
            target: member,
        });
    };

    const onOpenDmForUser = async (user: Member): Promise<void> => {
        const avatarUrl = user instanceof User ? user.avatarUrl : user.getMxcAvatarUrl();
        const startDmUser = new DirectoryMember({
            user_id: user.userId,
            display_name: user.rawDisplayName,
            avatar_url: avatarUrl,
        });
        await startDmOnFirstMessage(cli, [startDmUser]);
    };

    return {
        isMe,
        showInviteButton,
        showInsertPillButton,
        readReceiptButtonDisabled,
        onReadReceiptButton,
        onInsertPillButton,
        onInviteUserButton,
        onShareUserClick,
        onOpenDmForUser,
    };
};
