/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, useState, useCallback } from "react";
import { logger } from "@sentry/browser";
import { type RoomMember, type Room } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import ErrorDialog from "../../views/dialogs/ErrorDialog";
import QuestionDialog from "../../views/dialogs/QuestionDialog";
import { warnSelfDemote } from "../../views/right_panel/UserInfo";

/**
 *
 */
export interface UserInfoPowerLevelState {
    /**
     * default power level value of the selected user
     */
    powerLevelUsersDefault: number;
    /**
     * The new power level to apply
     */
    selectedPowerLevel: number;
    /**
     * Method to call When power level selection change
     */
    onPowerChange: (powerLevel: number) => void;
}

export const useUserInfoPowerlevelViewModel = (user: RoomMember, room: Room): UserInfoPowerLevelState => {
    const [selectedPowerLevel, setSelectedPowerLevel] = useState(user.powerLevel);

    useEffect(() => {
        setSelectedPowerLevel(user.powerLevel);
    }, [user]);

    const cli = useContext(MatrixClientContext);
    const onPowerChange = useCallback(
        async (powerLevel: number) => {
            setSelectedPowerLevel(powerLevel);

            const applyPowerChange = (roomId: string, target: string, powerLevel: number): Promise<unknown> => {
                return cli.setPowerLevel(roomId, target, powerLevel).then(
                    function () {
                        logger.info("Power change success");
                    },
                    function (err) {
                        logger.error("Failed to change power level " + err);
                        Modal.createDialog(ErrorDialog, {
                            title: _t("common|error"),
                            description: _t("error|update_power_level"),
                        });
                    },
                );
            };

            const roomId = user.roomId;
            const target = user.userId;

            const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
            if (!powerLevelEvent) return;

            const myUserId = cli.getUserId();
            const myPower = powerLevelEvent.getContent().users[myUserId || ""];
            if (myPower && parseInt(myPower) <= powerLevel && myUserId !== target) {
                const { finished } = Modal.createDialog(QuestionDialog, {
                    title: _t("common|warning"),
                    description: (
                        <div>
                            {_t("user_info|promote_warning")}
                            <br />
                            {_t("common|are_you_sure")}
                        </div>
                    ),
                    button: _t("action|continue"),
                });

                const [confirmed] = await finished;
                if (!confirmed) return;
            } else if (myUserId === target && myPower && parseInt(myPower) > powerLevel) {
                // If we are changing our own PL it can only ever be decreasing, which we cannot reverse.
                try {
                    if (!(await warnSelfDemote(room?.isSpaceRoom()))) return;
                } catch (e) {
                    logger.error("Failed to warn about self demotion: " + e);
                }
            }

            await applyPowerChange(roomId, target, powerLevel);
        },
        [user.roomId, user.userId, cli, room],
    );

    const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
    const powerLevelUsersDefault = powerLevelEvent ? powerLevelEvent.getContent().users_default : 0;

    return {
        powerLevelUsersDefault,
        onPowerChange,
        selectedPowerLevel,
    };
};
