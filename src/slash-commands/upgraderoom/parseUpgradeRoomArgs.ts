/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

export type UpgradeRoomParsedArgs = {
    targetVersion: string;
    additionalCreators?: string[];
};

/**
 * Parse the supplied arguments for a room upgrade, or return null if the
 * arguments are not valid. The arguments must be a room version followed by
 * zero or more valid user IDs.
 */
export function parseUpgradeRoomArgs(args: string): UpgradeRoomParsedArgs | null {
    const parts = args.split(/\s+/);
    if (parts.length === 0 || parts[0] === "") {
        return null;
    } else {
        const targetVersion = parts[0];
        let additionalCreators: string[] | undefined;
        for (let i = 1; i < parts.length; ++i) {
            if (additionalCreators === undefined) {
                additionalCreators = [];
            }
            additionalCreators.push(parts[i]);
        }
        return { targetVersion, additionalCreators };
    }
}
