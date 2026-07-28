/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "@sentry/browser";
import { type RoomMember, type IPowerLevelsContent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { _t } from "../../../../../languageHandler";
import Modal from "../../../../../Modal";
import ErrorDialog from "../../../../views/dialogs/ErrorDialog";
import { type RoomAdminToolsProps } from "./UserInfoAdminToolsContainerViewModel";

interface MuteButtonState {
    /**
     * Whether the member is in the roomn based on the membership value
     */
    isMemberInTheRoom: boolean;
    /**
     * The label of the mute button can be mute or unmute
     */
    muteLabel: string;
    /**
     * The function to call when the mute button is clicked
     */
    onMuteButtonClick: () => Promise<void>;
}

/**
 * The view model for the room mute button used in the UserInfoAdminToolsContainer
 * @param {RoomAdminToolsProps} props - the object containing the necceray props for muteButton the view model
 * @param {Room} props.room - the room to mute/unmute the user in
 * @param {RoomMember} props.member - the member to mute/unmute
 * @param {boolean} props.isUpdating - whether the operation is currently in progress
 * @param {function} props.startUpdating - callback function to start the operation
 * @param {function} props.stopUpdating - callback function to stop the operation
 * @returns {MuteButtonState} the room mute/unmute button state
 */
export const useMuteButtonViewModel = (props: RoomAdminToolsProps): MuteButtonState => {
    const { isUpdating, startUpdating, stopUpdating, room, member } = props;

    const cli = useMatrixClientContext();

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

    const isMemberInTheRoom = member.membership == KnownMembership.Join;

    const onMuteButtonClick = async (): Promise<void> => {
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

        console.log("level", level);
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
        onMuteButtonClick,
        muteLabel,
    };
};
