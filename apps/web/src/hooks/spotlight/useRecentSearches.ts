/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import { SettingLevel } from "../../settings/SettingLevel";
import SettingsStore from "../../settings/SettingsStore";
import { filterBoolean } from "../../utils/arrays";

export const useRecentSearches = (): [Room[], () => void] => {
    const [rooms, setRooms] = useState(() => {
        const cli = MatrixClientPeg.safeGet();
        const recents = SettingsStore.getValue("SpotlightSearch.recentSearches", null);
        return filterBoolean(recents.map((r) => cli.getRoom(r)));
    });

    return [
        rooms,
        () => {
            SettingsStore.setValue("SpotlightSearch.recentSearches", null, SettingLevel.ACCOUNT, []);
            setRooms([]);
        },
    ];
};
