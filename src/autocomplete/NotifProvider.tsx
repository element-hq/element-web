/*
Copyright 2017 New Vector Ltd

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

import React from "react";
import { Room } from "matrix-js-sdk/src/models/room";

import AutocompleteProvider from "./AutocompleteProvider";
import { _t } from "../languageHandler";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { PillCompletion } from "./Components";
import { ICompletion, ISelectionRange } from "./Autocompleter";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import { TimelineRenderingType } from "../contexts/RoomContext";

const AT_ROOM_REGEX = /@\S*/g;

export default class NotifProvider extends AutocompleteProvider {
    public constructor(public room: Room, renderingType?: TimelineRenderingType) {
        super({ commandRegex: AT_ROOM_REGEX, renderingType });
    }

    public async getCompletions(
        query: string,
        selection: ISelectionRange,
        force = false,
        limit = -1,
    ): Promise<ICompletion[]> {
        const client = MatrixClientPeg.get();

        if (!this.room.currentState.mayTriggerNotifOfType("room", client.credentials.userId!)) return [];

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
                        <PillCompletion title="@room" description={_t("Notify the whole room")}>
                            <RoomAvatar width={24} height={24} room={this.room} />
                        </PillCompletion>
                    ),
                    range: range!,
                },
            ];
        }
        return [];
    }

    public getName(): string {
        return "❗️ " + _t("Room Notification");
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill mx_Autocomplete_Completion_container_truncate"
                role="presentation"
                aria-label={_t("Notification Autocomplete")}
            >
                {completions}
            </div>
        );
    }
}
