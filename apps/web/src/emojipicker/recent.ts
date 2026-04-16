/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { orderBy } from "lodash";
import { type AccountDataEvents } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";

export type RecentEmojiData = AccountDataEvents["m.recent_emoji"]["recent_emoji"];
export type LegacyRecentEmojiData = [emoji: string, count: number][];

const SETTING_NAME = "recent_emoji";

// we store more recents than we typically query but this lets us sort by weighted usage
// even if you haven't used your typically favourite emoji for a little while.
const STORAGE_LIMIT = 100;

function getRecentEmoji(): RecentEmojiData {
    return SettingsStore.getValue(SETTING_NAME) || [];
}

export function translateLegacyEmojiData(legacyData: LegacyRecentEmojiData): RecentEmojiData {
    return legacyData.map(([emoji, total]) => ({
        emoji,
        total,
    }));
}

export function mergeEmojiData(data1: RecentEmojiData, data2?: RecentEmojiData): RecentEmojiData {
    if (!data2) return data1;

    return Object.values(
        [...data1, ...data2].reduce(
            (acc, item) => {
                const existing = acc[item.emoji];

                // If it doesn't exist or the current total is higher, update it
                if (!existing || item.total > existing.total) {
                    acc[item.emoji] = item;
                }

                return acc;
            },
            {} as Record<string, RecentEmojiData[number]>,
        ),
    );
}

export function add(emoji: string): void {
    const recents = getRecentEmoji();
    const i = recents.findIndex((entry) => entry.emoji === emoji);

    let newEntry: RecentEmojiData[number];
    if (i >= 0) {
        // first remove the existing tuple so that we can increment it and push it to the front
        [newEntry] = recents.splice(i, 1);
        newEntry.total++; // increment the usage count
    } else {
        newEntry = { emoji, total: 1 };
    }

    SettingsStore.setValue(SETTING_NAME, null, SettingLevel.ACCOUNT, [newEntry, ...recents].slice(0, STORAGE_LIMIT));
}

export function get(limit = 24): string[] {
    const recents = getRecentEmoji();

    // perform a stable sort on `count` to keep the recent (date) order as a secondary sort factor
    const sorted = orderBy(recents, "1", "desc");
    return sorted.slice(0, limit).map(({ emoji }) => emoji);
}
