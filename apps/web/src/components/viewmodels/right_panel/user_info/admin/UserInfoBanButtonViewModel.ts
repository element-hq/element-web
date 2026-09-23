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

export interface BanButtonState {
    /**
     * The function to call when the button is clicked
     */
    onBanOrUnbanClick: () => Promise<void>;
    /**
     * The label of the ban button can be ban or unban
     */
    banLabel: string;
}
/**
 * The view model for the room ban button used in the UserInfoAdminToolsContainer
 * @param {RoomAdminToolsProps} props - the object containing the necceray props for banButton the view model
 * @param {Room} props.room - the room to ban/unban the user in
 * @param {RoomMember} props.member - the member to ban/unban
 * @param {boolean} props.isUpdating - whether the operation is currently in progress
 * @param {function} props.startUpdating - callback function to start the operation
 * @param {function} props.stopUpdating - callback function to stop the operation
 * @returns {BanButtonState} the room ban/unban button state
 */
export const useBanButtonViewModel = (props: RoomAdminToolsProps): BanButtonState => {
    const { isUpdating, startUpdating, stopUpdating, room, member } = props;

    const cli = useMatrixClientContext();

    const isBanned = member.membership === KnownMembership.Ban;

    let banLabel = room.isSpaceRoom() ? _t("user_info|ban_button_space") : _t("user_info|ban_button_room");
    if (isBanned) {
        banLabel = room.isSpaceRoom() ? _t("user_info|unban_button_space") : _t("user_info|unban_button_room");
    }

    const onBanOrUnbanClick = async (): Promise<void> => {
        if (isUpdating) return; // only allow one operation at a time
        startUpdating();

        const commonProps = {
            member,
            action: room.isSpaceRoom()
                ? isBanned
                    ? _t("user_info|unban_button_space")
                    : _t("user_info|ban_button_space")
                : isBanned
                  ? _t("user_info|unban_button_room")
                  : _t("user_info|ban_button_room"),
            title: isBanned
                ? _t("user_info|unban_room_confirm_title", { roomName: room.name })
                : _t("user_info|ban_room_confirm_title", { roomName: room.name }),
            askReason: !isBanned,
            danger: !isBanned,
        };

        let finished: Promise<[success?: boolean, reason?: string, rooms?: Room[]]>;

        if (room.isSpaceRoom()) {
            ({ finished } = Modal.createDialog(
                ConfirmSpaceUserActionDialog,
                {
                    ...commonProps,
                    space: room,
                    spaceChildFilter: isBanned
                        ? (child: Room) => {
                              // Return true if the target member is banned and we have sufficient PL to unban
                              const myMember = child.getMember(cli.credentials.userId || "");
                              const theirMember = child.getMember(member.userId);
                              return (
                                  !!myMember &&
                                  !!theirMember &&
                                  theirMember.membership === KnownMembership.Ban &&
                                  myMember.powerLevel > theirMember.powerLevel &&
                                  child.currentState.hasSufficientPowerLevelFor("ban", myMember.powerLevel)
                              );
                          }
                        : (child: Room) => {
                              // Return true if the target member isn't banned and we have sufficient PL to ban
                              const myMember = child.getMember(cli.credentials.userId || "");
                              const theirMember = child.getMember(member.userId);
                              return (
                                  !!myMember &&
                                  !!theirMember &&
                                  theirMember.membership !== KnownMembership.Ban &&
                                  myMember.powerLevel > theirMember.powerLevel &&
                                  child.currentState.hasSufficientPowerLevelFor("ban", myMember.powerLevel)
                              );
                          },
                    allLabel: isBanned ? _t("user_info|unban_space_everything") : _t("user_info|ban_space_everything"),
                    specificLabel: isBanned ? _t("user_info|unban_space_specific") : _t("user_info|ban_space_specific"),
                    warningMessage: isBanned ? _t("user_info|unban_space_warning") : _t("user_info|kick_space_warning"),
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

        const fn = (roomId: string): Promise<unknown> => {
            if (isBanned) {
                return cli.unban(roomId, member.userId);
            } else {
                return cli.ban(roomId, member.userId, reason || undefined);
            }
        };

        bulkSpaceBehaviour(room, rooms, (room) => fn(room.roomId))
            .then(
                () => {
                    // NO-OP; rely on the m.room.member event coming down else we could
                    // get out of sync if we force setState here!
                    logger.info("Ban success");
                },
                function (err) {
                    logger.error("Ban error: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("common|error"),
                        description: _t("user_info|error_ban_user"),
                    });
                },
            )
            .finally(() => {
                stopUpdating();
            });
    };

    return {
        onBanOrUnbanClick,
        banLabel,
    };
};
