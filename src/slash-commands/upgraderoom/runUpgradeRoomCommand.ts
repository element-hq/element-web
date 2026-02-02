/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import Modal from "../../Modal";
import RoomUpgradeWarningDialog from "../../components/views/dialogs/RoomUpgradeWarningDialog";
import { type Command } from "../command";
import { UserFriendlyError } from "../../languageHandler";
import { parseUpgradeRoomArgs } from "./parseUpgradeRoomArgs";
import { reject, success } from "../utils";
import { type RunResult } from "../interface";
import { upgradeRoom } from "../../utils/RoomUpgrade";

export function runUpgradeRoomCommand(
    command: Command,
    cli: MatrixClient,
    roomId: string,
    _threadId: string | null,
    args?: string,
): RunResult {
    if (!args) {
        return reject(command.getUsage());
    }
    const parsedArgs = parseUpgradeRoomArgs(args);
    if (parsedArgs) {
        const room = cli.getRoom(roomId);
        if (!room?.currentState.mayClientSendStateEvent("m.room.tombstone", cli)) {
            return reject(new UserFriendlyError("slash_command|upgraderoom_permission_error"));
        }

        const { finished } = Modal.createDialog(
            RoomUpgradeWarningDialog,
            { roomId: roomId, targetVersion: parsedArgs.targetVersion },
            /*className=*/ undefined,
            /*isPriority=*/ false,
            /*isStatic=*/ true,
        );

        return success(
            finished.then(async ([resp]): Promise<void> => {
                if (!resp?.continue) return;
                await upgradeRoom(
                    room,
                    parsedArgs.targetVersion,
                    resp.invite,
                    true,
                    true,
                    false,
                    undefined,
                    false,
                    parsedArgs.additionalCreators,
                );
            }),
        );
    }
    return reject(command.getUsage());
}
