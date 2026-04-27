/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _td } from "@element-hq/web-shared-components";

import { Command, CommandCategories, splitAtFirstSpace } from "./SlashCommands";
import SettingsStore from "../settings/SettingsStore";
import { reject, success } from "./utils";
import { UserFriendlyError } from "../languageHandler";
import { userStatusTextWithinMaxLength } from "../hooks/useUserStatus";
import { TimelineRenderingType } from "../contexts/RoomContext";

export const statusCommand = new Command({
    command: "status",
    args: "<emoji> <text>",
    description: _td("slash_command|status|description"),
    isEnabled: () => SettingsStore.getValue("feature_user_status"),
    runFn: function (cli, _roomId, _threadId, args) {
        if (!args) {
            return reject(new UserFriendlyError("slash_command|status|no_args"));
        }
        const [emojiText, text] = splitAtFirstSpace(args);
        if (!emojiText) {
            return reject(new UserFriendlyError("slash_command|status|no_emoji"));
        }
        if (!text) {
            return reject(new UserFriendlyError("slash_command|status|no_text"));
        }
        const [emoji, additionalSegment] = [...new Intl.Segmenter().segment(emojiText)];
        if (additionalSegment) {
            return reject(new UserFriendlyError("slash_command|status|too_long_emoji"));
        }
        if (!userStatusTextWithinMaxLength(text)) {
            return reject(new UserFriendlyError("slash_command|status|too_long_text"));
        }
        return success(
            cli.setExtendedProfileProperty("org.matrix.msc4426.status", {
                emoji: emoji.segment,
                text,
            }),
        );
    },
    category: CommandCategories.actions,
    renderingTypes: [TimelineRenderingType.Room],
});
