/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";
import React from "react";

import { _t } from "../languageHandler";
import { MatrixClientPeg } from "../MatrixClientPeg";
import SettingsStore from "../settings/SettingsStore";
import RoomProvider from "./RoomProvider";

export default class SpaceProvider extends RoomProvider {
    protected getRooms(): Room[] {
        return MatrixClientPeg.get()
            .getVisibleRooms(SettingsStore.getValue("feature_dynamic_room_predecessors"))
            .filter((r) => r.isSpaceRoom());
    }

    public getName(): string {
        return _t("Spaces");
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill mx_Autocomplete_Completion_container_truncate"
                role="listbox"
                aria-label={_t("Space Autocomplete")}
            >
                {completions}
            </div>
        );
    }
}
