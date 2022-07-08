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

import { doesRoomVersionSupport, PreferredRoomVersions } from "../src/utils/PreferredRoomVersions";

describe("doesRoomVersionSupport", () => {
    it("should detect unstable as unsupported", () => {
        expect(doesRoomVersionSupport("org.example.unstable", "1")).toBe(false);
        expect(doesRoomVersionSupport("1.2-beta", "1")).toBe(false);
    });

    it("should detect support properly", () => {
        expect(doesRoomVersionSupport("1", "2")).toBe(false); // older
        expect(doesRoomVersionSupport("2", "2")).toBe(true); // exact
        expect(doesRoomVersionSupport("3", "2")).toBe(true); // newer
    });

    it("should handle decimal versions", () => {
        expect(doesRoomVersionSupport("1.1", "2.2")).toBe(false); // older
        expect(doesRoomVersionSupport("2.1", "2.2")).toBe(false); // exact-ish
        expect(doesRoomVersionSupport("2.2", "2.2")).toBe(true); // exact
        expect(doesRoomVersionSupport("2.3", "2.2")).toBe(true); // exact-ish
        expect(doesRoomVersionSupport("3.1", "2.2")).toBe(true); // newer
    });

    it("should detect restricted rooms in v9 and v10", () => {
        // Dev note: we consider it a feature that v8 rooms have to upgrade considering the bug in v8.
        // https://spec.matrix.org/v1.3/rooms/v8/#redactions
        expect(doesRoomVersionSupport("8", PreferredRoomVersions.RestrictedRooms)).toBe(false);
        expect(doesRoomVersionSupport("9", PreferredRoomVersions.RestrictedRooms)).toBe(true);
        expect(doesRoomVersionSupport("10", PreferredRoomVersions.RestrictedRooms)).toBe(true);
    });
});
