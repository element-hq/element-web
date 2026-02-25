/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { _td } from "../../languageHandler";
import { isCurrentLocalRoom } from "../utils";
import { runUpgradeRoomCommand } from "./runUpgradeRoomCommand";
import { Command } from "../command";
import { CommandCategories, type RunResult } from "../interface";
import { TimelineRenderingType } from "../../contexts/RoomContext";

const upgraderoom = new Command({
    command: "upgraderoom",
    args: "<new_version> [<additional-creator-user-id> ...]",
    description: _td("slash_command|upgraderoom"),
    isEnabled: (cli: MatrixClient) => !isCurrentLocalRoom(cli),
    runFn: function (cli: MatrixClient, roomId: string, threadId: string | null, args?: string): RunResult {
        return runUpgradeRoomCommand(this, cli, roomId, threadId, args);
    },
    category: CommandCategories.admin,
    renderingTypes: [TimelineRenderingType.Room],
});

export default upgraderoom;
