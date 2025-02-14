/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import React from "react";

import { _t } from "../languageHandler";
import { MatrixClientPeg } from "../MatrixClientPeg";
import SettingsStore from "../settings/SettingsStore";
import RoomProvider from "./RoomProvider";

export default class SpaceProvider extends RoomProvider {
    protected getRooms(): Room[] {
        return MatrixClientPeg.safeGet()
            .getVisibleRooms(SettingsStore.getValue("feature_dynamic_room_predecessors"))
            .filter((r) => r.isSpaceRoom());
    }

    public getName(): string {
        return _t("common|spaces");
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill mx_Autocomplete_Completion_container_truncate"
                role="listbox"
                aria-label={_t("composer|autocomplete|space_a11y")}
            >
                {completions}
            </div>
        );
    }
}
