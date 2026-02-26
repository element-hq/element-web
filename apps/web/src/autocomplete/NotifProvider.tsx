/*
Copyright 2017-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import AutocompleteProvider from "./AutocompleteProvider";
import { _t } from "../languageHandler";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { PillCompletion } from "./Components";
import { type ICompletion, type ISelectionRange } from "./Autocompleter";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import { type TimelineRenderingType } from "../contexts/RoomContext";

const AT_ROOM_REGEX = /@\S*/g;

export default class NotifProvider extends AutocompleteProvider {
    public constructor(
        public room: Room,
        renderingType?: TimelineRenderingType,
    ) {
        super({ commandRegex: AT_ROOM_REGEX, renderingType });
    }

    public async getCompletions(
        query: string,
        selection: ISelectionRange,
        force = false,
        limit = -1,
    ): Promise<ICompletion[]> {
        const client = MatrixClientPeg.safeGet();

        if (!this.room.currentState.mayTriggerNotifOfType("room", client.getSafeUserId())) return [];

        const { command, range } = this.getCurrentCommand(query, selection, force);
        if (
            command?.[0] &&
            command[0].length > 1 &&
            ["@room", "@channel", "@everyone", "@here"].some((c) => c.startsWith(command![0]))
        ) {
            return [
                {
                    completion: "@room",
                    completionId: "@room",
                    type: "at-room",
                    suffix: " ",
                    component: (
                        <PillCompletion title="@room" description={_t("composer|autocomplete|@room_description")}>
                            <RoomAvatar size="24px" room={this.room} />
                        </PillCompletion>
                    ),
                    range: range!,
                },
            ];
        }
        return [];
    }

    public getName(): string {
        return "❗️ " + _t("composer|autocomplete|notification_description");
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill mx_Autocomplete_Completion_container_truncate"
                role="presentation"
                aria-label={_t("composer|autocomplete|notification_a11y")}
            >
                {completions}
            </div>
        );
    }
}
