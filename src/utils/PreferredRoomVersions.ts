/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * The preferred room versions for various features within the app. The
 * room versions here are selected based on the client's support for the
 * possible room versions in combination with server support in the
 * ecosystem.
 *
 * Loosely follows https://spec.matrix.org/latest/rooms/#feature-matrix
 */
export class PreferredRoomVersions {
    /**
     * The room version to use when creating "knock" rooms.
     */
    public static readonly KnockRooms = "7";

    /**
     * The room version to use when creating "restricted" rooms.
     */
    public static readonly RestrictedRooms = "9";

    private constructor() {
        // readonly, static, class
    }
}

/**
 * Determines if a room version supports the given feature using heuristics
 * for how Matrix works.
 * @param roomVer The room version to check support within.
 * @param featureVer The room version of the feature. Should be from PreferredRoomVersions.
 * @see PreferredRoomVersions
 */
export function doesRoomVersionSupport(roomVer: string, featureVer: string): boolean {
    // Assumption: all unstable room versions don't support the feature. Calling code can check for unstable
    // room versions explicitly if it wants to. The spec reserves [0-9] and `.` for its room versions.
    if (!roomVer.match(/[\d.]+/)) {
        return false;
    }

    // Dev note: While the spec says room versions are not linear, we can make reasonable assumptions
    // until the room versions prove themselves to be non-linear in the spec. We should see this coming
    // from a mile away and can course-correct this function if needed.
    return Number(roomVer) >= Number(featureVer);
}
