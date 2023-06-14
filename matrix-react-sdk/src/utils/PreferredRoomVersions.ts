/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
