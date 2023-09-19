/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020, 2023 The Matrix.org Foundation C.I.C.

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

import { MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";

import { _td, UserFriendlyError } from "../languageHandler";
import { EffectiveMembership, getEffectiveMembership } from "../utils/membership";
import { warnSelfDemote } from "../components/views/right_panel/UserInfo";
import { TimelineRenderingType } from "../contexts/RoomContext";
import { canAffectPowerlevels, success, reject } from "./utils";
import { CommandCategories, RunResult } from "./interface";
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
            new UserFriendlyError("Command failed: Unable to find room (%(roomId)s", {
                roomId,
                cause: undefined,
            }),
        );
    }
    const member = room.getMember(userId);
    if (!member?.membership || getEffectiveMembership(member.membership) === EffectiveMembership.Leave) {
        return reject(new UserFriendlyError("Could not find user in room"));
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
