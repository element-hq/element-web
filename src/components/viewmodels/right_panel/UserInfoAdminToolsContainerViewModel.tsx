/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useContext } from "react";
import { type Room, RoomMember, KnownMembership, IPowerLevelsContent } from "matrix-js-sdk/src/matrix";

import ConfirmSpaceUserActionDialog from "../../views/dialogs/ConfirmSpaceUserActionDialog";
import Modal from "../../../Modal";
import { logger } from "matrix-js-sdk/src/logger";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { _t } from "../../../languageHandler";
import { bulkSpaceBehaviour } from "../../../utils/space";
import ConfirmUserActionDialog from "../../views/dialogs/ConfirmUserActionDialog";
import ErrorDialog from "../../views/dialogs/ErrorDialog";
import BulkRedactDialog from "../../views/dialogs/BulkRedactDialog";

interface RoomAdminToolsProps {
    room: Room;
    member: RoomMember;
    isUpdating: boolean;
    startUpdating: () => void;
    stopUpdating: () => void;
}

interface RoomKickButtonState {
    onKickClick: () => void;
    canUserBeKicked: boolean;
    kickLabel: string;
}

/**
 * The view model for the room kick button used in the UserInfoAdminToolsContainer
 * @param room - the room to kick the user from
 * @param member - the member to kick
 * @param isUpdating - whether the operation is currently in progress
 * @param startUpdating - a function to start the operation
 * @param stopUpdating - a function to stop the operation
 * @returns the room kick button state
 */
export function useRoomKickButtonViewModel( props: RoomAdminToolsProps ): RoomKickButtonState {
    const {isUpdating, startUpdating, stopUpdating, room, member} = props;

    const cli = useContext(MatrixClientContext);

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

    const canUserBeKicked = member.membership !== KnownMembership.Invite && member.membership !== KnownMembership.Join;

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


export interface RedactMessagesButtonState {
    onRedactAllMessagesClick: () => void;
}

/**
 * The view model for the redact messages button used in the UserInfoAdminToolsContainer
 * @param member - the member to redact messages for
 * @returns the redact messages button state
 */
export const userRedactMessagesButtonViewModel = (member: RoomMember): RedactMessagesButtonState => {
    const cli = useContext(MatrixClientContext);

    const onRedactAllMessagesClick = (): void => {
        const room = cli.getRoom(member.roomId);
        if (!room) return;

        Modal.createDialog(BulkRedactDialog, {
            matrixClient: cli,
            room,
            member,
        });
    };

    return {
        onRedactAllMessagesClick,
    };
};

export interface BanToggleButtonState {
    onBanOrUnbanClick: () => void;
    banLabel: string;
}

export const userBanToggleButtonViewModel = (props: RoomAdminToolsProps): BanToggleButtonState => {
    const { isUpdating, startUpdating, stopUpdating, room, member } = props;

    const cli = useContext(MatrixClientContext);

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
}

interface MuteButtonState {
    isMemberInTheRoom: boolean;
    muteLabel: string;
    onMutebuttonClick: () => void;
}

export const useMuteButtonViewModel = (props: RoomAdminToolsProps): MuteButtonState => {
    const { isUpdating, startUpdating, stopUpdating, room, member } = props;

    const cli = useContext(MatrixClientContext);

    const isMuted = (member: RoomMember, powerLevelContent: IPowerLevelsContent): boolean => {
        if (!powerLevelContent || !member) return false;

        const levelToSend =
            (powerLevelContent.events ? powerLevelContent.events["m.room.message"] : null) ||
            powerLevelContent.events_default;

        // levelToSend could be undefined as .events_default is optional. Coercing in this case using
        // Number() would always return false, so this preserves behaviour
        // FIXME: per the spec, if `events_default` is unset, it defaults to zero. If
        //   the member has a negative powerlevel, this will give an incorrect result.
        if (levelToSend === undefined) return false;

        return member.powerLevel < levelToSend;
    };

    const muted = isMuted(member, room.currentState.getStateEvents("m.room.power_levels", "")?.getContent() || {});
    const muteLabel = muted ? _t("common|unmute") : _t("common|mute");

    const isMemberInTheRoom = member.membership !== KnownMembership.Join;

    const onMutebuttonClick = async (): Promise<void> => {
        if (isUpdating) return; // only allow one operation at a time
        startUpdating();

        const roomId = member.roomId;
        const target = member.userId;

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        const powerLevels = powerLevelEvent?.getContent();
        const levelToSend = powerLevels?.events?.["m.room.message"] ?? powerLevels?.events_default;
        let level;
        if (muted) {
            // unmute
            level = levelToSend;
        } else {
            // mute
            level = levelToSend - 1;
        }
        level = parseInt(level);

        if (isNaN(level)) {
            stopUpdating();
            return;
        }

        cli.setPowerLevel(roomId, target, level)
            .then(
                () => {
                    // NO-OP; rely on the m.room.member event coming down else we could
                    // get out of sync if we force setState here!
                    logger.info("Mute toggle success");
                },
                function (err) {
                    logger.error("Mute error: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("common|error"),
                        description: _t("user_info|error_mute_user"),
                    });
                },
            )
            .finally(() => {
                stopUpdating();
            });
    };

    return {
        isMemberInTheRoom,
        onMutebuttonClick,
        muteLabel,
    };
};

interface UserInfoAdminToolsContainerState {
    shouldShowKickButton: boolean;
    shouldShowBanButton: boolean;
    shouldShowMuteButton: boolean;
    shouldShowRedactButton: boolean;
    isCurrentUserInTheRoom: boolean;
}

interface RoomAdminToolsContainerProps {
    room: Room;
    member: RoomMember;
    powerLevels: IPowerLevelsContent;
    children: React.ReactNode;
};

export const useUserInfoAdminToolsContainerViewModel = (
    props: RoomAdminToolsContainerProps,
): UserInfoAdminToolsContainerState => {
    const cli = useContext(MatrixClientContext);
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
        }
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