/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "@sentry/browser";
import { type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { _t } from "../../../../../languageHandler";
import Modal from "../../../../../Modal";
import { bulkSpaceBehaviour } from "../../../../../utils/space";
import ConfirmSpaceUserActionDialog from "../../../../views/dialogs/ConfirmSpaceUserActionDialog";
import ConfirmUserActionDialog from "../../../../views/dialogs/ConfirmUserActionDialog";
import ErrorDialog from "../../../../views/dialogs/ErrorDialog";
import { type RoomAdminToolsProps } from "./UserInfoAdminToolsContainerViewModel";

interface RoomKickButtonState {
    /**
     * The function to call when the button is clicked
     */
    onKickClick: () => Promise<void>;
    /**
     * Whether the user can be kicked based on membership value. If the user already join or was invited, it can be kicked
     */
    canUserBeKicked: boolean;
    /**
     * The label of the kick button can be kick or disinvite
     */
    kickLabel: string;
}

/**
 * The view model for the room kick button used in the UserInfoAdminToolsContainer
 * @param {RoomAdminToolsProps} props - the object containing the necceray props for kickButton the view model
 * @param {Room} props.room - the room to kick/disinvite the user from
 * @param {RoomMember} props.member - the member to kick/disinvite
 * @param {boolean} props.isUpdating - whether the operation is currently in progress
 * @param {function} props.startUpdating - callback function to start the operation
 * @param {function} props.stopUpdating - callback function to stop the operation
 * @returns {KickButtonState} the room kick/disinvite button state
 */
export function useRoomKickButtonViewModel(props: RoomAdminToolsProps): RoomKickButtonState {
    const { isUpdating, startUpdating, stopUpdating, room, member } = props;

    const cli = useMatrixClientContext();

    const onKickClick = async (): Promise<void> => {
        if (isUpdating) return; // only allow one operation at a time
        startUpdating();

        const commonProps = {
            member,
            action: room.isSpaceRoom()
                ? member.membership === KnownMembership.Invite
                    ? _t("user_info|disinvite_button_space")
                    : _t("user_info|kick_button_space")
                : member.membership === KnownMembership.Invite
                  ? _t("user_info|disinvite_button_room")
                  : _t("user_info|kick_button_room"),
            title:
                member.membership === KnownMembership.Invite
                    ? _t("user_info|disinvite_button_room_name", { roomName: room.name })
                    : _t("user_info|kick_button_room_name", { roomName: room.name }),
            askReason: member.membership === KnownMembership.Join,
            danger: true,
        };

        let finished: Promise<[success?: boolean, reason?: string, rooms?: Room[]]>;

        if (room.isSpaceRoom()) {
            ({ finished } = Modal.createDialog(
                ConfirmSpaceUserActionDialog,
                {
                    ...commonProps,
                    space: room,
                    spaceChildFilter: (child: Room) => {
                        // Return true if the target member is not banned and we have sufficient PL to ban them
                        const myMember = child.getMember(cli.credentials.userId || "");
                        const theirMember = child.getMember(member.userId);
                        return (
                            !!myMember &&
                            !!theirMember &&
                            theirMember.membership === member.membership &&
                            myMember.powerLevel > theirMember.powerLevel &&
                            child.currentState.hasSufficientPowerLevelFor("kick", myMember.powerLevel)
                        );
                    },
                    allLabel: _t("user_info|kick_button_space_everything"),
                    specificLabel: _t("user_info|kick_space_specific"),
                    warningMessage: _t("user_info|kick_space_warning"),
                },
                "mx_ConfirmSpaceUserActionDialog_wrapper",
            ));
        } else {
            ({ finished } = Modal.createDialog(ConfirmUserActionDialog, commonProps));
        }

        const [proceed, reason, rooms = []] = await finished;
        if (!proceed) {
            stopUpdating();
            return;
        }

        bulkSpaceBehaviour(room, rooms, (room) => cli.kick(room.roomId, member.userId, reason || undefined))
            .then(
                () => {
                    // NO-OP; rely on the m.room.member event coming down else we could
                    // get out of sync if we force setState here!
                    logger.info("Kick success");
                },
                function (err) {
                    logger.error("Kick error: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("user_info|error_kicking_user"),
                        description: err?.message ?? "Operation failed",
                    });
                },
            )
            .finally(() => {
                stopUpdating();
            });
    };

    const canUserBeKicked = member.membership === KnownMembership.Invite || member.membership === KnownMembership.Join;

    const kickLabel = room.isSpaceRoom()
        ? member.membership === KnownMembership.Invite
            ? _t("user_info|disinvite_button_space")
            : _t("user_info|kick_button_space")
        : member.membership === KnownMembership.Invite
          ? _t("user_info|disinvite_button_room")
          : _t("user_info|kick_button_room");

    return {
        onKickClick,
        canUserBeKicked,
        kickLabel,
    };
}
