/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room, type RoomMember } from "matrix-js-sdk/src/matrix";

import { _td, UserFriendlyError } from "../languageHandler";
import { EffectiveMembership, getEffectiveMembership } from "../utils/membership";
import { warnSelfDemote } from "../components/views/right_panel/UserInfo";
import { TimelineRenderingType } from "../contexts/RoomContext";
import { canAffectPowerlevels, success, reject } from "./utils";
import { CommandCategories, type RunResult } from "./interface";
import { Command } from "./command";

const updatePowerLevel = async (room: Room, member: RoomMember, powerLevel: number | undefined): Promise<unknown> => {
    // Only warn if the target is ourselves and the power level is decreasing or being unset
    if (member.userId === room.client.getUserId() && (powerLevel === undefined || member.powerLevel > powerLevel)) {
        const ok = await warnSelfDemote(room.isSpaceRoom());
        if (!ok) return; // Nothing to do
    }
    return room.client.setPowerLevel(room.roomId, member.userId, powerLevel);
};

const updatePowerLevelHelper = (
    client: MatrixClient,
    roomId: string,
    userId: string,
    powerLevel: number | undefined,
): RunResult => {
    const room = client.getRoom(roomId);
    if (!room) {
        return reject(
            new UserFriendlyError("slash_command|error_invalid_room", {
                roomId,
                cause: undefined,
            }),
        );
    }
    const member = room.getMember(userId);
    if (!member?.membership || getEffectiveMembership(member.membership) === EffectiveMembership.Leave) {
        return reject(new UserFriendlyError("slash_command|error_invalid_user_in_room"));
    }

    return success(updatePowerLevel(room, member, powerLevel));
};

export const op = new Command({
    command: "op",
    args: "<user-id> [<power-level>]",
    description: _td("slash_command|op"),
    isEnabled: canAffectPowerlevels,
    runFn: function (cli, roomId, threadId, args) {
        if (args) {
            const matches = args.match(/^(\S+?)( +(-?\d+))?$/);
            let powerLevel = 50; // default power level for op
            if (matches) {
                const userId = matches[1];
                if (matches.length === 4 && undefined !== matches[3]) {
                    powerLevel = parseInt(matches[3], 10);
                }
                return updatePowerLevelHelper(cli, roomId, userId, powerLevel);
            }
        }
        return reject(this.getUsage());
    },
    category: CommandCategories.admin,
    renderingTypes: [TimelineRenderingType.Room],
});

export const deop = new Command({
    command: "deop",
    args: "<user-id>",
    description: _td("slash_command|deop"),
    isEnabled: canAffectPowerlevels,
    runFn: function (cli, roomId, threadId, args) {
        if (args) {
            const matches = args.match(/^(\S+)$/);
            if (matches) {
                return updatePowerLevelHelper(cli, roomId, args, undefined);
            }
        }
        return reject(this.getUsage());
    },
    category: CommandCategories.admin,
    renderingTypes: [TimelineRenderingType.Room],
});
