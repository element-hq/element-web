/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { _td } from "../../languageHandler";
import { isCurrentLocalRoom } from "../utils";
import { runUpgradeRoomCommand } from "./runUpgradeRoomCommand";
import { Command } from "../command";
import { CommandCategories, type RunResult } from "../interface";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { type SdkContextClass } from "../../contexts/SDKContextClass.ts";

const upgraderoom = new Command({
    command: "upgraderoom",
    args: "<new_version> [<additional-creator-user-id> ...]",
    description: _td("slash_command|upgraderoom"),
    isEnabled: (context: SdkContextClass) => !isCurrentLocalRoom(context),
    runFn: function (context: SdkContextClass, roomId: string, threadId: string | null, args?: string): RunResult {
        return runUpgradeRoomCommand(this, context.client!, roomId, threadId, args);
    },
    category: CommandCategories.admin,
    renderingTypes: [TimelineRenderingType.Room],
});

export default upgraderoom;
