/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { orderBy } from "lodash";

import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";

interface ILegacyFormat {
    [emoji: string]: [number, number]; // [count, date]
}

// New format tries to be more space efficient for synchronization. Ordered by Date descending.
export type RecentEmojiData = [emoji: string, count: number][];

const SETTING_NAME = "recent_emoji";

// we store more recents than we typically query but this lets us sort by weighted usage
// even if you haven't used your typically favourite emoji for a little while.
const STORAGE_LIMIT = 100;

// TODO remove this after some time
function migrate(): void {
    const data: ILegacyFormat = JSON.parse(window.localStorage.mx_reaction_count || "{}");
    const sorted = Object.entries(data).sort(([, [count1, date1]], [, [count2, date2]]) => date2 - date1);
    const newFormat = sorted.map(([emoji, [count, date]]) => [emoji, count]);
    SettingsStore.setValue(SETTING_NAME, null, SettingLevel.ACCOUNT, newFormat.slice(0, STORAGE_LIMIT));
}

function getRecentEmoji(): RecentEmojiData {
    return SettingsStore.getValue(SETTING_NAME) || [];
}

export function add(emoji: string): void {
    const recents = getRecentEmoji();
    const i = recents.findIndex(([e]) => e === emoji);

    let newEntry;
    if (i >= 0) {
        // first remove the existing tuple so that we can increment it and push it to the front
        [newEntry] = recents.splice(i, 1);
        newEntry[1]++; // increment the usage count
    } else {
        newEntry = [emoji, 1];
    }

    SettingsStore.setValue(SETTING_NAME, null, SettingLevel.ACCOUNT, [newEntry, ...recents].slice(0, STORAGE_LIMIT));
}

export function get(limit = 24): string[] {
    let recents = getRecentEmoji();

    if (recents.length < 1) {
        migrate();
        recents = getRecentEmoji();
    }

    // perform a stable sort on `count` to keep the recent (date) order as a secondary sort factor
    const sorted = orderBy(recents, "1", "desc");
    return sorted.slice(0, limit).map(([emoji]) => emoji);
}
