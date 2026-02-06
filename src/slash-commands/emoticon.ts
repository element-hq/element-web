/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { ContentHelpers } from "matrix-js-sdk/src/matrix";

import { Command } from "./command";
import { successSync } from "./utils";
import { CommandCategories } from "./interface";

export function emoticon(command: string, description: TranslationKey, message: string): Command {
    return new Command({
        command,
        args: "<message>",
        description,
        runFn: function (_cli, _roomId, _threadId, args) {
            if (args) {
                message = message + " " + args;
            }
            return successSync(ContentHelpers.makeTextMessage(message));
        },
        category: CommandCategories.messages,
    });
}
